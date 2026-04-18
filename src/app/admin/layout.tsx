export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
