import prisma from '@/lib/prisma'
import NewDealForm from './NewDealForm'
import Link from 'next/link'

export default async function NewDealPage() {
  // 1. Fetch the first agency (mocked tenant for MVP)
  const agency = await prisma.agency.findFirst({
    select: {
      id: true,
    },
  })
  
  if (!agency) {
    return (
      <div className="flex items-center justify-center p-20 bg-white border-2 border-dashed border-gray-200 rounded-3xl">
        <p className="text-gray-500">No agency found. Please seed the database.</p>
      </div>
    )
  }

  // 2. Fetch clients and talents for the agency
  const [clientsRaw, talentsRaw] = await Promise.all([
    prisma.client.findMany({ 
      where: { agencyId: agency.id },
      orderBy: { name: 'asc' }
    }),
    prisma.talent.findMany({ 
      where: { agencyId: agency.id },
      orderBy: { name: 'asc' }
    })
  ])

  // Fix serialization: decimal objects are not supported in client components
  const clients = clientsRaw.map(c => ({ id: c.id, name: c.name }));
  const talents = talentsRaw.map(t => ({ id: t.id, name: t.name }));

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/deals" className="hover:text-indigo-600 transition-colors">Deals</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">New Deal</span>
      </nav>

      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-[#1A244E] tracking-tight">
          Create New Deal
        </h1>
        <p className="mt-2 text-gray-500">
          Enter the campaign details and define the billing milestones.
        </p>
      </div>

      {/* The Form */}
      <NewDealForm 
        agencyId={agency.id} 
        clients={clients} 
        talents={talents} 
      />
    </div>
  )
}
