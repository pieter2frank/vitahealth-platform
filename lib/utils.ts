import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import { nl } from 'date-fns/locale'
import type { TestkitStatus } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined) {
  if (!date) return '—'
  return format(new Date(date), 'd MMM yyyy', { locale: nl })
}

export function formatDateTime(date: string | Date | null | undefined) {
  if (!date) return '—'
  return format(new Date(date), 'd MMM yyyy, HH:mm', { locale: nl })
}

export function formatRelative(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: nl })
}

export const STATUS_LABELS: Record<TestkitStatus, string> = {
  received:         'Ontvangen',
  assigned:         'Toegewezen',
  retour:           'Retour',
  sent_nightingale: 'Verzonden NHG',
  results_available:'Resultaten',
}

export const STATUS_COLORS: Record<TestkitStatus, string> = {
  received:         'bg-orange-100 text-orange-700 border-orange-200',
  assigned:         'bg-blue-100 text-blue-700 border-blue-200',
  retour:           'bg-purple-100 text-purple-700 border-purple-200',
  sent_nightingale: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  results_available:'bg-green-100 text-green-700 border-green-200',
}
