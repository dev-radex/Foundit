import { getAuthenticatedUser } from './supabase/server';
import { database } from './database';
export { database } from './database';
export const stmt = (sql: string, ...args: any[]) =>
  database()
    .prepare(sql)
    .bind(...args);
export const rows = async (sql: string, ...args: any[]) =>
  (await stmt(sql, ...args).all()).results as any[];
export const one = async (sql: string, ...args: any[]) => stmt(sql, ...args).first<any>();
export const id = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const admin = (u: any) => ['admin', 'super-admin'].includes(u?.role);
export async function actor() {
  const identity = await getAuthenticatedUser();
  if (!identity) return null;
  await stmt(
    'INSERT OR IGNORE INTO users(id,name,created) VALUES(?,?,?)',
    identity.userId,
    identity.fullName || 'Community member',
    now(),
  ).run();
  let u = await one('SELECT * FROM users WHERE id=?', identity.userId);
  if (
    process.env.FOUNDIT_OWNER_ID &&
    identity.userId === process.env.FOUNDIT_OWNER_ID &&
    u.role !== 'super-admin'
  ) {
    await database().batch([
      stmt("UPDATE users SET role='super-admin' WHERE id=?", u.id),
      auditEntry(u, 'owner.provisioned', u.id),
    ]);
    u = await one('SELECT * FROM users WHERE id=?', identity.userId);
  }
  if (u.suspended) throw new Error('This account is suspended.');
  return u;
}
export function notification(user: string, title: string, link: string, body = '') {
  return stmt(
    'INSERT INTO notifications(id,user,title,body,link,created) VALUES(?,?,?,?,?,?)',
    id(),
    user,
    title,
    body,
    link,
    now(),
  );
}
export function auditEntry(u: any, action: string, target: string, detail = '') {
  return stmt(
    'INSERT INTO audit(id,actor,action,target,detail,created) VALUES(?,?,?,?,?,?)',
    id(),
    u.id,
    action,
    target,
    detail,
    now(),
  );
}
export async function ownsFile(file: string, u: any, purpose: string) {
  if (!file) return;
  const f = await one(
    'SELECT * FROM files WHERE id=? AND owner=? AND purpose=?',
    file,
    u.id,
    purpose,
  );
  if (!f) throw new Error('Invalid attachment');
}
export async function blocked(a: string, b: string) {
  return !!(await one(
    'SELECT id FROM blocks WHERE (owner=? AND target=?) OR (owner=? AND target=?)',
    a,
    b,
    b,
    a,
  ));
}
