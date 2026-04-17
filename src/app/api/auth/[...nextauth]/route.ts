import NextAuth from "next-auth"
import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { getAuthSecret } from "@/lib/auth-secret"
import prisma from "@/lib/prisma"

const talentLoginDisabledForBeta = process.env.THERUM_BETA_PREVIEW_ONLY === "true"

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        console.log('[AUTH] authorize attempt:', credentials?.email)
        if (!credentials?.email || !credentials?.password) return null

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          })

          console.log('[AUTH] user found:', user ? 'YES' : 'NO')

          if (!user) return null
          if (!user.active) return null
          if (talentLoginDisabledForBeta && user.role === "TALENT") return null

          if (user.role !== 'SUPER_ADMIN' && user.agencyId) {
            const agency = await prisma.agency.findUnique({
              where: { id: user.agencyId },
              select: { active: true },
            })
            if (agency && !agency.active) return null
          }

          // In MVP, passwordHash is null meaning any password is accepted for seeded users
          if (user.passwordHash && user.passwordHash !== credentials.password) {
            console.log('[AUTH] password mismatch')
            return null
          }

          console.log('[AUTH] authorize success for:', user.email)

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            // Pass role via a custom field — NextAuth merges this into the token
            role: user.role,
          }
        } catch (err) {
          console.error('[AUTH] authorize error:', err)
          return null
        }
      }
    })
  ],
  pages: {
    signIn: '/login',
  },
  secret: getAuthSecret(),
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token["therum_role"] = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub
        ;(session.user as any).role = token["therum_role"]
      }
      return session
    }
  }
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
