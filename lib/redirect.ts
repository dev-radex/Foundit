export function safeReturnPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
    return '/dashboard';
  const url = new URL(value, 'https://foundit.invalid');
  return url.origin === 'https://foundit.invalid'
    ? url.pathname + url.search + url.hash
    : '/dashboard';
}
