import { downloadFile } from '../../../../lib/storage';
import { actor, admin, one, auditEntry } from '../../../../lib/server';
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const f = await one('SELECT * FROM files WHERE id=?', id);
    if (!f) return new Response('Not found', { status: 404 });
    const u = await actor();
    let allowed = u?.id === f.owner;
    if (f.purpose === 'photo') {
      allowed =
        allowed ||
        !!(await one("SELECT id FROM reports WHERE photo=? AND moderation='visible'", id));
    } else if (u && f.purpose === 'evidence') {
      allowed =
        allowed ||
        !!(await one(
          'SELECT c.id FROM claims c JOIN reports r ON r.id=c.report WHERE c.evidence=? AND (r.owner=? OR c.claimant=?)',
          id,
          u.id,
          u.id,
        ));
      if (admin(u)) {
        allowed =
          allowed || !!(await one('SELECT id FROM claims WHERE evidence=? AND escalated=1', id));
      }
    } else if (u && f.purpose === 'verification' && admin(u)) {
      allowed = !!(await one('SELECT id FROM verifications WHERE document=?', id));
    }
    if (!allowed) return new Response('Access denied', { status: 403 });
    if (u && admin(u) && f.purpose !== 'photo' && u.id !== f.owner)
      await auditEntry(u, 'private-file.view', id).run();
    const obj = await downloadFile(id);
    if (!obj) return new Response('Not found', { status: 404 });
    return new Response(await obj.arrayBuffer(), {
      headers: {
        'Content-Type': f.mime,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
      },
    });
  } catch {
    return new Response('File unavailable', { status: 403 });
  }
}
