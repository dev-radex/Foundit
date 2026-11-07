import { putFile, removeFile } from '../../../lib/storage';
import { actor, id, stmt, now } from '../../../lib/server';
export async function POST(req: Request) {
  try {
    if (req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin)
      return Response.json({ error: 'Invalid origin' }, { status: 403 });
    const u = await actor();
    if (!u) return Response.json({ error: 'Sign in required' }, { status: 401 });
    if (Number(req.headers.get('content-length') || 0) > 4 * 1024 * 1024)
      throw new Error('Maximum file size is 3 MB');
    const form = await req.formData(),
      file = form.get('file') as File,
      purpose = String(form.get('purpose'));
    if (
      !['photo', 'evidence', 'verification'].includes(purpose) ||
      !file ||
      typeof file.arrayBuffer !== 'function'
    )
      throw new Error('Choose a file');
    if (file.size > 3 * 1024 * 1024 || file.size === 0)
      throw new Error('Choose a file smaller than 3 MB');
    const b = new Uint8Array(await file.arrayBuffer());
    let mime = '';
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) mime = 'image/jpeg';
    if (b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71) mime = 'image/png';
    if (
      new TextDecoder().decode(b.slice(0, 4)) === 'RIFF' &&
      new TextDecoder().decode(b.slice(8, 12)) === 'WEBP'
    )
      mime = 'image/webp';
    if (!mime) throw new Error('Use a JPEG, PNG or WebP image');
    const fid = id();
    await putFile(fid, b, mime);
    try {
      await stmt(
        'INSERT INTO files(id,owner,purpose,mime,size,created) VALUES(?,?,?,?,?,?)',
        fid,
        u.id,
        purpose,
        mime,
        b.length,
        now(),
      ).run();
    } catch (e) {
      await removeFile(fid);
      throw e;
    }
    return Response.json({ id: fid });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
