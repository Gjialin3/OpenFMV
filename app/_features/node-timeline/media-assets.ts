import { TimelineMediaClipType } from '@/app/_types';

import { createMediaClip } from './schema';

export interface TimelineMediaAssetInput {
  type: TimelineMediaClipType;
  src: string;
  name?: string | null;
  assetId?: string;
  startTime: number;
  metadata?: unknown;
}

export interface TimelineClipboardItemLike {
  kind?: string;
  type?: string;
  getAsFile?: () => File | null;
}

export interface TimelineClipboardDataLike {
  items?: Iterable<TimelineClipboardItemLike> | ArrayLike<TimelineClipboardItemLike>;
}

const getMetadata = (metadata: unknown): Record<string, unknown> => {
  return typeof metadata === 'object' && metadata !== null ? metadata as Record<string, unknown> : {};
};

export const getMediaFilesFromClipboardData = (clipboardData: TimelineClipboardDataLike | null) => {
  if (!clipboardData?.items) return [];
  return Array.from(clipboardData.items)
    .filter((item) => item.kind === 'file' && (
      item.type?.startsWith('image/') ||
      item.type?.startsWith('video/') ||
      item.type?.startsWith('audio/')
    ))
    .map((item) => item.getAsFile?.())
    .filter((file): file is File => Boolean(file));
};

export const getTimelineMediaAssetDuration = (metadata: unknown) => {
  const duration = Number(getMetadata(metadata).duration);
  return Number.isFinite(duration) && duration > 0 ? duration : undefined;
};

export const getTimelineMediaAssetPlaybackId = (metadata: unknown) => {
  const playbackId = getMetadata(metadata).playbackId;
  return typeof playbackId === 'string' && playbackId ? playbackId : undefined;
};

export const getTimelineMediaAssetPoster = (metadata: unknown) => {
  const assetMetadata = getMetadata(metadata);
  for (const key of ['poster', 'thumbnail']) {
    const value = assetMetadata[key];
    if (typeof value === 'string' && value) return value;
  }
  return undefined;
};

export const createMediaClipFromTimelineAsset = ({
  type,
  src,
  name,
  assetId,
  startTime,
  metadata,
}: TimelineMediaAssetInput) => {
  const duration = getTimelineMediaAssetDuration(metadata);

  return createMediaClip({
    type,
    src,
    name: name || src,
    assetId,
    startTime,
    duration,
    sourceDuration: duration,
    playbackId: getTimelineMediaAssetPlaybackId(metadata),
    poster: getTimelineMediaAssetPoster(metadata),
  });
};
