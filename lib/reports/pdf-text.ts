// PDF → regels per pagina, met positie-gebaseerde reconstructie.
// Groepeert tekst-items op y-baseline en sorteert op x, zodat de nette tabellen
// in het Nightingale-rapport betrouwbaar als regels terugkomen.
//
// pdfjs-dist is server-side; zie serverExternalPackages in next.config.ts.

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

export async function pdfToPageLines(data: Uint8Array): Promise<string[][]> {
  const doc = await getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise
  const pages: string[][] = []

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()

    const rows = new Map<number, { x: number; s: string }[]>()
    for (const it of tc.items) {
      if (!('str' in it) || !it.str.trim()) continue
      const y = Math.round(it.transform[5])
      if (!rows.has(y)) rows.set(y, [])
      rows.get(y)!.push({ x: it.transform[4], s: it.str })
    }

    const lines = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])                               // boven → onder
      .map(([, arr]) =>
        arr.sort((a, b) => a.x - b.x).map(o => o.s).join(' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean)

    pages.push(lines)
  }

  return pages
}
