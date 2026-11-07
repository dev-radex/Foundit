import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import { compileSql } from '../lib/sql.ts';
let db;
export async function resetDb() {
  if (db) await db.close();
  db = new PGlite();
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  await db.exec(fs.readFileSync('supabase/migrations/202611070001_foundit.sql', 'utf8'));
}
export async function query(sql, ...args) {
  return (await db.query(compileSql(sql), args)).rows;
}
export async function first(sql, ...args) {
  return (await query(sql, ...args))[0];
}
function prepared(sql, values = []) {
  return {
    sql,
    values,
    bind(...v) {
      return prepared(sql, v);
    },
    async all() {
      return { results: await query(sql, ...values) };
    },
    async first() {
      return (await query(sql, ...values))[0] || null;
    },
    async run() {
      const r = await db.query(compileSql(sql), values);
      return { meta: { changes: r.affectedRows } };
    },
  };
}
export function database() {
  return {
    prepare: (sql) => prepared(sql),
    async batch(statements) {
      await db.exec('BEGIN');
      try {
        const result = [];
        for (const s of statements) result.push(await s.run());
        await db.exec('COMMIT');
        return result;
      } catch (e) {
        await db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
export async function raw(sql) {
  return db.exec(sql);
}
