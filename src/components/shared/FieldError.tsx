export const errorInputClasses = 'border-red-300 focus:ring-red-500 focus:border-red-500'

export function FieldError({ id, message }: { id?: string; message: string | null | undefined }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="mt-1 text-xs text-red-600">
      {message}
    </p>
  )
}
