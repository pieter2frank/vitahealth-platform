import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guard'
import { extractDocumentText, extensionOf, isSupportedExtension, SUPPORTED_EXTENSIONS } from '@/lib/knowledge/extract'

// POST /api/knowledge/extract  (multipart/form-data, veld "file")
// Leest tekst uit een geüpload document zodat de curator die kan controleren
// vóór indexeren. Slaat niets op — retourneert alleen de geëxtraheerde tekst.

export const dynamic = 'force-dynamic'

const MAX_BYTES = 20 * 1024 * 1024 // 20 MB

export async function POST(req: Request) {
  const auth = await requireRole(['admin', 'arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let form: FormData
  try { form = await req.formData() }
  catch { return NextResponse.json({ error: 'Geen geldig formulier.' }, { status: 400 }) }

  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Geen bestand ontvangen.' }, { status: 400 })

  const ext = extensionOf(file.name)
  if (!isSupportedExtension(ext)) {
    return NextResponse.json(
      { error: `Bestandstype niet ondersteund. Toegestaan: ${SUPPORTED_EXTENSIONS.join(', ')}.` },
      { status: 400 },
    )
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Bestand is te groot (max. 20 MB).' }, { status: 400 })
  }

  try {
    const data = new Uint8Array(await file.arrayBuffer())
    const text = await extractDocumentText(file.name, data)
    if (!text.trim()) {
      return NextResponse.json({ error: 'Geen tekst gevonden in het document (mogelijk een scan zonder OCR).' }, { status: 422 })
    }
    return NextResponse.json({ ok: true, filename: file.name, text, chars: text.length })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Inlezen mislukt.' }, { status: 500 })
  }
}
