import GameClient from '@/app/play/[id]/GameClient';

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <GameClient projectId={id} />;
}

