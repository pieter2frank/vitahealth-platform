'use client'
import { useState, useEffect } from 'react'

/**
 * Datumveld met gegarandeerd dd/mm/jjjj-weergave, onafhankelijk van de
 * browser-locale. Slaat de waarde intern op als ISO (yyyy-mm-dd) zodat de
 * rest van de applicatie (berekeningen, database) ongewijzigd blijft.
 */

function isoToNL(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

function nlToIso(text: string): string {
  const digits = text.replace(/\D/g, '')
  if (digits.length !== 8) return ''
  const dd = digits.slice(0, 2)
  const mm = digits.slice(2, 4)
  const yyyy = digits.slice(4)
  const d = Number(dd), mo = Number(mm), y = Number(yyyy)
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return ''
  // Echte datumvalidatie (bv. 31/02 afvangen)
  const dt = new Date(`${yyyy}-${mm}-${dd}T00:00:00`)
  if (dt.getMonth() + 1 !== mo || dt.getDate() !== d) return ''
  return `${yyyy}-${mm}-${dd}`
}

interface Props {
  value: string                      // ISO yyyy-mm-dd of ''
  onChange: (iso: string) => void
  className?: string
  placeholder?: string
}

export function DateFieldNL({ value, onChange, className, placeholder = 'dd/mm/jjjj' }: Props) {
  const [text, setText] = useState(() => isoToNL(value))

  // Externe wijziging van value (bijv. voorinvullen) synchroniseren,
  // zonder lopende invoer te overschrijven.
  useEffect(() => {
    if (nlToIso(text) !== value) setText(isoToNL(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8)
    let out = digits
    if (digits.length >= 5)      out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
    else if (digits.length >= 3) out = `${digits.slice(0, 2)}/${digits.slice(2)}`
    setText(out)
    onChange(nlToIso(out))
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onChange={handleChange}
      placeholder={placeholder}
      maxLength={10}
      className={className}
    />
  )
}
