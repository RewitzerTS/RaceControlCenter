const SENDER = 'beta-feedback@racevora.com';
const MAX_BYTES = 20_000;
const KINDS = { bug: 'Fehler', idea: 'Verbesserungsvorschlag', other: 'Sonstiges' };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', ...(status === 429 ? { 'Retry-After': '60' } : {}),
  } });
}

async function readLimitedJson(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BYTES) throw new Error('too_large');
  if (!request.body) throw new Error('invalid');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let text = '', length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) { await reader.cancel(); throw new Error('too_large'); }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { reader.releaseLock(); }
}

export function validateFeedback(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { kind, message, email, page, website } = value;
  if (typeof kind !== 'string' || !Object.hasOwn(KINDS, kind) || typeof message !== 'string' || message.trim().length < 5 || message.length > 4000) return null;
  if (typeof email !== 'string' || email.length > 254 || (email.trim() && !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(email.trim()))) return null;
  if (typeof page !== 'string' || page.length > 200 || !/^\/[a-zA-Z0-9/_-]*$/.test(page)) return null;
  if (typeof website !== 'string' || website.length > 200) return null;
  return { kind, message: message.trim(), email: email.trim(), page, spam: Boolean(website) };
}

/** Anonymous, fixed-recipient beta feedback. No account data or message bodies are logged. */
export async function betaFeedbackResponse(request, environment) {
  const recipient = environment.FEEDBACK_RECIPIENT;
  const ready = Boolean(typeof recipient === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) && environment.FEEDBACK_EMAIL && environment.FEEDBACK_RATE_LIMIT && environment.FEEDBACK_GLOBAL_LIMIT);
  if (request.method === 'GET') return json({ ready });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  // No CORS grant: other sites cannot use the form as an email relay.
  if (request.headers.get('Origin') !== new URL(request.url).origin || !['same-origin', null].includes(request.headers.get('Sec-Fetch-Site'))) return json({ error: 'forbidden' }, 403);
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return json({ error: 'invalid_content_type' }, 415);
  if (!ready) return json({ error: 'unavailable' }, 503);
  try {
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip) return json({ error: 'unavailable' }, 503);
    if (!(await environment.FEEDBACK_RATE_LIMIT.limit({ key: ip })).success) return json({ error: 'rate_limited' }, 429);
    let value;
    try { value = await readLimitedJson(request); }
    catch (error) { return json({ error: 'invalid_request' }, error.message === 'too_large' ? 413 : 400); }
    const feedback = validateFeedback(value);
    if (!feedback) return json({ error: 'invalid_request' }, 400);
    if (feedback.spam) return json({ error: 'invalid_request' }, 400);
    if (!(await environment.FEEDBACK_GLOBAL_LIMIT.limit({ key: 'beta-feedback' })).success) return json({ error: 'rate_limited' }, 429);
    // Recipient is a server secret; neither address is supplied by the browser.
    await environment.FEEDBACK_EMAIL.send({
      from: SENDER, to: recipient,
      subject: `[RaceVora Beta] ${KINDS[feedback.kind]}`,
      ...(feedback.email ? { replyTo: feedback.email } : {}),
      text: `Beta-Feedback\n\nThema: ${KINDS[feedback.kind]}\nSeite: https://racevora.com${feedback.page}\nAntwortadresse: ${feedback.email || 'Nicht angegeben'}\n\n--- Nachricht ---\n${feedback.message}`,
    });
    return json({ ok: true });
  } catch {
    // Do not log provider errors: they may contain a user's email or message.
    console.error('beta_feedback_delivery_failed');
    return json({ error: 'delivery_failed' }, 502);
  }
}
