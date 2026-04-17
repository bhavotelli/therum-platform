import { PlanTier, InvoicingModel, UserRole, DealStage, MilestoneStatus } from '@prisma/client'
import prisma from '../src/lib/prisma'

async function main() {
  console.log('Clearing the database...')
  
  // Delete all records in dependent order.
  // Note: agency deletion should cascade, but manual deletion is safer for seeds.

  
  await prisma.dealExpense.deleteMany()
  await prisma.manualCreditNote.deleteMany()
  await prisma.chaseNote.deleteMany()
  await prisma.invoiceTriplet.deleteMany()
  await prisma.milestone.deleteMany()
  await prisma.deal.deleteMany()
  await prisma.clientContact.deleteMany()
  await prisma.client.deleteMany()
  await prisma.talent.deleteMany()
  await prisma.session.deleteMany()
  await prisma.resetToken.deleteMany()
  await prisma.user.deleteMany()
  await prisma.agency.deleteMany()

  console.log('Creating Test Agency...')
  const agency = await prisma.agency.create({
    data: {
      name: 'Test Agency',
      slug: 'test-agency',
      planTier: PlanTier.BETA,
      commissionDefault: 20.00,
      invoicingModel: InvoicingModel.SELF_BILLING,
      vatRegistered: true,
    }
  })

  console.log('Creating Client and Talent...')
  const client = await prisma.client.create({
    data: {
      agencyId: agency.id,
      name: 'Acme Corp',
      paymentTermsDays: 30,
    }
  })

  const talent = await prisma.talent.create({
    data: {
      agencyId: agency.id,
      name: 'John Doe',
      email: 'john@example.com',
      commissionRate: 20.00,
      vatRegistered: true,
    }
  })

  console.log('Creating Users (Admin, Agent, Finance)...')
  await prisma.user.createMany({
    data: [
      {
        role: UserRole.SUPER_ADMIN,
        active: true,
        email: 'bhavik@therum.co',
        name: 'Bhav',
      },
      {
        agencyId: agency.id,
        role: UserRole.AGENCY_ADMIN,
        active: true,
        email: 'admin@testagency.com',
        name: 'Admin User',
      },
      {
        agencyId: agency.id,
        role: UserRole.AGENT,
        active: true,
        email: 'agent@testagency.com',
        name: 'Sarah Agent',
      },
      {
        agencyId: agency.id,
        role: UserRole.FINANCE,
        active: true,
        email: 'finance@testagency.com',
        name: 'James Finance',
      },
      {
        agencyId: agency.id,
        talentId: talent.id,
        role: UserRole.TALENT,
        active: true,
        email: 'talent@testagency.com',
        name: 'John Talent',
      },
    ]
  })


  console.log('Creating Deal and Milestones...')
  const deal = await prisma.deal.create({
    data: {
      agencyId: agency.id,
      clientId: client.id,
      talentId: talent.id,
      title: 'Summer Campaign',
      stage: DealStage.ACTIVE,
      commissionRate: 20.00,
      currency: 'GBP',
      milestones: {
        create: [
          {
            description: 'Deposit',
            grossAmount: 1500.00,
            invoiceDate: new Date('2026-05-01'),
            status: MilestoneStatus.INVOICED
          },
          {
            description: 'Production',
            grossAmount: 3000.00,
            invoiceDate: new Date('2026-06-01'),
            status: MilestoneStatus.COMPLETE
          },
          {
            description: 'Final Delivery',
            grossAmount: 500.00,
            invoiceDate: new Date('2026-07-01'),
            status: MilestoneStatus.PENDING
          }
        ]
      }
    }
  })

  console.log('Seed completed successfully.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
