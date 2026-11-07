/** Translate the app's parameterised statements into PostgreSQL. Never interpolates values. */
const tables = new Set([
  'users',
  'reports',
  'claims',
  'conversations',
  'messages',
  'notifications',
  'verifications',
  'abuse',
  'announcements',
  'taxonomy',
  'audit',
  'files',
  'blocks',
]);
export function compileSql(input: string) {
  const ignore = /^INSERT OR IGNORE /i.test(input);
  let sql = input.replace(/^INSERT OR IGNORE /i, 'INSERT ');
  let index = 0;
  sql = sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?|\b[a-zA-Z_][a-zA-Z_0-9]*\b/g, (token) => {
    if (token[0] === "'" || token[0] === '"') return token;
    if (token === '?') return '$' + ++index;
    if (token === 'user') return '"user"';
    if (tables.has(token)) return 'foundit.' + token;
    return token;
  });
  return ignore ? sql + ' ON CONFLICT DO NOTHING' : sql;
}
