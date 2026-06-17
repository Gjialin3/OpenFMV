import { AppEdge, AppNode, OpenFMVAsset, OpenFMVGraph, OpenFMVProject } from '../_types';
import { classifyAssetSource, isProjectAssetSourceKind } from './assetPaths';
import { getEntryNodeId } from './graphRuntime';

export const defaultGraphData = (): OpenFMVGraph => ({
  nodes: [
    {
      id: 'start-node',
      type: 'start',
      position: { x: 100, y: 100 },
      data: { type: 'start', label: 'Start' },
    },
  ],
  edges: [],
});

const isSupportedNode = (node: AppNode | null | undefined): node is AppNode => (
  node?.type === 'start' || node?.type === 'scene' || node?.type === 'end'
);

export const ensureGraphData = (graphData?: Partial<OpenFMVGraph> | null): OpenFMVGraph => {
  const fallback = defaultGraphData();
  const sourceNodes = Array.isArray(graphData?.nodes) ? graphData.nodes.filter(isSupportedNode) : [];
  const nodes = sourceNodes.length > 0 ? sourceNodes : fallback.nodes;
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = Array.isArray(graphData?.edges)
    ? graphData.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target) && edge.source !== edge.target)
    : fallback.edges;

  return { nodes, edges };
};

const now = () => new Date().toISOString();

const assetTypeFromPath = (value: string): OpenFMVAsset['type'] => {
  const lower = value.split('?')[0].split('#')[0].toLowerCase();
  if (/\.(mp4|webm|mov|mkv)$/.test(lower)) return 'video';
  if (/\.(png|jpg|jpeg|gif|webp|bmp)$/.test(lower)) return 'image';
  if (/\.(mp3|wav|ogg|m4a|aac|flac)$/.test(lower)) return 'audio';
  return 'text';
};

const nameFromPath = (value: string, fallback: string) => {
  try {
    const pathname = value.startsWith('file:') ? new URL(value).pathname : value;
    const normalized = decodeURIComponent(pathname.replace(/\\/g, '/'));
    return normalized.split('/').filter(Boolean).pop() || fallback;
  } catch {
    return fallback;
  }
};

export const collectProjectAssetsFromGraph = (
  graphData: OpenFMVGraph,
  existingAssets: OpenFMVAsset[] = []
): OpenFMVAsset[] => {
  const assetsByPath = new Map<string, OpenFMVAsset>();
  for (const asset of existingAssets) {
    const key = asset.relativePath || asset.path;
    if (key) assetsByPath.set(key, asset);
  }

  const addAsset = (value: unknown, label: string) => {
    const sourceKind = classifyAssetSource(value);
    if (typeof value !== 'string' || !isProjectAssetSourceKind(sourceKind)) return;
    if (assetsByPath.has(value)) return;
    assetsByPath.set(value, {
      id: crypto.randomUUID(),
      type: assetTypeFromPath(value),
      name: nameFromPath(value, label),
      path: value,
      relativePath: value,
      importedAt: now(),
      metadata: {},
    });
  };

  for (const node of graphData.nodes || []) {
    const data = node.data as Record<string, unknown>;
    const tracks = Array.isArray((data.timeline as { tracks?: unknown[] } | undefined)?.tracks)
      ? ((data.timeline as { tracks: Array<{ clips?: unknown[] }> }).tracks)
      : [];
    for (const track of tracks) {
      const clips = Array.isArray(track.clips) ? track.clips : [];
      for (const clip of clips) {
        const mediaClip = clip as Record<string, unknown>;
        addAsset(mediaClip.src, `${node.id}-timeline-media`);
        addAsset(mediaClip.poster, `${node.id}-timeline-poster`);
        addAsset((mediaClip.style as Record<string, unknown> | undefined)?.backgroundImageSrc, `${node.id}-button-background`);
      }
    }
  }

  return Array.from(assetsByPath.values());
};

export const createProjectSnapshot = (
  project: OpenFMVProject | null,
  title: string,
  nodes: AppNode[],
  edges: AppEdge[],
  existingAssets: OpenFMVAsset[] = []
): OpenFMVProject => {
  const timestamp = now();
  const graphData = ensureGraphData({ nodes, edges });
  const baseProject = project ?? {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    title,
    graphData,
    assets: [],
    metadata: {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const coverImage = graphData.nodes
    .map((node) => node.data as Record<string, unknown>)
    .map((data) => {
      const tracks = Array.isArray((data.timeline as { tracks?: unknown[] } | undefined)?.tracks)
        ? ((data.timeline as { tracks: Array<{ clips?: unknown[] }> }).tracks)
        : [];
      for (const track of tracks) {
        const clips = Array.isArray(track.clips) ? track.clips : [];
        const mediaClip = clips.find((clip) => {
          const type = (clip as Record<string, unknown>).type;
          return type === 'image' || type === 'video';
        }) as Record<string, unknown> | undefined;
        if (typeof mediaClip?.poster === 'string') return mediaClip.poster;
        if (mediaClip?.type === 'image' && typeof mediaClip.src === 'string') return mediaClip.src;
      }
      return undefined;
    })
    .find((value): value is string => typeof value === 'string' && value.length > 0);

  return {
    ...baseProject,
    title,
    graphData,
    assets: collectProjectAssetsFromGraph(graphData, existingAssets.length > 0 ? existingAssets : baseProject.assets),
    metadata: {
      ...baseProject.metadata,
      coverImage: coverImage || baseProject.metadata.coverImage,
      entryNodeId: getEntryNodeId(graphData, baseProject.metadata.entryNodeId) ?? undefined,
    },
  };
};
