import EditorPageClient from '@/app/_components/editor/EditorPageClient';

export default async function EditorPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;

  return <EditorPageClient projectId={id} />;
}

