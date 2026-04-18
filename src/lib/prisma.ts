import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { getDatabaseUrl } from './database-url'

const connectionString = getDatabaseUrl()

const prismaClientSingleton = () => {
  const pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 30_000,
    idleTimeoutMillis: 10_000,
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
