import GameClient from './GameClient';

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <GameClient projectId={id} />;
}
