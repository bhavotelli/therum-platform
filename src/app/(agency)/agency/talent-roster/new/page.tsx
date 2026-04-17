import Link from 'next/link'
import { createTalent } from '../actions'

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
        <form action={createTalent} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-zinc-700">
            Talent Name
            <input
              name="name"
              required
              className="mt-1 block w-full rounded border border-zinc-200 px-3 py-2 text-sm text-zinc-800"
              placeholder="e.g. Zara Mitchell"
            />
          </label>
          <label className="text-sm font-semibold text-zinc-700">
            Email
            <input
              name="email"
              type="email"
              required
              className="mt-1 block w-full rounded border border-zinc-200 px-3 py-2 text-sm text-zinc-800"
              placeholder="zara@talentstudio.com"
            />
          </label>
          <label className="text-sm font-semibold text-zinc-700">
            Default Commission Rate (%)
            <input
              name="commissionRate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              required
              defaultValue="20"
              className="mt-1 block w-full rounded border border-zinc-200 px-3 py-2 text-sm text-zinc-800"
            />
          </label>
          <label className="text-sm font-semibold text-zinc-700">
            VAT Number (optional)
            <input
              name="vatNumber"
              className="mt-1 block w-full rounded border border-zinc-200 px-3 py-2 text-sm text-zinc-800"
              placeholder="GB123456789"
            />
          </label>

          <label className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-700">
            <input name="vatRegistered" type="checkbox" className="h-4 w-4 rounded border-zinc-300" />
            VAT registered
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-700">
            <input name="portalEnabled" type="checkbox" className="h-4 w-4 rounded border-zinc-300" />
            Enable talent portal access
          </label>

          <div className="md:col-span-2 pt-2">
            <button
              type="submit"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Create Talent
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
