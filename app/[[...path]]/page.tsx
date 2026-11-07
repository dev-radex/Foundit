import FoundIt from '../../components/foundit';
export const dynamic = 'force-dynamic';
export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const p = await params;
  return <FoundIt initialPath={'/' + (p.path || []).join('/')} />;
}
