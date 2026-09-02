// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { betaFeedbackResponse, validateFeedback } from './beta-feedback.js';

const valid = { kind: 'bug', message: 'Die Tabelle ist auf dem Handy zu breit.', email: '', page: '/racing/results', website: '' };
const request = (value = valid, headers = {}) => new Request('https://racevora.com/api/beta-feedback', {
  method: 'POST', headers: { Origin: 'https://racevora.com', 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', ...headers }, body: JSON.stringify(value),
});
const env = () => ({
  FEEDBACK_RECIPIENT: 'owner@example.com',
  FEEDBACK_EMAIL: { send: vi.fn().mockResolvedValue({ messageId: 'test-only' }) },
  FEEDBACK_RATE_LIMIT: { limit: vi.fn().mockResolvedValue({ success: true }) },
  FEEDBACK_GLOBAL_LIMIT: { limit: vi.fn().mockResolvedValue({ success: true }) },
});

describe('beta feedback endpoint', () => {
  it('reports readiness without exposing recipient config or secrets', async () => {
    expect(await (await betaFeedbackResponse(new Request('https://racevora.com/api/beta-feedback'), {})).json()).toEqual({ ready: false });
    expect(await (await betaFeedbackResponse(new Request('https://racevora.com/api/beta-feedback'), env())).json()).toEqual({ ready: true });
  });
  it('sends plain text only to the fixed recipient with an optional reply address', async () => {
    const environment = env();
    const result = await betaFeedbackResponse(request({ ...valid, email: 'visitor@example.com', to: 'attacker@example.com', message: '<script>alert(1)</script> Grüße 🏁' }), environment);
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ ok: true });
    expect(result.headers.get('Cache-Control')).toBe('no-store');
    expect(environment.FEEDBACK_EMAIL.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'owner@example.com', from: 'beta-feedback@racevora.com', replyTo: 'visitor@example.com' }));
    expect(environment.FEEDBACK_EMAIL.send.mock.calls[0][0]).not.toHaveProperty('html');
    expect(environment.FEEDBACK_EMAIL.send.mock.calls[0][0].text).toContain('Grüße 🏁');
  });
  it.each([
    { Origin: 'https://evil.example' }, { Origin: '' }, { 'Sec-Fetch-Site': 'cross-site' },
  ])('rejects cross-site requests %j', async (headers) => {
    const environment = env();
    expect((await betaFeedbackResponse(request(valid, headers), environment)).status).toBe(403);
    expect(environment.FEEDBACK_EMAIL.send).not.toHaveBeenCalled();
  });
  it('requires JSON and an operational sender and rejects other methods', async () => {
    expect((await betaFeedbackResponse(request(valid, { 'Content-Type': 'text/plain' }), env())).status).toBe(415);
    expect((await betaFeedbackResponse(request(), {})).status).toBe(503);
    expect((await betaFeedbackResponse(new Request('https://racevora.com/api/beta-feedback', { method: 'DELETE' }), env())).status).toBe(405);
  });
  it.each(['FEEDBACK_RATE_LIMIT', 'FEEDBACK_GLOBAL_LIMIT'])('stops mail on %s', async (key) => {
    const environment = env();
    environment[key].limit.mockResolvedValue({ success: false });
    const result = await betaFeedbackResponse(request(), environment);
    expect(result.status).toBe(429);
    expect(result.headers.get('Retry-After')).toBe('60');
    expect(environment.FEEDBACK_EMAIL.send).not.toHaveBeenCalled();
  });
  it('rejects malformed, oversized, and honeypot-filled payloads', async () => {
    const environment = env();
    expect((await betaFeedbackResponse(request({ ...valid, website: 'spam' }), environment)).status).toBe(400);
    expect((await betaFeedbackResponse(request({ ...valid, message: 'x'.repeat(21000) }), environment)).status).toBe(413);
    const broken = request();
    const invalidJson = new Request(broken.url, { method: 'POST', headers: broken.headers, body: '{' });
    expect((await betaFeedbackResponse(invalidJson, environment)).status).toBe(400);
    expect(environment.FEEDBACK_EMAIL.send).not.toHaveBeenCalled();
  });
  it('does not claim success or expose provider details on mail failure', async () => {
    const environment = env();
    environment.FEEDBACK_EMAIL.send.mockRejectedValue(new Error('Sensitive content'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await betaFeedbackResponse(request(), environment);
    expect(result.status).toBe(502);
    expect(await result.json()).toEqual({ error: 'delivery_failed' });
    expect(log).toHaveBeenCalledExactlyOnceWith('beta_feedback_delivery_failed');
    log.mockRestore();
  });
});

describe('feedback validation', () => {
  it.each([
    null, [], { ...valid, kind: '__proto__' }, { ...valid, kind: 'bad\r\nBcc: other@example.com' },
    { ...valid, email: 'a@example.com\r\nBcc: b@example.com' }, { ...valid, email: 'invalid' },
    { ...valid, message: '    ' }, { ...valid, message: 'a'.repeat(4001) },
    { ...valid, page: 'https://evil.example' }, { ...valid, page: '/profile?token=private' },
    { ...valid, page: '/login#access_token=private' }, { ...valid, page: '/profile\nSecret' },
  ])('rejects invalid payload %#', (value) => expect(validateFeedback(value)).toBeNull());
  it('allows an empty optional email', () => expect(validateFeedback(valid)).toMatchObject({ email: '', spam: false }));
});
