'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { markMilestoneComplete } from './actions'

export default function MarkCompleteButton({ milestoneId }: { milestoneId: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => {
        startTransition(async () => {
          try {
            await markMilestoneComplete(milestoneId)
            toast.success('Milestone marked complete')
          } catch (error) {
            console.error('Failed to mark milestone complete:', error)
            toast.error(
              error instanceof Error
                ? error.message
                : 'Failed to mark complete. Please try again.'
            )
          }
        })
      }}
      disabled={isPending}
      className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white ${
        isPending ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
      } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ml-4`}
    >
      {isPending ? 'Processing...' : 'Mark Complete'}
    </button>
  )
}
