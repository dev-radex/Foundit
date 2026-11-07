import 'server-only';
import { createClient } from '@supabase/supabase-js';
const bucket = 'foundit-private';
function storage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('File storage is not configured.');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from(bucket);
}
export async function putFile(id: string, bytes: Uint8Array, mime: string) {
  const { error } = await storage().upload(id, bytes, { contentType: mime, upsert: false });
  if (error) throw new Error('The image could not be uploaded. Try again.');
}
export async function removeFile(id: string) {
  const { error } = await storage().remove([id]);
  if (error) throw error;
}
export async function downloadFile(id: string) {
  const { data, error } = await storage().download(id);
  return error ? null : data;
}
