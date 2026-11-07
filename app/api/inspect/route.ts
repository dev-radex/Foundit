import { one } from '../../../lib/server';
export async function GET() {
  try {
    const counts = await one(
      "SELECT count(*) reports,sum(CASE WHEN status='recovered' THEN 1 ELSE 0 END) recovered FROM reports WHERE moderation='visible'",
    );
    return Response.json(
      {
        name: 'FoundIt',
        institution: 'University of Ilorin',
        version: '1.0.0',
        authentication: 'Supabase Auth (email/password and Google OAuth)',
        roles: ['visitor', 'member', 'admin', 'super-admin'],
        features: [
          'reports',
          'search',
          'matching',
          'claims',
          'messaging',
          'verification',
          'notifications',
          'moderation',
          'announcements',
          'audit',
        ],
        privacy:
          'No user records, IDs, messages, evidence or private notes are returned by this endpoint.',
        counts,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json({ name: 'FoundIt', status: 'initialising' }, { status: 503 });
  }
}
