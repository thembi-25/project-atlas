import twilioSdk from 'twilio';

/**
 * Lazily-constructed Twilio SDK client, per ADR-017/ADR-019.
 * `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` are anticipated-but-not-yet-
 * configured environment variables in this sandbox (see .env.example) —
 * mirrors `stripe/client.ts` and `resend/client.ts`.
 */
let cachedClient: ReturnType<typeof twilioSdk> | undefined;

export function getTwilioClient(): ReturnType<typeof twilioSdk> {
  if (cachedClient) return cachedClient;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error(
      'TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN are not configured. Set them in the environment before calling any @atlas/integrations Twilio function.',
    );
  }

  cachedClient = twilioSdk(accountSid, authToken);
  return cachedClient;
}

/** Test-only: clears the cached client so tests can swap env vars between cases. */
export function resetTwilioClientForTests(): void {
  cachedClient = undefined;
}
