import Link from 'next/link'
import { CheckCircle2, Package, Clock, Mail } from 'lucide-react'

export default function BevestigingPage() {
  return (
    <main className="py-16 px-6">
      <div className="mx-auto max-w-lg text-center">
        {/* Succes icoon */}
        <div className="flex justify-center mb-6">
          <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 size={40} className="text-green-600" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-[#1e293b] mb-2">Aanvraag ontvangen!</h1>
        <p className="text-[#64748b] mb-10">
          Bedankt voor je aanvraag. We hebben je gegevens ontvangen en gaan zo snel mogelijk voor je aan de slag.
        </p>

        {/* Wat nu? */}
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm text-left mb-8">
          <h2 className="font-semibold text-[#1e293b] mb-4">Wat gebeurt er nu?</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#eef4ff] flex items-center justify-center shrink-0">
                <Mail size={15} className="text-[#1f1683]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#1e293b]">Bevestiging per e-mail</p>
                <p className="text-xs text-[#64748b] mt-0.5">Je ontvangt een bevestiging op het door jou opgegeven e-mailadres.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#f0fdf9] flex items-center justify-center shrink-0">
                <Package size={15} className="text-[#04b788]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#1e293b]">Testkit wordt opgestuurd</p>
                <p className="text-xs text-[#64748b] mt-0.5">Wij sturen je binnen 2-3 werkdagen een testkit op naar jouw adres.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#fefce8] flex items-center justify-center shrink-0">
                <Clock size={15} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#1e293b]">Resultaten binnen 2 weken</p>
                <p className="text-xs text-[#64748b] mt-0.5">Na ontvangst van je kit sturen we het door naar ons laboratorium. Resultaten volgen.</p>
              </div>
            </div>
          </div>
        </div>

        <Link
          href="/portal"
          className="text-sm text-[#1f1683] hover:underline"
        >
          ← Terug naar de homepage
        </Link>
      </div>
    </main>
  )
}
