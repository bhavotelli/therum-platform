import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = `${process.env.DATABASE_URL}`

async function checkUser() {
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })
  
  const user = await prisma.user.findUnique({
    where: { email: 'admin@testagency.com' }
  })
  
  console.log('User found:', user)
  await prisma.$disconnect()
}

checkUser()
