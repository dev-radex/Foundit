import {
  actor,
  admin,
  rows,
  one,
  stmt,
  database,
  id,
  now,
  notification,
  auditEntry,
  ownsFile,
  blocked,
} from '../../../lib/server';
import { matchScore, canTransition, required, resolveTaxonomy } from '../../../lib/domain';
export const dynamic = 'force-dynamic';
const json = (v: any, status = 200) =>
  Response.json(v, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get('mode') || 'all';
    const u = await actor();
    const stats = await one(
      "SELECT SUM(CASE WHEN type='lost' AND status='open' THEN 1 ELSE 0 END) lost,SUM(CASE WHEN type='found' AND status='open' THEN 1 ELSE 0 END) found,SUM(CASE WHEN status='recovered' THEN 1 ELSE 0 END) recovered FROM reports WHERE moderation='visible'",
    );
    const taxa = await rows('SELECT * FROM taxonomy ORDER BY name');
    const announcements = await rows(
      "SELECT * FROM announcements WHERE expires='' OR expires>? ORDER BY pinned DESC,created DESC",
      now(),
    );
    if (!u) {
      const recent = await rows(
        "SELECT id,title,type,category,location,date,status,photo FROM reports WHERE moderation='visible' ORDER BY created DESC LIMIT 6",
      );
      return json({ user: null, stats, reports: recent, taxonomy: taxa, announcements });
    }
    if (mode === 'conversation') {
      const cid = url.searchParams.get('id');
      const c = await one(
        'SELECT c.*,r.title FROM conversations c JOIN reports r ON r.id=c.report WHERE c.id=?',
        cid,
      );
      if (!c || ![c.owner, c.member].includes(u.id))
        return json({ error: 'Conversation not available' }, 403);
      await stmt('UPDATE messages SET read=1 WHERE conversation=? AND sender<>?', cid, u.id).run();
      return json({
        conversation: c,
        messages: await rows(
          'SELECT m.*,u.name sender_name FROM messages m LEFT JOIN users u ON u.id=m.sender WHERE conversation=? ORDER BY created',
          cid,
        ),
      });
    }
    if (mode === 'admin') {
      if (!admin(u)) return json({ error: 'Administrator access required' }, 403);
      return json({
        users: await rows('SELECT * FROM users ORDER BY created DESC'),
        reports: await rows(
          'SELECT r.*,u.name reporter FROM reports r JOIN users u ON u.id=r.owner ORDER BY r.created DESC',
        ),
        claims: await rows(
          'SELECT c.*,r.title,r.owner,u.name claimant_name FROM claims c JOIN reports r ON r.id=c.report JOIN users u ON u.id=c.claimant ORDER BY c.created DESC',
        ),
        verifications: await rows(
          'SELECT v.*,u.name,u.affiliation,u.department,u.level FROM verifications v JOIN users u ON u.id=v.user ORDER BY v.created DESC',
        ),
        abuse: await rows('SELECT * FROM abuse ORDER BY created DESC'),
        announcements: await rows('SELECT * FROM announcements ORDER BY created DESC'),
        taxonomy: taxa,
        audit: await rows(
          'SELECT a.*,u.name actor_name FROM audit a LEFT JOIN users u ON u.id=a.actor ORDER BY created DESC LIMIT 200',
        ),
      });
    }
    const reports = await rows(
      "SELECT r.id,r.owner,r.type,r.title,r.description,r.category,r.location,r.date,r.photo,r.status,r.moderation,r.version,r.created,u.name reporter,u.affiliation,u.verified,CASE WHEN r.owner=? OR ?=1 THEN r.private_note ELSE '' END private_note FROM reports r JOIN users u ON u.id=r.owner WHERE r.moderation='visible' OR r.owner=? OR ?=1 ORDER BY r.created DESC",
      u.id,
      admin(u) ? 1 : 0,
      u.id,
      admin(u) ? 1 : 0,
    );
    const claims = await rows(
      'SELECT c.*,r.title,r.owner,u.name claimant_name FROM claims c JOIN reports r ON r.id=c.report JOIN users u ON u.id=c.claimant WHERE c.claimant=? OR r.owner=? ORDER BY c.created DESC',
      u.id,
      u.id,
    );
    const conversations = await rows(
      'SELECT c.*,r.title,CASE WHEN c.owner=? THEN b.name ELSE a.name END other_name,CASE WHEN c.owner=? THEN c.member ELSE c.owner END other_id,(SELECT body FROM messages WHERE conversation=c.id ORDER BY created DESC LIMIT 1) preview,(SELECT COUNT(*) FROM messages WHERE conversation=c.id AND sender<>? AND read=0) unread FROM conversations c JOIN reports r ON r.id=c.report JOIN users a ON a.id=c.owner JOIN users b ON b.id=c.member WHERE c.owner=? OR c.member=? ORDER BY c.created DESC',
      u.id,
      u.id,
      u.id,
      u.id,
      u.id,
    );
    return json({
      user: u,
      stats,
      reports,
      claims,
      conversations,
      notifications: await rows(
        'SELECT * FROM notifications WHERE user=? ORDER BY created DESC LIMIT 150',
        u.id,
      ),
      verifications: await rows(
        'SELECT * FROM verifications WHERE user=? ORDER BY created DESC',
        u.id,
      ),
      blocks: await rows('SELECT * FROM blocks WHERE owner=?', u.id),
      announcements,
      taxonomy: taxa,
    });
  } catch (e: any) {
    return json({ error: e.message }, 400);
  }
}
export async function POST(req: Request) {
  try {
    const origin = req.headers.get('origin');
    if (origin && origin !== new URL(req.url).origin)
      return json({ error: 'Invalid request origin' }, 403);
    const u = await actor();
    if (!u) return json({ error: 'Sign in required' }, 401);
    const { action, ...p } = (await req.json()) as Record<string, any>;
    let result: any = { ok: true };
    let batch: any[] = [];
    if (action === 'profile') {
      if (
        ['verified', 'pending'].includes(u.verified) &&
        (p.name !== u.name ||
          p.affiliation !== u.affiliation ||
          String(p.department || '') !== u.department)
      ) {
        batch.push(
          stmt("UPDATE users SET verified='unverified' WHERE id=?", u.id),
          stmt(
            "UPDATE verifications SET status='superseded',note='Profile changed; a fresh verification is required.' WHERE user=? AND status='pending'",
            u.id,
          ),
        );
      }
      batch.push(
        stmt(
          'UPDATE users SET name=?,affiliation=?,department=?,level=?,onboarded=1 WHERE id=?',
          required(p.name, 'Name', 100),
          required(p.affiliation, 'Affiliation', 100),
          String(p.department || '').slice(0, 150),
          String(p.level || '').slice(0, 30),
          u.id,
        ),
      );
    } else if (action === 'report') {
      const type = ['lost', 'found'].includes(p.type) ? p.type : null;
      if (!type) throw new Error('Select lost or found');
      const title = required(p.title, 'Item name', 120),
        description = required(p.description, 'Description', 3000),
        category = required(p.category, 'Category', 100),
        location = required(p.location, 'Location', 150),
        date = required(p.date, 'Date', 10);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        date > new Date().toISOString().slice(0, 10)
      )
        throw new Error('Choose a valid date that is not in the future');
      await ownsFile(p.photo, u, 'photo');
      const choices = resolveTaxonomy(await rows('SELECT * FROM taxonomy'));
      if (
        !choices.some((t) => t.kind === 'category' && t.name === category && t.active) ||
        !choices.some((t) => t.kind === 'location' && t.name === location && t.active)
      )
        throw new Error('Choose an active category and location');
      const note = String(p.private_note || '').slice(0, 3000);
      const rid = p.id || id();
      if (p.id) {
        const old = await one('SELECT * FROM reports WHERE id=?', rid);
        if (!old || old.owner !== u.id) throw new Error('Only the reporter can edit this item');
        if (old.status !== 'open') throw new Error('Only open reports can be edited');
        if (old.version !== p.version)
          throw new Error('This report changed. Refresh before editing.');
        batch.push(
          stmt(
            "UPDATE reports SET title=?,description=?,category=?,location=?,date=?,private_note=?,photo=?,version=version+1 WHERE id=? AND owner=? AND version=? AND status='open'",
            title,
            description,
            category,
            location,
            date,
            note,
            p.photo || '',
            rid,
            u.id,
            p.version,
          ),
        );
      } else {
        batch.push(
          stmt(
            'INSERT INTO reports(id,owner,type,title,description,category,location,date,private_note,photo,created) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
            rid,
            u.id,
            type,
            title,
            description,
            category,
            location,
            date,
            note,
            p.photo || '',
            now(),
          ),
        );
        const candidates = await rows(
          "SELECT * FROM reports WHERE type<>? AND status='open' AND moderation='visible' AND owner<>?",
          type,
          u.id,
        );
        for (const b of candidates) {
          const score = matchScore(
            { type, title, description, category, location, date, status: 'open' },
            b,
          );
          if (score >= 50 && !(await blocked(u.id, b.owner))) {
            batch.push(
              notification(
                u.id,
                'A possible match was found',
                '/items/' + b.id,
                `${score}% match with ${b.title}`,
              ),
              notification(
                b.owner,
                'A possible match was found',
                '/items/' + rid,
                `${score}% match with ${title}`,
              ),
            );
          }
        }
      }
      result.id = rid;
    } else if (action === 'closeReport') {
      const r = await one('SELECT * FROM reports WHERE id=?', p.id);
      if (!r || r.owner !== u.id) throw new Error('Report not available');
      if (await one("SELECT id FROM claims WHERE report=? AND status='approved'", r.id))
        throw new Error('Complete or reject the approved claim first');
      batch.push(
        stmt(
          "UPDATE reports SET status='closed',version=version+1 WHERE id=? AND status='open'",
          r.id,
        ),
      );
    } else if (action === 'claim' || action === 'conversation') {
      const r = await one("SELECT * FROM reports WHERE id=? AND moderation='visible'", p.report);
      if (!r || r.owner === u.id) throw new Error('This action is not available');
      if (await blocked(u.id, r.owner)) throw new Error('Contact is blocked');
      if (action === 'claim' && (r.type !== 'found' || r.status !== 'open'))
        throw new Error('This item is not open for claims');
      let c = await one('SELECT * FROM conversations WHERE report=? AND member=?', r.id, u.id);
      const cid = c?.id || id();
      if (!c)
        batch.push(
          stmt(
            'INSERT INTO conversations(id,report,owner,member,created) VALUES(?,?,?,?,?)',
            cid,
            r.id,
            r.owner,
            u.id,
            now(),
          ),
        );
      if (action === 'claim') {
        if (await one('SELECT id FROM claims WHERE report=? AND claimant=?', r.id, u.id))
          throw new Error('You already submitted a claim for this item');
        await ownsFile(p.evidence, u, 'evidence');
        batch.push(
          stmt(
            'INSERT INTO claims(id,report,claimant,reason,features,answer,evidence,created) VALUES(?,?,?,?,?,?,?,?)',
            id(),
            r.id,
            u.id,
            required(p.reason, 'Ownership explanation'),
            required(p.features, 'Distinctive features'),
            String(p.answer || '').slice(0, 2000),
            p.evidence || '',
            now(),
          ),
          stmt(
            'INSERT INTO messages(id,conversation,sender,body,system,created) VALUES(?,?,?,?,1,?)',
            id(),
            cid,
            u.id,
            'An ownership claim was submitted.',
            now(),
          ),
          notification(r.owner, 'New ownership claim', '/my-reports', r.title),
        );
      }
      result.id = cid;
    } else if (action === 'claimState') {
      const c = await one(
        'SELECT c.*,r.owner,r.status report_status FROM claims c JOIN reports r ON r.id=c.report WHERE c.id=?',
        p.id,
      );
      if (!c) throw new Error('Claim not found');
      if (p.status === 'escalated') {
        if (![c.claimant, c.owner].includes(u.id)) throw new Error('Access denied');
        if (c.status === 'recovered') throw new Error('A completed recovery cannot be escalated');
        batch.push(stmt('UPDATE claims SET escalated=1 WHERE id=?', c.id));
        const admins = await rows(
          "SELECT id FROM users WHERE role IN ('admin','super-admin') AND suspended=0",
        );
        admins.forEach((a) =>
          batch.push(notification(a.id, 'Claim dispute needs review', '/admin/claims')),
        );
      } else {
        if (c.claimant === u.id) throw new Error('You cannot adjudicate your own ownership claim');
        if (c.owner !== u.id && !(admin(u) && c.escalated))
          throw new Error('Only the finder or dispute administrator can decide this claim');
        if (!canTransition(c.status, p.status)) throw new Error('Invalid claim status change');
        if (
          p.status === 'approved' &&
          (c.report_status !== 'open' ||
            (await one(
              "SELECT id FROM claims WHERE report=? AND status IN ('approved','recovered') AND id<>?",
              c.report,
              c.id,
            )))
        )
          throw new Error('Another claim is already approved, or this report is closed');
        if (p.status === 'recovered' && c.report_status !== 'open')
          throw new Error('Report is no longer open');
        batch.push(
          stmt(
            'UPDATE claims SET status=?,escalated=0 WHERE id=? AND status=?',
            p.status,
            c.id,
            c.status,
          ),
        );
        if (p.status === 'recovered') {
          batch.push(
            stmt(
              "UPDATE reports SET status='recovered',version=version+1 WHERE id=? AND status='open' AND EXISTS(SELECT 1 FROM claims WHERE id=? AND status='recovered')",
              c.report,
              c.id,
            ),
            stmt(
              "UPDATE claims SET status='rejected' WHERE report=? AND id<>? AND status IN ('pending','more_info','approved') AND EXISTS(SELECT 1 FROM claims WHERE id=? AND status='recovered')",
              c.report,
              c.id,
              c.id,
            ),
          );
        }
        if (admin(u) && c.owner !== u.id) batch.push(auditEntry(u, 'claim.' + p.status, c.id));
      }
      batch.push(
        notification(c.claimant, 'Claim updated', '/my-claims', p.status),
        notification(c.owner, 'Claim updated', '/my-reports', p.status),
      );
      const conv = await one(
        'SELECT id FROM conversations WHERE report=? AND member=?',
        c.report,
        c.claimant,
      );
      if (conv)
        batch.push(
          stmt(
            'INSERT INTO messages(id,conversation,sender,body,system,created) VALUES(?,?,?,?,1,?)',
            id(),
            conv.id,
            u.id,
            'Claim status: ' + p.status,
            now(),
          ),
        );
    } else if (action === 'message') {
      const c = await one('SELECT * FROM conversations WHERE id=?', p.conversation);
      if (!c || ![c.owner, c.member].includes(u.id)) throw new Error('Conversation not available');
      if (await blocked(c.owner, c.member)) throw new Error('Messaging is blocked');
      const target = c.owner === u.id ? c.member : c.owner;
      batch.push(
        stmt(
          'INSERT INTO messages(id,conversation,sender,body,created) VALUES(?,?,?,?,?)',
          id(),
          c.id,
          u.id,
          required(p.body, 'Message', 3000),
          now(),
        ),
        notification(target, 'New message', '/messages/' + c.id),
      );
    } else if (action === 'readNotifications') {
      batch.push(stmt('UPDATE notifications SET read=1 WHERE user=?', u.id));
    } else if (action === 'block') {
      if (p.target === u.id || !(await one('SELECT id FROM users WHERE id=?', p.target)))
        throw new Error('Invalid account');
      batch.push(
        p.remove
          ? stmt('DELETE FROM blocks WHERE owner=? AND target=?', u.id, p.target)
          : stmt(
              'INSERT OR IGNORE INTO blocks(id,owner,target) VALUES(?,?,?)',
              id(),
              u.id,
              p.target,
            ),
      );
    } else if (action === 'verification') {
      if (
        u.verified === 'verified' ||
        (await one("SELECT id FROM verifications WHERE user=? AND status='pending'", u.id))
      )
        throw new Error('Verification is already pending or completed');
      await ownsFile(required(p.document, 'ID document', 100), u, 'verification');
      batch.push(
        stmt(
          'INSERT INTO verifications(id,user,document,created) VALUES(?,?,?,?)',
          id(),
          u.id,
          p.document,
          now(),
        ),
        stmt("UPDATE users SET verified='pending' WHERE id=?", u.id),
      );
    } else if (action === 'abuse') {
      if (!['report', 'user', 'message'].includes(p.target_type))
        throw new Error('Invalid report type');
      const target = required(p.target, 'Target', 100);
      if (p.target_type === 'message') {
        const m = await one(
          'SELECT c.owner,c.member FROM messages m JOIN conversations c ON c.id=m.conversation WHERE m.id=?',
          target,
        );
        if (!m || ![m.owner, m.member].includes(u.id)) throw new Error('Message not available');
      }
      batch.push(
        stmt(
          'INSERT INTO abuse(id,user,target_type,target,reason,details,created) VALUES(?,?,?,?,?,?,?)',
          id(),
          u.id,
          p.target_type,
          target,
          required(p.reason, 'Reason', 200),
          String(p.details || '').slice(0, 3000),
          now(),
        ),
      );
    } else if (action.startsWith('admin.')) {
      if (!admin(u)) return json({ error: 'Administrator access required' }, 403);
      if (action === 'admin.moderate') {
        if (!['visible', 'hidden', 'removed'].includes(p.status)) throw new Error('Invalid status');
        batch.push(
          stmt('UPDATE reports SET moderation=?,version=version+1 WHERE id=?', p.status, p.id),
        );
      } else if (action === 'admin.verify') {
        if (!['verified', 'rejected'].includes(p.status)) throw new Error('Invalid decision');
        const v = await one("SELECT * FROM verifications WHERE id=? AND status='pending'", p.id);
        if (!v) throw new Error('Request already reviewed');
        batch.push(
          stmt(
            'UPDATE verifications SET status=?,note=? WHERE id=?',
            p.status,
            String(p.note || '').slice(0, 1000),
            v.id,
          ),
          stmt('UPDATE users SET verified=? WHERE id=?', p.status, v.user),
          notification(v.user, 'Verification ' + p.status, '/verify', p.note || ''),
        );
      } else if (action === 'admin.user') {
        const target = await one('SELECT * FROM users WHERE id=?', p.id);
        if (!target || target.id === u.id)
          throw new Error('You cannot change your own access here');
        if (target.role === 'super-admin') throw new Error('Super-admin access is protected');
        if (p.role) {
          if (u.role !== 'super-admin' || !['admin', 'member'].includes(p.role))
            throw new Error('Only the super-admin can assign roles');
          batch.push(stmt('UPDATE users SET role=? WHERE id=?', p.role, p.id));
        } else {
          batch.push(stmt('UPDATE users SET suspended=? WHERE id=?', p.suspended ? 1 : 0, p.id));
        }
      } else if (action === 'admin.abuse') {
        batch.push(
          stmt(
            "UPDATE abuse SET status='resolved',note=? WHERE id=?",
            required(p.note, 'Resolution note', 2000),
            p.id,
          ),
        );
      } else if (action === 'admin.transcript') {
        const a = await one('SELECT * FROM abuse WHERE id=?', p.id);
        if (!a) throw new Error('An abuse investigation is required');
        let cid = p.conversation;
        if (a.target_type === 'message') {
          const m = await one('SELECT conversation FROM messages WHERE id=?', a.target);
          cid = m?.conversation;
        }
        const c = await one('SELECT * FROM conversations WHERE id=?', cid);
        if (
          !c ||
          (a.target_type === 'report' && c.report !== a.target) ||
          (a.target_type === 'user' && ![c.owner, c.member].includes(a.target))
        )
          throw new Error('Conversation not related to investigation');
        result.messages = await rows(
          'SELECT * FROM messages WHERE conversation=? ORDER BY created',
          cid,
        );
      } else if (action === 'admin.announcement') {
        const aid = p.id || id();
        if (p.remove) batch.push(stmt('DELETE FROM announcements WHERE id=?', aid));
        else {
          batch.push(
            stmt(
              'INSERT INTO announcements(id,title,body,pinned,expires,created) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,pinned=excluded.pinned,expires=excluded.expires',
              aid,
              required(p.title, 'Title', 160),
              required(p.body, 'Announcement', 5000),
              p.pinned ? 1 : 0,
              p.expires || '',
              now(),
            ),
          );
          const members = await rows('SELECT id FROM users WHERE suspended=0');
          members.forEach((m) =>
            batch.push(notification(m.id, 'New announcement', '/dashboard', p.title)),
          );
        }
      } else if (action === 'admin.taxonomy') {
        if (!['category', 'location', 'institution', 'department'].includes(p.kind))
          throw new Error('Invalid taxonomy');
        batch.push(
          stmt(
            'INSERT INTO taxonomy(id,kind,name,parent,active) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,parent=excluded.parent,active=excluded.active',
            p.id || id(),
            p.kind,
            required(p.name, 'Name', 150),
            p.parent || '',
            p.active === false ? 0 : 1,
          ),
        );
      } else throw new Error('Unknown admin action');
      batch.push(
        auditEntry(u, action, p.id || '', JSON.stringify({ ...p, body: undefined }).slice(0, 1500)),
      );
    } else throw new Error('Unknown action');
    if (batch.length) await database().batch(batch);
    return json(result);
  } catch (e: any) {
    return json(
      {
        error:
          e.code === '23505' || e.message.includes('UNIQUE')
            ? 'This action has already been completed. Refresh to see the latest state.'
            : e.message,
      },
      400,
    );
  }
}
