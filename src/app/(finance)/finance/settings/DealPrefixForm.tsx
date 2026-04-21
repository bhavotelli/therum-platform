'use client'

import { useActionState, useState } from 'react'
import { updateDealNumberPrefix } from './actions'

type State = { error?: string; submitted?: string }

const initialState: State = {}

export function DealPrefixForm() {
  const [inputValue, setInputValue] = useState('')

  const [state, formAction, isPending] = useActionState(
    async (_prev: State, formData: FormData): Promise<State> => {
      const submitted = String(formData.get('dealNumberPrefix') ?? '').trim().toUpperCase()
      try {
        const result = await updateDealNumberPrefix(formData)
        // On success (no error) revalidatePath will re-render the page to the
        // locked state — the form unmounts, so no reset needed.
        return result.error ? { error: result.error, submitted } : {}
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : 'An unexpected error occurred.',
          submitted,
        }
      }
    },
    initialState,
  )

  // Restore the last-submitted value into the input after a failed attempt
  // so the user doesn't have to retype their prefix.
  const displayValue = state?.submitted ?? inputValue

  return (
    <form action={formAction} className="flex items-end gap-4">
      <div className="flex-1 max-w-xs">
        <label
          htmlFor="dealNumberPrefix"
          className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2"
        >
          Agency Prefix
        </label>
        <input
          id="dealNumberPrefix"
          name="dealNumberPrefix"
          type="text"
          value={displayValue}
          onChange={(e) => setInputValue(e.target.value.toUpperCase())}
          minLength={2}
          maxLength={4}
          placeholder="e.g. TH"
          autoComplete="organization"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-mono font-semibold text-gray-900 uppercase placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition"
        />
        {state?.error ? (
          <p role="alert" className="mt-1.5 text-[11px] text-red-500 font-medium">
            {state.error}
          </p>
        ) : (
          <p className="mt-1.5 text-[11px] text-gray-400">
            2–4 uppercase letters. Must be unique. Cannot be changed once set.
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all duration-150"
      >
        {isPending ? 'Saving…' : 'Save Prefix'}
      </button>
    </form>
  )
}
