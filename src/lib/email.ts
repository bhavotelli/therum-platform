import nodemailer from 'nodemailer';
import { DEFAULT_PUBLIC_APP_ORIGIN } from '@/lib/site-origin';

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

function getBaseUrl() {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.APP_BASE_URL ||
    DEFAULT_PUBLIC_APP_ORIGIN
  );
}

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function verifyEmailTransport() {
  const transport = getTransport();
  if (!transport) {
    throw new Error('SMTP is not configured. Add SMTP_HOST, SMTP_USER, and SMTP_PASS.');
  }

  await transport.verify();
}

export async function sendEmail(payload: EmailPayload) {
  const transport = getTransport();
  const smtpHost = process.env.SMTP_HOST || '';
  const sendgridSender = process.env.SENDGRID_VERIFIED_SENDER;
  const from =
    smtpHost.includes('sendgrid.net')
      ? sendgridSender || process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@therum.local'
      : process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@therum.local';

  if (!transport) {
    // Dev-safe fallback so flows remain testable without SMTP setup.
    console.log('[EMAIL:FALLBACK]', { from, ...payload });
    return;
  }

  // Helpful runtime visibility while SMTP is being configured.
  console.log('[EMAIL:SEND]', { providerHost: smtpHost, from, to: payload.to, subject: payload.subject });

  await transport.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
}

export function buildSetPasswordLink(type: 'invite' | 'reset', token: string) {
  return `${getBaseUrl()}/auth/set-password?type=${type}&token=${token}`;
}

export async function sendInviteEmail(to: string, link: string) {
  const subject = 'Therum invite: set your password';
  await sendEmail({
    to,
    subject,
    text: `You have been invited to Therum. Set your password using this link: ${link}`,
    html: `<p>You have been invited to Therum.</p><p><a href="${link}">Set your password</a></p>`,
  });
}

export async function sendPasswordResetEmail(to: string, link: string) {
  const subject = 'Therum password reset';
  await sendEmail({
    to,
    subject,
    text: `A password reset was requested for your Therum account. Use this link: ${link}`,
    html: `<p>A password reset was requested for your Therum account.</p><p><a href="${link}">Reset your password</a></p>`,
  });
}
