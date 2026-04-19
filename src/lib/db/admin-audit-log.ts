import crypto from 'node:crypto'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import type { Json } from '@/types/database'

export async function insertAdminAuditLog(row: {
  actorUserId?: string | null
  action: string
  targetType: string
  targetId?: string | null
  metadata?: Json | null
}): Promise<void> {
  const db = getSupabaseServiceRole()
  const { error } = await db.from('AdminAuditLog').insert({
    id: crypto.randomUUID(),
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId ?? null,
    metadata: row.metadata ?? null,
    actorUserId: row.actorUserId ?? null,
  })
  if (error) throw error
}
