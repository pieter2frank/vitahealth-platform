'use client'
import { useState, useEffect } from 'react'
import { Input } from './input'

// Datumveld met vast Nederlands formaat dd-mm-jjjj, onafhankelijk van de
// browser-locale (native <input type="date"> volgt de browsertaal en toont
// bij Engelse instellingen mm/dd/yyyy). Onder water wordt een ISO-datum
// (yyyy-mm-dd) doorgegeven, zodat de rest van de code ongewijzigd blijft.

function isoToNl(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}
function nlToIso(s: string): string | null {
  const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s.trim())
  if (!m) return null
  const dd = Number(m[1]), mm = Number(m[2])
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return null
  return `${m[3]}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

export function DateInput({ value, onChange, label, required, hint }: {
  value: string
  onChange: (iso: string) => void
  label?: string
  required?: boolean
  hint?: string
}) {
  const [text, setText] = useState(isoToNl(value))
  useEffect(() => { setText(isoToNl(value)) }, [value])

  const invalid = text.trim() !== '' && nlToIso(text) === null

  return (
    <Input
      label={label}
      required={required}
      hint={hint}
      type="text"
      inputMode="numeric"
      placeholder="dd-mm-jjjj"
      value={text}
      error={invalid ? 'Gebruik dd-mm-jjjj' : undefined}
      onChange={e => {
        const v = e.target.value
        setText(v)
        onChange(nlToIso(v) ?? '')
      }}
    />
  )
}
