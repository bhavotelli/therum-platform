'use client'

import { useActionState, useState } from 'react'
import { updateDealNumberPrefix, type DealPrefixActionResult } from './actions'

type State = DealPrefixActionResult

const initialState: State = {}

export function DealPrefixForm() {
  const [inputValue, setInputValue] = useState('')

  const [state, formAction, isPending] = useActionState(
    async (_prev: State, formData: FormData): Promise<State> => {
      const submitted = String(formData.get('dealNumberPrefix') ?? '').trim()
      // Server action handles all validation and DB errors; always returns { error? }.
      // On success revalidatePath causes the server component to re-render,
      // showing the locked state — this form unmounts, no reset needed.
      const result = await updateDealNumberPrefix(formData)
      if (result.error) {
        // Keep showing what the user typed alongside the error message.
        setInputValue(submitted)
      }
      return result
    },
    initialState,
  )

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
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4))}
          required
          minLength={2}
          maxLength={4}
          pattern="[A-Za-z]{2,4}"
          title="2–4 uppercase letters only"
          placeholder="e.g. TH"
          disabled={isPending}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-mono font-semibold text-gray-900 uppercase placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition disabled:opacity-50"
        />
        {state?.error ? (
          <p role="alert" className="mt-1.5 text-[11px] text-red-500 font-medium">
            {state.error}
          </p>
        ) : (
          <p className="mt-1.5 text-[11px] text-gray-400">
            2–4 uppercase letters (A–Z) only. Must be unique. Cannot be changed once set.
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
