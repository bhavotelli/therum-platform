import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { syncInvoiceFromXeroEvent } from '@/lib/xero-sync'
import { revalidatePath } from 'next/cache'
import { insertAdminAuditLog } from '@/lib/db/admin-audit-log'

type XeroWebhookEvent = {
  eventType?: string
  eventCategory?: string
  resourceId?: string
  tenantId?: string
}

type XeroWebhookPayload = {
  events?: XeroWebhookEvent[]
}

function verifyXeroSignature(rawBody: string, signatureHeader: string | null): boolean {
  const webhookKey = (process.env.XERO_WEBHOOK_KEY ?? process.env.XERO_WEBHOOK_SIGNING_KEY)?.trim()
  if (!webhookKey) {
    // Allow non-verified local development when key is missing.
    return true
  }
  const normalizedSignature = signatureHeader?.trim()
  if (!normalizedSignature) return false

  const digest = crypto.createHmac('sha256', webhookKey).update(rawBody).digest('base64')
  const toBase64 = (value: string) => {
    const standard = value.replace(/-/g, '+').replace(/_/g, '/')
    const padLength = standard.length % 4 === 0 ? 0 : 4 - (standard.length % 4)
    return standard + '='.repeat(padLength)
  }
  const expected = Buffer.from(toBase64(digest), 'base64')
  const provided = Buffer.from(toBase64(normalizedSignature), 'base64')
  if (expected.length !== provided.length) return false
  return crypto.timingSafeEqual(expected, provided)
}

export async function POST(req: Request) {
  const signature = req.headers.get('x-xero-signature')
  const rawBody = await req.text()
  const trimmedBody = rawBody.trim()
  const webhookKeyPresent = Boolean((process.env.XERO_WEBHOOK_KEY ?? process.env.XERO_WEBHOOK_SIGNING_KEY)?.trim())
  const allowInsecureWebhookInDev =
    process.env.NODE_ENV !== 'production' && process.env.XERO_WEBHOOK_ALLOW_INSECURE_DEV === 'true'

  const signatureValid = verifyXeroSignature(rawBody, signature)
  if (!signatureValid) {
    await insertAdminAuditLog({
      action: 'XERO_WEBHOOK_DIAGNOSTIC',
      targetType: 'XERO_WEBHOOK',
      targetId: null,
      metadata: {
        phase: 'signature_failed',
        signatureHeaderPresent: Boolean(signature?.trim()),
        webhookKeyPresent,
        bodyLength: rawBody.length,
      },
    })
    if (!allowInsecureWebhookInDev) {
      return new NextResponse('Invalid Xero signature', { status: 401 })
    }
  }

  // Some validation probes can arrive with an empty body; treat as successful intent receipt.
  if (trimmedBody.length === 0) {
    await insertAdminAuditLog({
      action: 'XERO_WEBHOOK_DIAGNOSTIC',
      targetType: 'XERO_WEBHOOK',
      targetId: null,
      metadata: {
        phase: 'empty_body_ack',
        signatureHeaderPresent: Boolean(signature?.trim()),
        webhookKeyPresent,
        bodyLength: rawBody.length,
      },
    })
    return new NextResponse('ok', { status: 200 })
  }

  let payload: XeroWebhookPayload
  try {
    payload = JSON.parse(trimmedBody) as XeroWebhookPayload
  } catch {
    // If signature is valid but payload is not JSON, acknowledge to avoid webhook validation failures.
    await insertAdminAuditLog({
      action: 'XERO_WEBHOOK_DIAGNOSTIC',
      targetType: 'XERO_WEBHOOK',
      targetId: null,
      metadata: {
        phase: 'non_json_ack',
        signatureHeaderPresent: Boolean(signature?.trim()),
        webhookKeyPresent,
        bodyLength: rawBody.length,
      },
    })
    return new NextResponse('ok', { status: 200 })
  }

  const events = payload.events ?? []

  const isIntentToReceive =
    events.length === 0 ||
    events.some((event) => String(event.eventType ?? '').toLowerCase() === 'intenttoreceive')
  if (isIntentToReceive) {
    await insertAdminAuditLog({
      action: 'XERO_WEBHOOK_DIAGNOSTIC',
      targetType: 'XERO_WEBHOOK',
      targetId: null,
      metadata: {
        phase: 'intent_ack',
        signatureHeaderPresent: Boolean(signature?.trim()),
        webhookKeyPresent,
        eventCount: events.length,
      },
    })
    return new NextResponse('ok', { status: 200 })
  }

  await insertAdminAuditLog({
    action: 'XERO_WEBHOOK_RECEIVED',
    targetType: 'XERO_WEBHOOK',
    targetId: null,
    metadata: {
      eventCount: events.length,
    },
  })

  for (const event of events) {
    if (!event.resourceId || !event.tenantId) continue
    if (String(event.eventCategory ?? '').toUpperCase() !== 'INVOICE') continue

    try {
      const result = await syncInvoiceFromXeroEvent({
        tenantId: event.tenantId,
        resourceId: event.resourceId,
      })
      await insertAdminAuditLog({
        action: 'XERO_WEBHOOK_PROCESSED',
        targetType: 'XERO_INVOICE',
        targetId: event.resourceId,
        metadata: {
          eventType: event.eventType,
          tenantId: event.tenantId,
        },
      })
      revalidatePath('/finance/overdue')
      revalidatePath('/finance/payouts')
      revalidatePath('/finance/dashboard')
      revalidatePath('/agency/pipeline')
      revalidatePath('/talent/deals')
      revalidatePath('/talent/dashboard')
      revalidatePath('/talent/earnings')
      revalidatePath('/talent/documents')
      if (result.talentId) {
        revalidatePath(`/talent/preview/${result.talentId}/dashboard`)
        revalidatePath(`/talent/preview/${result.talentId}/deals`)
        revalidatePath(`/talent/preview/${result.talentId}/earnings`)
        revalidatePath(`/talent/preview/${result.talentId}/documents`)
      }
    } catch (error) {
      console.error('[XERO WEBHOOK] Failed to process invoice event', {
        event,
        error,
      })
      await insertAdminAuditLog({
        action: 'XERO_WEBHOOK_FAILED',
        targetType: 'XERO_INVOICE',
        targetId: event.resourceId,
        metadata: {
          eventType: event.eventType,
          tenantId: event.tenantId,
          error: String(error),
        },
      })
    }
  }

  return new NextResponse('ok', { status: 200 })
}

// Basic health probe for webhook registration checks.
export async function GET() {
  return NextResponse.json({ ok: true })
}
