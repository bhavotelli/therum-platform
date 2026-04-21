// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://dd8bad49697ceca582048ef9d2f0b054@o4511246082506752.ingest.de.sentry.io/4511246084800592",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Next.js redirect() and notFound() work by throwing special internal errors with a
  // digest prefix. They are control-flow, not real errors — drop them before they reach Sentry.
  beforeSend(event, hint) {
    const err = hint?.originalException;
    if (
      err !== null &&
      typeof err === "object" &&
      "digest" in err &&
      typeof (err as { digest?: unknown }).digest === "string" &&
      /^NEXT_(REDIRECT|NOT_FOUND)/.test((err as { digest: string }).digest)
    ) {
      return null;
    }
    return event;
  },
});
