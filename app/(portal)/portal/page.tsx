import Link from 'next/link'
import { ArrowRight, Droplets, Package, FlaskConical, ShieldCheck } from 'lucide-react'

const STEPS = [
  {
    icon: Package,
    title: 'Aanvragen',
    desc: 'Vul je gegevens in. Wij sturen je gratis een testkit op huis.',
    color: 'bg-[#eef4ff] text-[#1f1683]',
  },
  {
    icon: Droplets,
    title: 'Vingerprik',
    desc: 'Doe thuis een kleine vingerprik en stuur het buisje gratis retour.',
    color: 'bg-[#f0fdf9] text-[#04b788]',
  },
  {
    icon: FlaskConical,
    title: 'Resultaten',
    desc: 'Onze partner Nightingale Health analyseert je bloed. Je ontvangt je resultaten.',
    color: 'bg-[#fefce8] text-amber-600',
  },
]

const MARKERS = [
  'Cholesterol & vetten', 'Bloedsuiker (glucose)', 'Lever- en nierfunctie',
  'Ontstekingswaarden', 'Schildklierfunctie', 'Vitamine D & B12',
  'IJzer & ferritine', 'Hormoonprofiel',
]

export default function PortalHomePage() {
  return (
    <main>
      {/* Hero */}
      <section className="bg-gradient-to-b from-[#f0f4ff] to-white py-20 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#eef4ff] border border-[#c7d9ff] px-4 py-1.5 text-sm font-medium text-[#1f1683] mb-6">
            <ShieldCheck size={14} />
            Gecertificeerd laboratorium
          </div>
          <h1 className="text-4xl font-bold text-[#1e293b] leading-tight mb-4">
            Ontdek wat er in<br className="hidden sm:block" /> jouw bloed zit
          </h1>
          <p className="text-lg text-[#64748b] mb-8 max-w-xl mx-auto">
            Met de Vita Health biomarker test krijg je inzicht in meer dan 250 gezondheidswaarden.
            Thuis afnemen, snel resultaat.
          </p>
          <Link
            href="/portal/aanvragen"
            className="inline-flex items-center gap-2 rounded-xl bg-[#1f1683] px-8 py-4 text-base font-semibold text-white hover:bg-[#1a1270] transition-colors shadow-lg shadow-[#1f1683]/20"
          >
            Test gratis aanvragen
            <ArrowRight size={18} />
          </Link>
          <p className="text-sm text-[#94a3b8] mt-3">Geen verborgen kosten · Kit gratis verzonden</p>
        </div>
      </section>

      {/* Hoe het werkt */}
      <section className="py-16 px-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-[#1e293b] text-center mb-2">Hoe werkt het?</h2>
          <p className="text-center text-[#64748b] mb-10">Drie eenvoudige stappen naar jouw gezondheidsrapport.</p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={i} className="rounded-2xl border border-[#e2e8f0] p-6 relative">
                <div className="absolute -top-3 -left-3 h-7 w-7 rounded-full bg-[#1f1683] text-white text-xs font-bold flex items-center justify-center shadow">
                  {i + 1}
                </div>
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center mb-4 ${step.color}`}>
                  <step.icon size={22} />
                </div>
                <h3 className="font-semibold text-[#1e293b] mb-1">{step.title}</h3>
                <p className="text-sm text-[#64748b]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Biomarkers */}
      <section className="py-16 px-6 bg-[#f8fafc]">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-[#1e293b] text-center mb-2">Wat meten we?</h2>
          <p className="text-center text-[#64748b] mb-10">
            Nightingale Health analyseert meer dan 250 biomarkers met één druppel bloed.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {MARKERS.map((m) => (
              <div
                key={m}
                className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2.5"
              >
                <div className="h-2 w-2 rounded-full bg-[#17e4a1] shrink-0" />
                <span className="text-sm text-[#1e293b]">{m}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-[#e2e8f0] px-3 py-2.5 sm:col-span-4 justify-center">
              <span className="text-sm text-[#94a3b8]">+ 240 andere biomarkers</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-[#1e293b] mb-3">Klaar om te starten?</h2>
          <p className="text-[#64748b] mb-8">Vraag nu je testkit aan. Wij regelen de rest.</p>
          <Link
            href="/portal/aanvragen"
            className="inline-flex items-center gap-2 rounded-xl bg-[#17e4a1] px-8 py-4 text-base font-semibold text-[#041b70] hover:bg-[#04b788] transition-colors"
          >
            Test aanvragen
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </main>
  )
}
