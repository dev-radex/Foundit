import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, query, first, raw } from './mock-db.mjs';
import { setUser } from './mock-auth.mjs';
import { GET, POST } from '../app/api/data/route.ts';
import { GET as fileGET } from '../app/api/files/[id]/route.ts';
import { matchScore, canTransition } from '../lib/domain.ts';
import { safeReturnPath } from '../lib/redirect.ts';
beforeEach(async () => {
  await resetDb();
  setUser(null);
  delete process.env.FOUNDIT_OWNER_ID;
});
async function login(id, role = 'member') {
  setUser({ userId: id, fullName: id, email: id + '@test.invalid' });
  const r = await GET(new Request('https://test.local/api/data'));
  assert.equal(r.status, 200, JSON.stringify(await r.clone().json()));
  if (role !== 'member') await query('UPDATE users SET role=? WHERE id=?', role, id);
}
async function post(action, p = {}) {
  const r = await POST(
    new Request('https://test.local/api/data', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://test.local' },
      body: JSON.stringify({ action, ...p }),
    }),
  );
  return { status: r.status, ...(await r.json()) };
}
async function report(type = 'found') {
  return post('report', {
    type,
    title: 'Blue backpack',
    description: 'Blue canvas backpack',
    category: 'Bags & Backpacks',
    location: 'Main Library',
    date: '2026-01-01',
    private_note: 'Secret serial 123',
  });
}
test('anonymous cannot write and public output excludes secrets', async () => {
  assert.equal((await post('report')).status, 401);
  await login('finder');
  assert.equal((await report()).status, 200);
  setUser(null);
  const d = await (await GET(new Request('https://test.local/api/data'))).json();
  assert.equal(d.reports.length, 1);
  assert.equal(d.reports[0].owner, undefined);
  assert.equal(d.reports[0].private_note, undefined);
});
test('member cannot escalate privileges or read admin data', async () => {
  await login('member');
  assert.equal((await post('admin.user', { id: 'member', role: 'admin' })).status, 403);
  await post('profile', { name: 'New name', affiliation: 'Student', role: 'super-admin' });
  assert.equal((await first('SELECT role FROM users')).role, 'member');
  assert.equal((await GET(new Request('https://test.local/api/data?mode=admin'))).status, 403);
});
test('PostgreSQL claim, private conversation and recovery transaction', async () => {
  await login('finder');
  const r = await report();
  await login('claimant');
  const c = await post('claim', {
    report: r.id,
    reason: 'I left it there',
    features: 'Inner stitching',
    answer: 'Secret serial',
  });
  assert.equal(c.status, 200, c.error);
  const claim = await first('SELECT * FROM claims');
  assert.equal(
    (await post('message', { conversation: c.id, body: 'Meet at the library?' })).status,
    200,
  );
  await login('outsider');
  assert.equal(
    (await GET(new Request('https://test.local/api/data?mode=conversation&id=' + c.id))).status,
    403,
  );
  assert.equal((await post('claimState', { id: claim.id, status: 'approved' })).status, 400);
  const outsider = await (await GET(new Request('https://test.local/api/data'))).json();
  assert.equal(outsider.reports[0].private_note, '');
  assert.equal(outsider.claims.length, 0);
  await login('finder');
  assert.equal((await post('claimState', { id: claim.id, status: 'approved' })).status, 200);
  assert.equal((await post('claimState', { id: claim.id, status: 'recovered' })).status, 200);
  assert.equal((await first('SELECT status FROM reports')).status, 'recovered');
  assert.equal((await post('claimState', { id: claim.id, status: 'approved' })).status, 400);
});
test('duplicate and competing accepted claims are rejected by database constraints', async () => {
  await login('finder');
  const r = await report();
  await login('a');
  assert.equal(
    (await post('claim', { report: r.id, reason: 'Mine', features: 'Mark' })).status,
    200,
  );
  assert.equal(
    (await post('claim', { report: r.id, reason: 'Mine', features: 'Mark' })).status,
    400,
  );
  await login('b');
  await post('claim', { report: r.id, reason: 'Mine', features: 'Mark' });
  const c = await query('SELECT * FROM claims ORDER BY claimant');
  await login('finder');
  assert.equal((await post('claimState', { id: c[0].id, status: 'approved' })).status, 200);
  assert.equal((await post('claimState', { id: c[1].id, status: 'approved' })).status, 400);
  await assert.rejects(
    query("UPDATE claims SET status='approved' WHERE id=?", c[1].id),
    /unique constraint/,
  );
});
test('blocking prevents messages and claims', async () => {
  await login('finder');
  const r = await report();
  await login('a');
  const c = await post('conversation', { report: r.id });
  await login('finder');
  await post('block', { target: 'a' });
  await login('a');
  assert.equal((await post('message', { conversation: c.id, body: 'Hello' })).status, 400);
  assert.equal(
    (await post('claim', { report: r.id, reason: 'Mine', features: 'Mark' })).status,
    400,
  );
});
test('admin decisions are audited and role assignment requires super-admin', async () => {
  await login('member');
  await login('admin', 'admin');
  assert.equal((await post('admin.user', { id: 'member', role: 'admin' })).status, 400);
  assert.equal((await post('admin.user', { id: 'member', suspended: true })).status, 200);
  assert.equal(Number((await first('SELECT count(*) n FROM audit')).n), 1);
  await login('owner', 'super-admin');
  assert.equal((await post('admin.user', { id: 'admin', role: 'member' })).status, 200);
});
test('matching and claim state boundaries', () => {
  const a = {
    type: 'lost',
    title: 'Blue bag',
    description: 'Canvas backpack',
    category: 'Bags',
    location: 'Library',
    date: '2026-01-01',
    status: 'open',
  };
  assert.equal(matchScore(a, { ...a, type: 'found' }), 100);
  assert.equal(matchScore(a, a), 0);
  assert.equal(matchScore(a, { ...a, type: 'found', status: 'recovered' }), 0);
  assert.equal(canTransition('pending', 'recovered'), false);
  assert.equal(canTransition('approved', 'recovered'), true);
});
test('verification requires owned evidence and notifies the member', async () => {
  await login('member');
  assert.equal((await post('verification', { document: 'nonexistent' })).status, 400);
  await query(
    'INSERT INTO files(id,owner,purpose,mime,size,created) VALUES(?,?,?,?,?,?)',
    'doc',
    'member',
    'verification',
    'image/png',
    100,
    '2026-01-01',
  );
  assert.equal((await post('verification', { document: 'doc' })).status, 200);
  assert.equal((await post('verification', { document: 'doc' })).status, 400);
  const v = await first('SELECT id FROM verifications');
  await login('admin', 'admin');
  assert.equal(
    (await post('admin.verify', { id: v.id, status: 'verified', note: 'Matches affiliation' }))
      .status,
    200,
  );
  assert.equal((await first("SELECT verified FROM users WHERE id='member'")).verified, 'verified');
  assert.equal(
    Number((await first("SELECT count(*) n FROM notifications WHERE user='member'")).n),
    1,
  );
});
test('edits enforce ownership, versions and valid dates', async () => {
  await login('finder');
  const r = await report();
  await login('other');
  const p = {
    id: r.id,
    version: 0,
    type: 'found',
    title: 'Changed',
    description: 'Edited',
    category: 'Bags & Backpacks',
    location: 'Main Library',
    date: '2026-01-01',
  };
  assert.equal((await post('report', p)).status, 400);
  await login('finder');
  assert.equal((await post('report', p)).status, 200);
  assert.equal((await post('report', p)).status, 400);
  assert.equal((await post('report', { ...p, id: undefined, date: '2099-01-01' })).status, 400);
});
test('owner role requires exact trusted configuration', async () => {
  process.env.FOUNDIT_OWNER_ID = 'specific-owner';
  await login('first');
  assert.equal((await first('SELECT role FROM users WHERE id=?', 'first')).role, 'member');
  await login('specific-owner');
  assert.equal(
    (await first('SELECT role FROM users WHERE id=?', 'specific-owner')).role,
    'super-admin',
  );
});
test('cross-origin writes rejected and callback paths cannot redirect externally', async () => {
  await login('member');
  const r = await POST(
    new Request('https://test.local/api/data', {
      method: 'POST',
      headers: { origin: 'https://other.invalid', 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'profile', name: 'Bad', affiliation: 'Student' }),
    }),
  );
  assert.equal(r.status, 403);
  assert.equal(safeReturnPath('//evil.example'), '/dashboard');
  assert.equal(safeReturnPath('/\\evil.example'), '/dashboard');
  assert.equal(safeReturnPath('/reset-password'), '/reset-password');
});
test('admin cannot decide own escalated claim', async () => {
  await login('finder');
  const r = await report();
  await login('admin', 'admin');
  await post('claim', { report: r.id, reason: 'Mine', features: 'Mark' });
  const c = await first('SELECT id FROM claims');
  await post('claimState', { id: c.id, status: 'escalated' });
  assert.equal((await post('claimState', { id: c.id, status: 'approved' })).status, 400);
});
test('private ID denies strangers and audits administrator reads', async () => {
  await login('member');
  await query(
    'INSERT INTO files(id,owner,purpose,mime,size,created) VALUES(?,?,?,?,?,?)',
    'doc',
    'member',
    'verification',
    'image/png',
    100,
    '2026-01-01',
  );
  await post('verification', { document: 'doc' });
  const read = () =>
    fileGET(new Request('https://test.local/api/files/doc'), {
      params: Promise.resolve({ id: 'doc' }),
    });
  setUser(null);
  assert.equal((await read()).status, 403);
  await login('other');
  assert.equal((await read()).status, 403);
  await login('member');
  assert.equal((await read()).status, 200);
  await login('admin', 'admin');
  assert.equal((await read()).status, 200);
  assert.equal(Number((await first('SELECT count(*) n FROM audit')).n), 1);
});
test('database denies direct anonymous and authenticated schema access', async () => {
  await raw('SET ROLE anon;');
  await assert.rejects(raw('SELECT * FROM foundit.users'), /permission denied/);
  await raw('RESET ROLE; SET ROLE authenticated;');
  await assert.rejects(raw('SELECT * FROM foundit.reports'), /permission denied/);
  await raw('RESET ROLE;');
});
