'use client'
import { forwardRef } from 'react'
import DatePicker, { registerLocale } from 'react-datepicker'
import { nl } from 'date-fns/locale'
import { Input, type InputProps } from './input'
import 'react-datepicker/dist/react-datepicker.css'

// Datumveld met kalender-picker én vast Nederlands formaat dd-mm-jjjj,
// onafhankelijk van de browser-locale. Geeft onder water een ISO-datum
// (yyyy-mm-dd) door, zodat de rest van de code ongewijzigd blijft.

registerLocale('nl', nl)

function isoToDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}
function dateToIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// react-datepicker geeft z'n props (value, onClick, onChange, …) door aan het
// customInput; we hergebruiken het bestaande Input-component voor de styling.
const PickerField = forwardRef<HTMLInputElement, InputProps>(function PickerField(props, ref) {
  return <Input ref={ref} autoComplete="off" {...props} />
})

export function DateInput({ value, onChange, label, required, hint }: {
  value: string
  onChange: (iso: string) => void
  label?: string
  required?: boolean
  hint?: string
}) {
  return (
    <DatePicker
      selected={isoToDate(value)}
      onChange={(d) => onChange(d ? dateToIso(d) : '')}
      dateFormat="dd-MM-yyyy"
      locale="nl"
      placeholderText="dd-mm-jjjj"
      showPopperArrow={false}
      portalId="datepicker-portal"
      wrapperClassName="block w-full"
      customInput={<PickerField label={label} required={required} hint={hint} />}
    />
  )
}
