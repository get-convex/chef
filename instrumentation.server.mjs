import * as Sentry from '@sentry/remix';

Sentry.init({
  dsn: 'https://16615d9875b4630cfabeed5d376c4343@o1192621.ingest.us.sentry.io/4509097600811008',
  tracesSampleRate: 1,
});
