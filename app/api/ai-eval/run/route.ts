import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getIdentity } from '@/lib/pii/identity'
import { requireRole } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validation'
import { getAiProvider } from '@/lib/ai'
import { anthropicProvider } from '@/lib/ai/anthropic'
import { buildAdviceContext } from '@/lib/ai/advice'
import { judgeAdvice, type AdviceScores } from '@/lib/ai/judge'
import { caseLabel } from '@/lib/annotation'
import { logAuditEvent } from '@/lib/audit'
import type { AiProvider, ChatMessage } from '@/lib/ai/types'

// POST /api/ai-eval/run  { clientIds: string[] }
// Genereert per casus met ELK model een conceptadvies op IDENTIEKE context
// (zelfde prompt + zelfde opgehaalde kennis) en geeft ze terug naast het advies
// dat de arts zelf schreef. Slaat niets op — puur ter vergelijking.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_CASES = 3   // per run; twee modellen per casus kost tijd

type ClientRel = { gender: string | null; birth_date: string | null }

async function runOne(p: AiProvider, ctx: { system: string; user: string; examples: ChatMessage[] }) {
  const t0 = Date.now()
  try {
    // Zelfde maxTokens + few-shot-voorbeelden als productie (generateAdvice) —
    // anders eval je een ander regime.
    const text = await p.chat({ system: ctx.system, user: ctx.user, examples: ctx.examples, maxTokens: 2500, temperature: 0.3 })
    return { text, ms: Date.now() - t0 }
  } catch (e) {
    return { text: '', ms: Date.now() - t0, error: e instanceof Error ? e.message : 'Onbekende fout.' }
  }
}

export async function POST(req: Request) {
  const auth = await requireRole(['admin', 'arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const clientIds: string[] = Array.isArray(body.clientIds)
    ? [...new Set((body.clientIds as unknown[]).filter(v => typeof v === 'string' && isUuid(v)) as string[])].slice(0, MAX_CASES)
    : []
  if (clientIds.length === 0) return NextResponse.json({ error: 'Geen casussen geselecteerd.' }, { status: 400 })

  const current = getAiProvider()
  if (!current.isConfigured()) {
    return NextResponse.json({ error: `Huidige provider (${current.name}) is niet geconfigureerd.` }, { status: 503 })
  }

  const variants: { key: string; name: string; provider: AiProvider }[] = [
    { key: 'huidig', name: current.name, provider: current },
  ]
  if (anthropicProvider.isConfigured()) {
    variants.push({ key: 'claude', name: anthropicProvider.name, provider: anthropicProvider })
  }

  const admin = createAdminClient()
  const results = []

  for (const clientId of clientIds) {
    // Zelfde prompt + zelfde opgehaalde kennis voor élk model.
    let ctx
    try {
      ctx = await buildAdviceContext(clientId)
    } catch (e) {
      results.push({ clientId, label: 'Casus', error: e instanceof Error ? e.message : 'Context bouwen mislukt.' })
      continue
    }

    const [{ data: client }, { data: ann }] = await Promise.all([
      admin.from('vh_client').select('gender').eq('id', clientId).maybeSingle(),
      admin.from('vh_annotation')
        .select('advies, algemeen_beeld, submitted_at')
        .eq('client_id', clientId).eq('status', 'ingediend')
        .order('submitted_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    // Fase 2 PII-kluis: geboortedatum via de toegangslaag.
    const identity = await getIdentity(admin, clientId)
    const c: ClientRel | null = client ? { gender: (client as { gender: string | null }).gender, birth_date: identity?.birthDate ?? null } : null

    const outputs: Record<string, { text: string; ms: number; error?: string; scores?: AdviceScores | null }> = {}
    for (const v of variants) outputs[v.key] = await runOne(v.provider, ctx)

    // Rubric-beoordeling per uitvoer door de sterkst beschikbare provider —
    // maakt het verschil tussen modellen en promptversies meetbaar in cijfers.
    const judge = anthropicProvider.isConfigured() ? anthropicProvider : current
    for (const v of variants) {
      const o = outputs[v.key]
      if (!o.error && o.text) {
        o.scores = await judgeAdvice({
          judge,
          adviceText: o.text,
          priorities: ctx.priorities,
          artsAdvies: ann?.advies ?? null,
        })
      }
    }

    results.push({
      clientId,
      label:         caseLabel(c?.birth_date ?? null, c?.gender ?? null),
      chunksUsed:    ctx.chunksUsed,
      artsAdvies:    ann?.advies ?? null,
      artsBeeld:     ann?.algemeen_beeld ?? null,
      outputs,
    })
  }

  logAuditEvent({
    actorUserId:  auth.userId,
    actorRole:    'medisch_deskundige',
    resourceType: 'annotation',
    action:       'export',
    outcome:      'success',
    reason:       `AI-eval uitgevoerd op ${clientIds.length} casus(sen) met ${variants.length} model(len)`,
    metadata:     { cases: clientIds.length, variants: variants.length },
  }).catch(() => {})

  return NextResponse.json({
    ok: true,
    variants: variants.map(v => ({ key: v.key, name: v.name })),
    judgeName: (anthropicProvider.isConfigured() ? anthropicProvider : current).name,
    results,
  })
}
