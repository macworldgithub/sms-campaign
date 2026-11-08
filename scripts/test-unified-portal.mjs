// Exercises the built Next app against a local stub. No real SMS, MongoDB or CRM calls.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { once } from 'node:events';
const require = createRequire(import.meta.url);
const token = 'x'.repeat(43), key = 'isolated-test-key-'.repeat(3);
let active = true, registrations = 0, saved;
const stub = createServer(async (req, res) => {
  let raw = ''; for await (const part of req) raw += part;
  const body = raw ? JSON.parse(raw) : {};
  const reply = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
  if (req.url === '/api/public/config') return reply(200, { active, offerName: 'Fixture offer', offerDetails: 'Test terms', eligibility: 'Existing customers', expiresAt: '2099-01-01T12:59:59Z', privateField: 'must-not-be-forwarded' });
  if (req.url === '/api/webhooks/leads') {
    assert.equal(req.headers['x-webhook-key'], key); assert.equal(body.requireActiveOffer, true);
    saved = body; registrations++; return reply(201, { id: '11111111-2222-4333-8444-555555555555' });
  }
  assert.equal(req.headers['x-portal-key'], key);
  if (req.url === '/api/auth/login') return reply(201, { token, user: { username: 'fixture', role: 'viewer' } });
  if (req.headers.authorization !== `Bearer ${token}`) return reply(401, { message: 'Sign in' });
  if (req.url === '/api/auth/me') return reply(200, { username: 'fixture', role: 'viewer' });
  if (req.url === '/api/auth/logout') return reply(201, { ok: true });
  return reply(404, { message: 'Not found' });
});
await new Promise(resolve => stub.listen(0, '127.0.0.1', resolve));
const backend = `http://127.0.0.1:${stub.address().port}`;
const reserve = createServer(); await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
const port = reserve.address().port; await new Promise(resolve => reserve.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], { env: { ...process.env, BACKEND_URL: backend, PORTAL_API_KEY: key, LEAD_WEBHOOK_KEY: key }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let log = ''; child.stdout.on('data', value => log += value); child.stderr.on('data', value => log += value);
const call = (path, options = {}) => fetch(origin + path, { redirect: 'manual', signal: AbortSignal.timeout(5000), ...options });
const cookieFor = (response, name) => response.headers.getSetCookie().find(value => value.startsWith(name + '='))?.split(';')[0];
const post = (path, value, cookie = '', requestOrigin = origin) => call(path, { method: 'POST', headers: { Origin: requestOrigin, Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try { if ((await call('/')).status === 200) { ready = true; break; } } catch {}
    if (child.exitCode !== null) throw new Error(log);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.equal(ready, true, log);
  const oldLoyalty = await call('/loyalty');
  assert.equal(oldLoyalty.status, 307);
  assert.equal(new URL(oldLoyalty.headers.get('location')).pathname, '/');
  assert.equal(new URL(oldLoyalty.headers.get('location')).searchParams.get('view'), 'customer');
  assert.equal((await call('/api/portal/me')).status, 401);
  const ref = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const config = await call('/api/loyalty/config?ref=' + ref);
  const offer = await config.json();
  assert.equal(offer.active, true); assert.equal(offer.privateField, undefined);
  assert.equal(config.headers.getSetCookie().some(value => value.startsWith('portal_session=')), false);
  const publicCookie = cookieFor(config, 'smh_loyalty_session') + '; ' + cookieFor(config, 'smh_campaign_ref');
  assert.equal((await call('/api/portal/me', { headers: { Cookie: publicCookie } })).status, 401);
  const input = { json: { firstName: 'Fixture', lastName: 'Customer', email: 'fixture@example.test', phone: '0412345678', existingCustomer: true, contactConsent: true } };
  assert.equal((await post('/api/trpc/campaign.enquire', input, publicCookie, 'https://wrong.example.test')).status, 403);
  assert.equal((await post('/api/trpc/campaign.enquire', { json: { ...input.json, contactConsent: false } }, publicCookie)).status, 400);
  const registered = await post('/api/trpc/campaign.enquire', input, publicCookie);
  assert.equal(registered.status, 200); assert.equal((await registered.json()).result.data.json.reference, 'SMH-11111111');
  assert.equal(registrations, 1); assert.equal(saved.token, ref);
  active = false;
  assert.equal((await post('/api/trpc/campaign.enquire', input, publicCookie)).status, 403); assert.equal(registrations, 1);
  const login = await post('/api/portal/login', { username: 'fixture', password: 'fixture password' });
  const staffCookie = cookieFor(login, 'portal_session');
  assert.ok(staffCookie); assert.equal((await login.json()).token, undefined);
  assert.ok(login.headers.get('set-cookie').includes('HttpOnly')); assert.ok(login.headers.get('set-cookie').includes('SameSite=strict'));
  assert.equal((await call('/api/portal/me', { headers: { Cookie: staffCookie } })).status, 200);
  assert.equal((await post('/api/portal/logout', {}, staffCookie, 'https://wrong.example.test')).status, 403);
  assert.equal((await post('/api/portal/logout', {}, staffCookie)).status, 201);
  const legacy = await call('/experience?ref=' + ref); assert.equal(legacy.status, 307); assert.equal(new URL(legacy.headers.get('location')).pathname, '/'); assert.equal(new URL(legacy.headers.get('location')).searchParams.get('view'), 'customer');
  assert.equal((await call('/assets/legacy.js')).status, 410);
  assert.equal((await call('/api/platform/config.js')).status, 410);
  console.log('Unified portal checks passed: public/staff session isolation, same-origin checks, consent, active offer, enquiry attribution, login/logout and legacy route handling.');
} finally {
  if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
  await new Promise(resolve => stub.close(resolve));
}
