// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { enrichAxiosErrorEvent, isNextJsControlFlowError } from "./src/lib/sentry-filters";

Sentry.init({
  dsn: "https://dd8bad49697ceca582048ef9d2f0b054@o4511246082506752.ingest.de.sentry.io/4511246084800592",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Next.js redirect() and notFound() are control-flow, not real errors — drop them.
  // AxiosError values are rewritten so the message carries URL + status + body
  // instead of the useless default "Request failed with status code 400" (THE-54).
  beforeSend(event, hint) {
    if (isNextJsControlFlowError(hint?.originalException)) return null;
    return enrichAxiosErrorEvent(event, hint);
  },
});
