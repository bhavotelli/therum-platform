import Link from 'next/link'
import NewTalentForm from './NewTalentForm'

export default function NewTalentPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/agency/talent-roster" className="text-xs font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-700">
          Back to roster
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900">Add Talent</h1>
        <p className="text-sm text-zinc-500">
          Agency portal is the source of truth for talent records. Create the record here, then sync/link in Finance.
        </p>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <NewTalentForm />
      </section>
    </div>
  )
}
