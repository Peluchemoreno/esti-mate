import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  // Don’t spam Sentry in local dev unless you want to.
  if (!dsn) return;

  Sentry.init({
    dsn,
    debug: true,
    environment: import.meta.env.VITE_APP_ENV || import.meta.env.MODE,
    sendDefaultPii: true,
    release: import.meta.env.VITE_APP_VERSION,
    integrations: [new BrowserTracing(), Sentry.replayIntegration()],
    enableLogs: true,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    tracesSampleRate: 0.1, // start low in prod
  });
}

// Call this after you know the logged-in user
export function sentrySetUser(user) {
  if (!user) return;

  Sentry.setUser({ id: user._id, email: user.email });

  // Helpful tags for filtering issues later
  if (user.tier) Sentry.setTag("tier", user.tier);
  if (user.businessId) Sentry.setTag("businessId", user.businessId);
}
