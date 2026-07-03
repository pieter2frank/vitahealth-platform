// Tekst-extractie uit geüploade documenten voor de kennisbank.
// Ondersteunt: pdf, docx, txt, markdown (md), rtf.
// Server-only (pdfjs/mammoth); nooit importeren in client-code.

import { pdfToPageLines } from '@/lib/reports/pdf-text'

export const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md', 'markdown', 'rtf'] as const

export function extensionOf(filename: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(filename.trim())
  return m ? m[1].toLowerCase() : ''
}

export function isSupportedExtension(ext: string): boolean {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)
}

// Ruwe RTF → platte tekst. Minimalistische stripper: verwijdert control-words,
// negeerbare groepen (fonttbl/colortbl/…) en zet \par/\line/\tab om naar witruimte.
function rtfToText(rtf: string): string {
  let s = rtf
  // Negeerbare destinations volledig verwijderen ({\*\... ... })
  s = s.replace(/\{\\\*[^{}]*\}/g, '')
  // Alinea-/regel-/tab-commando's naar witruimte
  s = s.replace(/\\par[d]?\b/g, '\n').replace(/\\line\b/g, '\n').replace(/\\tab\b/g, '\t')
  // Hex-escapes (\'e9 → é benaderd; we laten de byte vallen als niet-ascii lastig is)
  s = s.replace(/\\'([0-9a-fA-F]{2})/g, (_m, h) => {
    const code = parseInt(h, 16)
    return code >= 32 && code < 127 ? String.fromCharCode(code) : ''
  })
  // Unicode-escapes \uNNNN
  s = s.replace(/\\u(-?\d+)\??/g, (_m, n) => {
    const code = parseInt(n, 10)
    return code > 0 ? String.fromCharCode(code) : ''
  })
  // Overige control-words en -symbolen weg
  s = s.replace(/\\[a-zA-Z]+-?\d* ?/g, '').replace(/\\[^a-zA-Z]/g, '')
  // Groepshaken weg
  s = s.replace(/[{}]/g, '')
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

// Normaliseer whitespace zonder alinea-structuur te verliezen.
function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function extractDocumentText(filename: string, data: Uint8Array): Promise<string> {
  const ext = extensionOf(filename)

  if (ext === 'pdf') {
    const pages = await pdfToPageLines(data)
    return tidy(pages.map(lines => lines.join('\n')).join('\n\n'))
  }

  if (ext === 'docx') {
    // mammoth verwacht een Node Buffer.
    const mammoth = (await import('mammoth')).default
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(data) })
    return tidy(value ?? '')
  }

  if (ext === 'rtf') {
    return rtfToText(Buffer.from(data).toString('utf8'))
  }

  if (ext === 'txt' || ext === 'md' || ext === 'markdown') {
    return tidy(Buffer.from(data).toString('utf8'))
  }

  throw new Error(`Bestandstype .${ext || '?'} wordt niet ondersteund.`)
}
