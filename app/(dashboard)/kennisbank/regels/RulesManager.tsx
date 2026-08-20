'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, AlertTriangle, GitBranch, X } from 'lucide-react'
import { KNOWLEDGE_DOMAINS, DOMAIN_LABELS } from '@/lib/knowledge-domains'

// Beheer-UI voor als-dan richtlijnen. De conditie-bouwer dekt de vormen die
// lib/ai/rules.ts evalueert; de API valideert server-side nogmaals.

interface Cond { kind: string; code?: string; qid?: string; op?: string; value?: unknown }
interface Rule {
  id: string; name: string; active: boolean; domain: string | null
  conditions: Cond[]; instruction: string; created_at: string
}
interface Biomarker { code: string; display_name: string }
interface Question { id: string; type: string; label: string; options: { value: string; label: string }[] }

const DISEASES = [
  { value: 'heart_attack', label: 'Hartaanval' },
  { value: 'ischemic_stroke', label: 'Herseninfarct' },
  { value: 'type2_diabetes', label: 'Diabetes type 2' },
  { value: 'chronic_kidney_disease', label: 'Chronische nierziekte' },
  { value: 'fatty_liver_disease', label: 'Leververvetting' },
]
const NUM_OPS = [
  { value: 'gt', label: '>' }, { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' }, { value: 'lte', label: '≤' },
]

const inputCls = 'rounded-lg border border-[#e2e8f0] px-2.5 py-1.5 text-sm text-[#1e293b] focus:border-[#1f1683] focus:outline-none'

function condLabel(c: Cond, biomarkers: Biomarker[], questions: Question[]): string {
  const op = NUM_OPS.find(o => o.value === c.op)?.label ?? c.op
  if (c.kind === 'biomarker') {
    const name = biomarkers.find(b => b.code === c.code)?.display_name ?? c.code
    return c.op === 'attention' ? `${name} wijkt af` : `${name} ${op} ${c.value}`
  }
  if (c.kind === 'question') {
    const q = questions.find(x => x.id === c.qid)
    const lbl = (q?.label ?? c.qid ?? '').replace(/\s*\?$/, '')
    if (c.op === 'eq') return `${lbl} = ${c.value === true ? 'ja' : c.value === false ? 'nee' : c.value}`
    return `${lbl} score ${c.op === 'lte' ? '≤' : '≥'} ${c.value}`
  }
  if (c.kind === 'disease') return `Verhoogd risico: ${DISEASES.find(d => d.value === c.code)?.label ?? c.code}`
  if (c.kind === 'bmi') return `BMI ${op} ${c.value}`
  if (c.kind === 'age') return `Leeftijd ${op} ${c.value}`
  if (c.kind === 'gender') return `Geslacht = ${c.value}`
  return c.kind
}

const emptyCond = (): Cond => ({ kind: 'biomarker', op: 'gt', value: '' })

export function RulesManager({ initialRules, biomarkers, questions }: {
  initialRules: Rule[]
  biomarkers: Biomarker[]
  questions: Question[]
}) {
  const router = useRouter()
  const [rules, setRules] = useState<Rule[]>(initialRules)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [instruction, setInstruction] = useState('')
  const [conds, setConds] = useState<Cond[]>([emptyCond()])

  function setCond(i: number, patch: Partial<Cond>) {
    setConds(prev => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  }

  async function save() {
    setBusy(true); setError('')
    const res = await fetch('/api/advice-rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, instruction, domain: domain || null,
        conditions: conds.map(c => ({ ...c, value: normalizeValue(c) })),
      }),
    })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(j.error ?? 'Opslaan mislukt.'); return }
    setShowForm(false); setName(''); setDomain(''); setInstruction(''); setConds([emptyCond()])
    router.refresh()
    setRules(prev => [{ id: j.id, name, active: true, domain: domain || null, conditions: conds, instruction, created_at: new Date().toISOString() }, ...prev])
  }

  function normalizeValue(c: Cond): unknown {
    if (c.kind === 'question') {
      const q = questions.find(x => x.id === c.qid)
      if (q?.type === 'boolean') return c.value === 'true' || c.value === true
      if (c.op !== 'eq') return Number(c.value)
      return c.value
    }
    if (c.kind === 'gender' || c.op === 'attention' || c.kind === 'disease') return c.value
    return Number(c.value)
  }

  async function toggle(rule: Rule) {
    const res = await fetch(`/api/advice-rules/${rule.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !rule.active }),
    })
    if (res.ok) setRules(prev => prev.map(r => (r.id === rule.id ? { ...r, active: !r.active } : r)))
  }

  async function remove(rule: Rule) {
    if (!confirm(`Richtlijn "${rule.name}" verwijderen?`)) return
    const res = await fetch(`/api/advice-rules/${rule.id}`, { method: 'DELETE' })
    if (res.ok) setRules(prev => prev.filter(r => r.id !== rule.id))
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a1270]">
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? 'Annuleren' : 'Nieuwe richtlijn'}
        </button>
      </div>

      {showForm && (
        <div className="space-y-4 rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[#64748b]">Naam</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="bijv. LDL hoog + roker"
                className={`w-full ${inputCls}`} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[#64748b]">Domein (optioneel)</span>
              <select value={domain} onChange={e => setDomain(e.target.value)} className={`w-full ${inputCls}`}>
                <option value="">— geen —</option>
                {KNOWLEDGE_DOMAINS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </label>
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium text-[#64748b]">ALS — alle condities zijn waar:</span>
            <div className="space-y-2">
              {conds.map((c, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-[#f1f5f9] bg-[#f8fafc] p-2">
                  <select value={c.kind} className={inputCls}
                    onChange={e => setCond(i, { kind: e.target.value, code: undefined, qid: undefined, op: e.target.value === 'question' ? 'eq' : e.target.value === 'disease' ? 'elevated' : 'gt', value: '' })}>
                    <option value="biomarker">Biomarker</option>
                    <option value="question">Vragenlijst</option>
                    <option value="disease">Ziekterisico</option>
                    <option value="bmi">BMI</option>
                    <option value="age">Leeftijd</option>
                    <option value="gender">Geslacht</option>
                  </select>

                  {c.kind === 'biomarker' && (<>
                    <select value={c.code ?? ''} onChange={e => setCond(i, { code: e.target.value })} className={`max-w-56 ${inputCls}`}>
                      <option value="">— kies biomarker —</option>
                      {biomarkers.map(b => <option key={b.code} value={b.code}>{b.display_name}</option>)}
                    </select>
                    <select value={c.op} onChange={e => setCond(i, { op: e.target.value })} className={inputCls}>
                      {NUM_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      <option value="attention">wijkt af van optimaal</option>
                    </select>
                    {c.op !== 'attention' && (
                      <input type="number" step="any" value={String(c.value ?? '')} onChange={e => setCond(i, { value: e.target.value })}
                        placeholder="waarde" className={`w-24 ${inputCls}`} />
                    )}
                  </>)}

                  {c.kind === 'question' && (() => {
                    const q = questions.find(x => x.id === c.qid)
                    return (<>
                      <select value={c.qid ?? ''} onChange={e => setCond(i, { qid: e.target.value, op: 'eq', value: '' })} className={`max-w-72 ${inputCls}`}>
                        <option value="">— kies vraag —</option>
                        {questions.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                      </select>
                      {q && (q.type === 'scale' || q.type === 'rating_10') && (<>
                        <select value={c.op} onChange={e => setCond(i, { op: e.target.value })} className={inputCls}>
                          <option value="lte">score ≤</option>
                          <option value="gte">score ≥</option>
                        </select>
                        <input type="number" value={String(c.value ?? '')} onChange={e => setCond(i, { value: e.target.value })}
                          placeholder="score" className={`w-20 ${inputCls}`} />
                      </>)}
                      {q?.type === 'boolean' && (
                        <select value={String(c.value ?? '')} onChange={e => setCond(i, { op: 'eq', value: e.target.value })} className={inputCls}>
                          <option value="">— antwoord —</option>
                          <option value="true">ja</option>
                          <option value="false">nee</option>
                        </select>
                      )}
                      {(q?.type === 'radio' || q?.type === 'select') && (
                        <select value={String(c.value ?? '')} onChange={e => setCond(i, { op: 'eq', value: e.target.value })} className={`max-w-56 ${inputCls}`}>
                          <option value="">— antwoord —</option>
                          {q.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      )}
                    </>)
                  })()}

                  {c.kind === 'disease' && (
                    <select value={c.code ?? ''} onChange={e => setCond(i, { code: e.target.value })} className={`max-w-56 ${inputCls}`}>
                      <option value="">— kies risico —</option>
                      {DISEASES.map(d => <option key={d.value} value={d.value}>{d.label} verhoogd</option>)}
                    </select>
                  )}

                  {(c.kind === 'bmi' || c.kind === 'age') && (<>
                    <select value={c.op} onChange={e => setCond(i, { op: e.target.value })} className={inputCls}>
                      {NUM_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <input type="number" step="any" value={String(c.value ?? '')} onChange={e => setCond(i, { value: e.target.value })}
                      placeholder="waarde" className={`w-24 ${inputCls}`} />
                  </>)}

                  {c.kind === 'gender' && (
                    <select value={String(c.value ?? '')} onChange={e => setCond(i, { value: e.target.value })} className={inputCls}>
                      <option value="">— kies —</option>
                      <option value="man">man</option>
                      <option value="vrouw">vrouw</option>
                    </select>
                  )}

                  {conds.length > 1 && (
                    <button onClick={() => setConds(prev => prev.filter((_, idx) => idx !== i))}
                      className="ml-auto text-[#94a3b8] hover:text-red-500" title="Conditie verwijderen">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setConds(prev => [...prev, emptyCond()])}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#1f1683] hover:underline">
              <Plus size={12} /> Conditie toevoegen (ÉN)
            </button>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[#64748b]">DAN — instructie voor het advies</span>
            <textarea value={instruction} onChange={e => setInstruction(e.target.value)} rows={3}
              placeholder="bijv. Leg de nadruk op hart- en vaatgezondheid; adviseer stoppen met roken als eerste stap en verwijs naar de kennisbankfragmenten over rookstop."
              className={`w-full ${inputCls}`} />
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button onClick={save} disabled={busy || !name || !instruction}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a1270] disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <GitBranch size={14} />}
            Richtlijn opslaan
          </button>
        </div>
      )}

      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
        {rules.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[#94a3b8]">
            Nog geen richtlijnen. Maak de eerste aan — bijvoorbeeld: ALS LDL-cholesterol &gt; 3,0 ÉN roker DAN focus op hart- en vaatgezondheid.
          </p>
        ) : (
          <div className="divide-y divide-[#f1f5f9]">
            {rules.map(r => (
              <div key={r.id} className="flex items-start gap-3 px-5 py-3.5">
                <button onClick={() => toggle(r)} title={r.active ? 'Actief — klik om te pauzeren' : 'Gepauzeerd — klik om te activeren'}
                  className={`mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${r.active ? 'bg-[#17e4a1]' : 'bg-[#e2e8f0]'}`}>
                  <span className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${r.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[#1e293b]">{r.name}</span>
                    {r.domain && <span className="rounded-full border border-[#c7d7fd] bg-[#eef4ff] px-2 py-0.5 text-[10px] font-medium text-[#1f1683]">{DOMAIN_LABELS[r.domain] ?? r.domain}</span>}
                    {!r.active && <span className="text-[10px] font-medium uppercase tracking-wide text-[#94a3b8]">gepauzeerd</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-[#64748b]">
                    <b>ALS</b> {(r.conditions ?? []).map(c => condLabel(c, biomarkers, questions)).join(' ÉN ')}
                  </p>
                  <p className="mt-0.5 text-xs text-[#475569]"><b>DAN</b> {r.instruction}</p>
                </div>
                <button onClick={() => remove(r)} className="mt-0.5 shrink-0 text-[#94a3b8] hover:text-red-500" title="Verwijderen">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
