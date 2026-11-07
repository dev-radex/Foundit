import { pathToFileURL } from 'node:url';
export async function resolve(specifier, context, next) {
  const mappings = {
    'server-only': 'empty.mjs',
    './database': 'mock-db.mjs',
    './supabase/server': 'mock-auth.mjs',
    '../../../lib/storage': 'mock-storage.mjs',
    '../../../../lib/storage': 'mock-storage.mjs',
  };
  const target = mappings[specifier];
  if (target)
    return { url: pathToFileURL(process.cwd() + '/tests/' + target).href, shortCircuit: true };
  if (specifier.startsWith('.') && !/\.(mjs|js|ts|json)$/.test(specifier)) {
    try {
      return await next(specifier + '.ts', context);
    } catch {}
  }
  return next(specifier, context);
}
