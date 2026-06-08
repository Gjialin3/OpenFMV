import AssetStudioClient from '@/app/_components/assets/AssetStudioClient';

export default async function AssetStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; assetId?: string }>;
}) {
  const { projectId, assetId } = await searchParams;

  return <AssetStudioClient projectId={projectId} assetId={assetId} />;
}

