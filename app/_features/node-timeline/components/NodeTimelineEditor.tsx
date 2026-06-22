'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import { useShallow } from 'zustand/react/shallow';
import {
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  Bookmark,
  Check,
  ChevronDown,
  ChevronsRight,
  ClipboardPaste,
  CloudUpload,
  Copy,
  Diamond,
  Eye,
  EyeOff,
  Film,
  FolderOpen,
  GitBranch,
  Hand,
  Headphones,
  Image as ImageIcon,
  Keyboard,
  Layers,
  Link as LinkIcon,
  List,
  Lock,
  Magnet,
  Maximize2,
  Minus,
  MousePointerClick,
  Music,
  Pause,
  Play,
  Plus,
  Scissors,
  SlidersHorizontal,
  Snowflake,
  Redo2,
  RotateCw,
  Trash2,
  Type,
  Upload,
  Undo2,
  Unlink2,
  Unlock,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react';

import {
  AppEdge,
  AppNode,
  ButtonMode,
  ButtonQteConfig,
  ButtonQteInput,
  ButtonStyleBackgroundFit,
  ButtonStyleConfig,
  ButtonStyleShape,
  NodeTimeline,
  OpenFMVAsset,
  OverlayRect,
  TimelineBookmark,
  TimelineClip,
  TimelineClipKeyframe,
  TimelineInteractionClip,
  TimelineInteractionClipType,
  TimelineKeyframeInterpolation,
  TimelineKeyframeProperty,
  TimelineMediaClip,
  TimelineMediaClipType,
  TimelineTrack,
  TimelineTrackType,
} from '@/app/_types';
import OpenFMVVideo from '@/app/_components/video/OpenFMVVideo';
import { useProjectSessionStore } from '@/app/_features/project-session/store';
import { buildTimelineAssetLibraryItems, getTimelineAssetItemKey, TimelineAssetItem } from '@/app/_features/node-timeline/assetLibrary';
import { useResolvedMediaSrc } from '@/app/_hooks/useResolvedMediaSrc';
import { useEditorStore } from '@/app/_store/useEditorStore';
import { getAssetSource } from '@/app/_utils/assetIdentity';
import { getLocalizedPath } from '@/app/_utils/localePaths';
import { addAssetsToLocalProject, canUseNativeAssetPicker, importAssetFromFile, importAssetFromNativePicker, isStorageQuotaError, listLocalProjects, removeAssetFromLocalProject, resolveLocalProjectForEditor } from '@/app/_utils/localProjects';
import { getTimelineClipOutputHandleId, removeTimelineOutputEdge } from '@/app/_utils/timelineOutputEdges';
import {
  addTimelineTrack,
  BUTTON_STYLE_BACKGROUND_FITS,
  BUTTON_STYLE_SWATCHES,
  buildAudioWaveformPeaks,
  buildPreviewSnapTargets,
  buildTimelineSnapPoints,
  canClipLiveOnTrack,
  canDeleteTimelineTrack,
  canTimelineClipHaveAudio,
  canTimelineTrackBeHidden,
  canTimelineTrackHaveAudio,
  canToggleTimelineSourceAudio,
  clampButtonBorderWidth,
  clampButtonStyleOpacity,
  clampTimelineZoom,
  clampTimelineClipOpacity,
  clampTimelineClipRotation,
  clampTimelineMediaPlaybackRate,
  clampOverlayRect,
  clampTimelineTime,
  compileNodeTimeline,
  createInteractionClip,
  createTimelineKeyframeClipboardItems,
  createMediaClipFromTimelineAsset,
  DEFAULT_TIMELINE_ZOOM,
  deleteTimelineClips,
  deleteTimelineClipsWithRipple,
  deleteTimelineTrack,
  duplicateTimelineClip,
  duplicateTimelineClips,
  ensureNodeTimeline,
  findTimelineClip,
  findTimelineBookmarkAtTime,
  freezeTimelineVideoClipAtTime,
  getAdjacentTimelineEditPoint,
  getButtonClipInlineStyle,
  getButtonStyleClipPath,
  getButtonStyleRgba,
  getClipEndTime,
  getLinkedTimelineClipIds,
  getTimelineEdgeScroll,
  getFitTimelineZoom,
  getButtonMode,
  getNodeTimelineTrackHeight,
  getTimelineRulerTicks,
  getSnapAdjustedClipStart,
  getTimelineClipLabel,
  getTimelineClipLocalTime,
  getTimelineQteDisplayName,
  getTimelineSplitTargetClipIds,
  getMediaFilesFromClipboardData,
  getTimelineMediaElementTime,
  getTimelineMediaAssetPoster,
  getTimelineMediaPlaybackRate,
  getTimelineMediaSourceEnd,
  getTrackMediaRole,
  hasTimelineMediaSourceEnded,
  insertTimelineClip,
  isInteractionClipType,
  isMediaClipType,
  isQteButtonClip,
  isTimelineClipActive,
  isTimelineSourceAudioSeparated,
  isVisualMediaClip,
  linkTimelineClips,
  MIN_TIMELINE_CLIP_DURATION,
  moveTimelineClipKeyframes,
  moveLinkedTimelineClipsByDelta,
  moveTimelineClip,
  moveTimelineClipGroup,
  pasteTimelineClips,
  pasteTimelineClipKeyframes,
  reorderTimelineTrack,
  removeTimelineClipKeyframes,
  normalizeButtonHexColor,
  normalizeButtonStyleConfig,
  type ResolvedButtonStyleConfig,
  resolveButtonStyleConfig,
  resolveTimelineClipKeyframes,
  resolveTimelineSnap,
  roundTimelineTime,
  selectTimelineClipIdsInRange,
  setTimelineClipsEnabled,
  setTimelineClipsHidden,
  setTimelineClipsMuted,
  setTimelineClipKeyframesInterpolation,
  setTimelinePlayhead,
  setTimelineZoom,
  shouldSyncTimelineToMediaElement,
  splitTimelineClips,
  SplitTimelineRetainSide,
  TimelineClipboardItem,
  TimelineKeyframeClipboardItem,
  PreviewSnapLine,
  DEFAULT_TIMELINE_EDGE_SCROLL_MAX_SPEED,
  DEFAULT_TIMELINE_EDGE_SCROLL_THRESHOLD,
  TIMELINE_CLIP_HEIGHT_PX,
  TIMELINE_COLLAPSED_CLIP_HEIGHT_PX,
  TIMELINE_EMPTY_MEDIA_BUTTON_HEIGHT_PX,
  TIMELINE_FRAME_STEP_SECONDS,
  TIMELINE_JUMP_STEP_SECONDS,
  TIMELINE_TRACK_GAP_PX,
  TimelineSnapPoint,
  snapOverlayRect,
  trimTimelineClip,
  trimTimelineClipGroup,
  trimTimelineClipWithRipple,
  timelineSliderToZoom,
  timelineZoomToSlider,
  toggleTimelineBookmark,
  toggleTimelineSourceAudioSeparation,
  unlinkTimelineClips,
  upsertTimelineClipKeyframe,
  updateTimelineBookmark,
  updateTimelineClip,
  updateTimelineClipRect,
  updateTimelineTrack,
} from '@/app/_features/node-timeline';
import { useTimelineZoom } from '@/app/_features/node-timeline/hooks/use-timeline-zoom';

export interface NodeTimelineAssetRequest {
  nodeId: string;
  trackId?: string | null;
  startTime: number;
}

interface NodeTimelineEditorProps {
  onRequestMediaClip: (request: NodeTimelineAssetRequest) => void;
}

type OverlayResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

type OverlayDragState =
  | {
      clipId: string;
      mode: 'move';
      offsetX: number;
      offsetY: number;
      originX: number;
      originY: number;
    }
  | {
      clipId: string;
      mode: 'resize';
      handle: OverlayResizeHandle;
      originRect: OverlayRect;
      originX: number;
      originY: number;
    }
  | {
      clipId: string;
      mode: 'rotate';
      centerX: number;
      centerY: number;
      originAngle: number;
      originRotation: number;
      originX: number;
      originY: number;
    };

interface TimelineDragState {
  clipId: string;
  clipIds: string[];
  mode: 'move' | 'trim-left' | 'trim-right';
  offsetTime: number;
  originX: number;
  originY: number;
}

interface TimelineBookmarkDragState {
  bookmarkId: string;
}

interface TimelineKeyframeDragState {
  clipId: string;
  keyframeIds: string[];
  anchorLocalTime: number;
  originX: number;
  originY: number;
}

interface TimelineHistoryState {
  past: NodeTimeline[];
  future: NodeTimeline[];
}

interface TimelineWriteOptions {
  history?: boolean;
}

interface TimelineClipboardState {
  items: TimelineClipboardItem[];
}

interface TimelineKeyframeClipboardState {
  items: TimelineKeyframeClipboardItem[];
}

interface TimelineMarqueeState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  baseClipIds: string[];
  additive: boolean;
}

interface TimelineContextMenuState {
  x: number;
  y: number;
  kind: 'clip' | 'track' | 'keyframe';
  time: number;
  clipId?: string;
  keyframeIds?: string[];
  trackId?: string;
  trackType?: TimelineTrackType;
}

interface TimelineNewTrackDropIndicator {
  insertIndex: number;
  top: number;
}

interface TimelineTrackReorderTarget {
  insertIndex: number;
  top: number;
}

interface TimelineTrackReorderState extends TimelineTrackReorderTarget {
  trackId: string;
  originY: number;
  hasMoved: boolean;
}

type LibraryTab = 'assets' | 'interactions' | 'audio';
type AssetViewMode = 'grid' | 'list';
type AssetSortMode = 'recent' | 'name';

type NodeTimelineTranslator = ReturnType<typeof useTranslations<'nodeTimeline'>>;

const TIMELINE_HISTORY_LIMIT = 80;
const MAX_AUDIO_WAVEFORM_BARS = 160;
const POINTER_DRAG_THRESHOLD_PX = 5;
const OVERLAY_ROTATION_DEAD_ZONE_PX = 28;
const OVERLAY_ROTATION_SNAP_THRESHOLD_DEG = 2;
const OVERLAY_ROTATION_SNAP_ANGLES = [0, 90, 180, 270] as const;
const AUDIO_VOLUME_LINE_HIT_AREA_PX = 16;
const TIMELINE_KEYFRAME_INDICATOR_MIN_WIDTH_PX = 42;
const TIMELINE_KEYFRAME_LANE_HEIGHT_PX = 24;
const TIMELINE_KEYFRAME_LANES_GAP_PX = 6;
const TIMELINE_KEYFRAME_LANES_BOTTOM_PADDING_PX = 6;

const timelineKeyframeLanePropertyOrder: TimelineKeyframeProperty[] = ['opacity', 'rotation', 'x', 'y', 'width', 'height', 'volume'];
const DEFAULT_PREVIEW_ASPECT_RATIO = 16 / 9;
const MIN_PREVIEW_ASPECT_RATIO = 1 / 4;
const MAX_PREVIEW_ASPECT_RATIO = 4;

const getFittedPreviewFrameSize = ({
  aspectRatio,
  viewportHeight,
  viewportWidth,
}: {
  aspectRatio: number;
  viewportHeight: number;
  viewportWidth: number;
}) => {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return null;
  }

  const widthFromViewport = viewportWidth;
  const heightFromWidth = widthFromViewport / aspectRatio;
  if (heightFromWidth <= viewportHeight) {
    return { width: widthFromViewport, height: heightFromWidth };
  }

  return { width: viewportHeight * aspectRatio, height: viewportHeight };
};

const getPreviewAspectRatio = (width: number, height: number) => {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return null;
  return Math.max(MIN_PREVIEW_ASPECT_RATIO, Math.min(MAX_PREVIEW_ASPECT_RATIO, width / height));
};

const getAssetAspectRatio = (asset?: OpenFMVAsset | null) => {
  return getPreviewAspectRatio(Number(asset?.metadata?.width), Number(asset?.metadata?.height));
};

const getClipAsset = (clip: TimelineMediaClip | null | undefined, assets: TimelineAssetItem[]) => {
  if (!clip) return null;
  return assets.find((item) => item.asset.id === clip.assetId)?.asset
    ?? assets.find((item) => getAssetSource(item.asset) === clip.src)?.asset
    ?? null;
};

const interactionIcons = {
  button: MousePointerClick,
} satisfies Record<TimelineInteractionClipType, LucideIcon>;

const interactionPanelClipTypes = ['button'] as const satisfies readonly TimelineInteractionClipType[];

const overlayResizeHandles = [
  { handle: 'nw', className: 'left-1 top-1 cursor-nwse-resize' },
  { handle: 'ne', className: 'right-1 top-1 cursor-nesw-resize' },
  { handle: 'sw', className: 'bottom-1 left-1 cursor-nesw-resize' },
  { handle: 'se', className: 'bottom-1 right-1 cursor-nwse-resize' },
] satisfies Array<{ handle: OverlayResizeHandle; className: string }>;

const arePreviewSnapLinesEqual = (currentLines: PreviewSnapLine[], nextLines: PreviewSnapLine[]) => {
  if (currentLines.length !== nextLines.length) return false;
  return currentLines.every((line, index) => {
    const nextLine = nextLines[index];
    return line.orientation === nextLine.orientation && Math.abs(line.position - nextLine.position) <= 0.0001;
  });
};

const mediaIcons = {
  video: Film,
  image: ImageIcon,
  audio: Music,
} satisfies Record<TimelineMediaClipType, LucideIcon>;

const decodedAudioBufferCache = new Map<string, Promise<AudioBuffer>>();

const loadDecodedAudioBuffer = async (src: string) => {
  const AudioContextConstructor = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) throw new Error('Web Audio API is not available.');

  const response = await fetch(src);
  if (!response.ok) throw new Error(`Failed to load audio waveform source: ${response.status}`);

  const context = new AudioContextConstructor();
  try {
    return await context.decodeAudioData(await response.arrayBuffer());
  } finally {
    void context.close().catch(() => undefined);
  }
};

const getDecodedAudioBuffer = (src: string) => {
  const cached = decodedAudioBufferCache.get(src);
  if (cached) return cached;

  const promise = loadDecodedAudioBuffer(src).catch((error) => {
    decodedAudioBufferCache.delete(src);
    throw error;
  });
  decodedAudioBufferCache.set(src, promise);
  return promise;
};

const buildAudioWaveformPlaceholder = (barCount: number) => {
  return Array.from({ length: barCount }, (_, index) => {
    const pulse = Math.abs(Math.sin(index * 0.85) * Math.cos(index * 0.23));
    return 0.18 + pulse * 0.48;
  });
};

const getNodeTitle = (node: AppNode, t?: NodeTimelineTranslator) => {
  if (node.data.type === 'start') return node.data.label || t?.('fallback.start') || 'Start';
  if (node.data.type === 'end') return node.data.label || t?.('fallback.end') || 'End';
  return node.data.title || t?.('fallback.story') || 'Scene';
};

const getNodeSubtitle = (node: AppNode) => {
  return node.data.bodyText || '';
};

const isMediaClip = (clip: TimelineClip): clip is TimelineMediaClip => isMediaClipType(clip.type);

const isInteractionClip = (clip: TimelineClip): clip is TimelineInteractionClip => isInteractionClipType(clip.type);

const isShortcutEditingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
};

const isTimelineMediaAsset = (asset: OpenFMVAsset): asset is OpenFMVAsset & { type: TimelineMediaClipType } => {
  return asset.type === 'image' || asset.type === 'video' || asset.type === 'audio';
};

const isNodeTimelineLibraryAsset = isTimelineMediaAsset;

const getAssetDuration = (asset: OpenFMVAsset) => {
  const duration = Number(asset.metadata?.duration);
  return Number.isFinite(duration) && duration > 0 ? duration : undefined;
};

const getAssetDurationLabel = (asset: OpenFMVAsset) => {
  const duration = getAssetDuration(asset);
  if (!duration) return '';
  const totalSeconds = Math.max(0, Math.round(duration));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  if (minutes > 0) return `${minutes}:${String(seconds).padStart(2, '0')}`;
  return `${seconds}s`;
};

const getTimelineClipKeyframeLanes = (clip: TimelineClip) => {
  const keyframes = clip.keyframes || [];
  return timelineKeyframeLanePropertyOrder
    .map((property) => ({
      property,
      keyframes: keyframes.filter((keyframe) => keyframe.property === property),
    }))
    .filter((lane) => lane.keyframes.length > 0);
};

const getTimelineKeyframePropertyLabel = (t: NodeTimelineTranslator, property: TimelineKeyframeProperty) => {
  if (property === 'x') return t('fields.x');
  if (property === 'y') return t('fields.y');
  if (property === 'width') return t('fields.width');
  if (property === 'height') return t('fields.height');
  return t(`fields.${property}`);
};

const getAssetDimensionLabel = (asset: OpenFMVAsset) => {
  const width = Number(asset.metadata?.width);
  const height = Number(asset.metadata?.height);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return '';
  return `${Math.round(width)}x${Math.round(height)}`;
};

const getAssetSizeLabel = (asset: OpenFMVAsset) => {
  const size = Number(asset.metadata?.size);
  if (!Number.isFinite(size) || size <= 0) return '';
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
};

const getAssetMetadataLabel = (asset: OpenFMVAsset) => {
  return [getAssetDurationLabel(asset), getAssetDimensionLabel(asset), getAssetSizeLabel(asset)].filter(Boolean).join(' / ');
};

const normalizeQteKeyLabel = (value: string | undefined) => {
  const label = value?.trim();
  if (!label) return 'Space';
  if (label === ' ') return 'Space';
  if (label.length === 1) return label.toUpperCase();
  return label === 'Escape' ? 'Esc' : label;
};

const clampQteClickCount = (value: unknown) => {
  const count = Number(value);
  if (!Number.isFinite(count)) return 1;
  return Math.max(1, Math.min(20, Math.round(count)));
};

const getQteClickLabel = (clickCount?: number) => {
  const count = clampQteClickCount(clickCount);
  return count > 1 ? `Click x${count}` : 'Click';
};

const getQteInputLabel = (input: ButtonQteInput | undefined, keyLabel?: string, clickCount?: number) => (
  input === 'space' ? normalizeQteKeyLabel(keyLabel === 'Click' ? undefined : keyLabel) : getQteClickLabel(clickCount)
);

const getQteCueLabel = (config: ButtonQteConfig) => {
  if (config.input === 'space') return normalizeQteKeyLabel(config.keyLabel);
  const count = clampQteClickCount(config.clickCount);
  return count > 1 ? `x${count}` : null;
};

const getQteConfig = (clip: TimelineInteractionClip): ButtonQteConfig => {
  const input = clip.qte?.input === 'space' ? 'space' : 'click';
  return {
    input,
    prompt: clip.qte?.prompt,
    clickCount: clampQteClickCount(clip.qte?.clickCount),
    keyLabel: getQteInputLabel(input, clip.qte?.keyLabel, clip.qte?.clickCount),
    showCountdown: clip.qte?.showCountdown !== false,
    showCueLabel: clip.qte?.showCueLabel !== false,
  };
};

const getTrackIcon = (track: TimelineTrack) => {
  if (track.type === 'interaction') return MousePointerClick;
  if (getTrackMediaRole(track) === 'audio') return Music;
  if (getTrackMediaRole(track) === 'overlay') return Layers;
  return Film;
};

const getClipTone = (clip: TimelineClip, selected: boolean) => {
  const base = 'group absolute flex h-openfmv-control min-w-10 select-none items-center overflow-hidden rounded-openfmv-tool border px-2 text-left text-xs font-semibold shadow-[0_12px_28px_rgba(0,0,0,0.28)] transition';
  const ring = selected ? 'ring-2 ring-white/90' : 'hover:ring-1 hover:ring-white/50';
  const disabled = clip.enabled === false || clip.hidden ? 'opacity-45 grayscale' : '';
  const muted = canTimelineClipHaveAudio(clip) && clip.muted ? 'saturate-50' : '';
  const linked = clip.linkGroupId ? 'outline outline-1 outline-offset-[-3px] outline-white/45' : '';
  if (clip.type === 'video') return `${base} ${ring} ${disabled} ${muted} ${linked} border-sky-300/55 bg-sky-500/52 text-white`;
  if (clip.type === 'image') return `${base} ${ring} ${disabled} ${muted} ${linked} border-emerald-300/55 bg-emerald-500/48 text-white`;
  if (clip.type === 'audio') return `${base} ${ring} ${disabled} ${muted} ${linked} border-fuchsia-300/50 bg-fuchsia-500/42 text-white`;
  if (clip.type === 'button' && isQteButtonClip(clip)) return `${base} ${ring} ${disabled} ${muted} ${linked} border-cyan-200/75 bg-cyan-500/52 text-white`;
  if (clip.type === 'button') return `${base} ${ring} ${disabled} ${muted} ${linked} border-orange-200/70 bg-orange-500/72 text-white`;
  return `${base} ${ring} ${disabled} ${muted} ${linked} border-white/20 bg-white/12 text-white`;
};

const getPreviewClipClassName = (clip: TimelineInteractionClip, selected: boolean, active: boolean) => {
  const base = 'absolute flex min-h-openfmv-control min-w-12 items-center justify-center overflow-hidden rounded-openfmv-tool border px-2 text-xs font-bold text-white shadow-[0_18px_52px_rgba(0,0,0,0.38)] backdrop-blur-xl transition hover:scale-[1.02]';
  const tone = isQteButtonClip(clip) ? 'border-cyan-200/90 bg-cyan-500/92' : 'border-orange-200/90 bg-orange-500/92';
  return `${base} ${tone} ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''} ${active || selected ? '' : 'opacity-45'}`;
};

type FloatingToolbarPlacement = 'above' | 'below';

const getButtonFloatingToolbarPlacement = (clip: TimelineInteractionClip): {
  panelPlacement: FloatingToolbarPlacement;
  style: React.CSSProperties;
} => {
  const rect = getClipRect(clip);
  const centerX = Math.min(0.86, Math.max(0.14, rect.x + rect.width / 2));
  const panelPlacement: FloatingToolbarPlacement = rect.y + rect.height <= 0.58 ? 'below' : 'above';
  const top = panelPlacement === 'below'
    ? Math.min(0.9, rect.y + rect.height + 0.035)
    : Math.max(0.025, rect.y - 0.12);
  return {
    panelPlacement,
    style: {
      left: `${centerX * 100}%`,
      top: `${top * 100}%`,
      transform: 'translateX(-50%)',
    },
  };
};

const getButtonRotationHandleAnchorStyle = (clip: TimelineInteractionClip): React.CSSProperties => {
  const rect = getClipRect(clip);
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
    transform: `rotate(${getTimelineClipRotation(clip)}deg)`,
    transformOrigin: 'center',
  };
};

const getPreviewFrameClassName = () => {
  return 'relative shrink-0 overflow-visible border border-white/20 bg-black shadow-[0_18px_52px_rgba(0,0,0,0.22)]';
};

const TIMELINE_PLAYBACK_PAUSE_EPSILON = 0.001;

const getPauseOnShowPlaybackStop = ({
  clips,
  currentTime,
  nextTime,
  pausedClipIds,
}: {
  clips: TimelineInteractionClip[];
  currentTime: number;
  nextTime: number;
  pausedClipIds: Set<string>;
}) => {
  if (nextTime < currentTime) return null;
  const pauseClip = clips
    .filter((clip) => clip.pauseOnShow && !pausedClipIds.has(clip.id))
    .map((clip) => ({
      clip,
      pauseTime: isQteButtonClip(clip)
        ? clip.startTime
        : Math.max(clip.startTime, getClipEndTime(clip) - TIMELINE_PLAYBACK_PAUSE_EPSILON),
    }))
    .filter(({ pauseTime }) => pauseTime <= nextTime + TIMELINE_PLAYBACK_PAUSE_EPSILON && pauseTime >= currentTime - TIMELINE_PLAYBACK_PAUSE_EPSILON)
    .sort((first, second) => first.pauseTime - second.pauseTime || first.clip.duration - second.clip.duration)
    .at(0);
  if (!pauseClip) return null;
  return {
    clipId: pauseClip.clip.id,
    time: pauseClip.pauseTime,
  };
};

const getMediaClipRect = (clip?: TimelineMediaClip | null): OverlayRect => {
  return clip?.rect || { x: 0, y: 0, width: 1, height: 1 };
};

const getPreviewElementRect = (clip: TimelineInteractionClip | TimelineMediaClip): OverlayRect => {
  return isMediaClip(clip) ? getMediaClipRect(clip) : getClipRect(clip);
};

const getMediaClipFitClassName = (clip?: TimelineMediaClip | null) => {
  const fit = clip?.fit || 'contain';
  return `h-full w-full ${fit === 'cover' ? 'object-cover' : 'object-contain'}`;
};

const getTimelineClipOpacity = (clip?: Pick<TimelineClip, 'opacity'> | null) => {
  return clampTimelineClipOpacity(clip?.opacity);
};

const getTimelineClipRotation = (clip?: Pick<TimelineClip, 'rotation'> | null) => {
  return clampTimelineClipRotation(clip?.rotation);
};

const getPointerAngleDegrees = (centerX: number, centerY: number, clientX: number, clientY: number) => {
  return Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
};

const getShortestRotationDelta = (angle: number, originAngle: number) => {
  const delta = angle - originAngle;
  return ((((delta + 180) % 360) + 360) % 360) - 180;
};

const roundOverlayRotation = (rotation: number) => {
  return Math.round(clampTimelineClipRotation(rotation) * 10) / 10;
};

const snapOverlayRotation = (rotation: number) => {
  let closestRotation = rotation;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const snapAngle of OVERLAY_ROTATION_SNAP_ANGLES) {
    const candidate = snapAngle + Math.round((rotation - snapAngle) / 360) * 360;
    const distance = Math.abs(rotation - candidate);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestRotation = candidate;
    }
  }

  return closestDistance <= OVERLAY_ROTATION_SNAP_THRESHOLD_DEG ? closestRotation : rotation;
};

const clampTimelineAudioVolume = (volume: unknown) => {
  const value = Number(volume);
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(2, value));
};

const roundTimelineAudioVolume = (volume: number) => {
  return Math.round(clampTimelineAudioVolume(volume) * 100) / 100;
};

const getAudioVolumeLineTop = (volume: unknown) => {
  return `${(1 - clampTimelineAudioVolume(volume) / 2) * 100}%`;
};

const getAudioVolumeLabel = (volume: unknown) => {
  return `${Math.round(clampTimelineAudioVolume(volume) * 100)}%`;
};

const applyTimelineMediaPlaybackOptions = (element: HTMLMediaElement, clip: TimelineMediaClip) => {
  element.playbackRate = getTimelineMediaPlaybackRate(clip);
  if ('preservesPitch' in element) element.preservesPitch = clip.preservePitch !== false;
};

const assignVideoRef = (ref: React.Ref<HTMLVideoElement> | undefined, value: HTMLVideoElement | null) => {
  if (!ref) return;
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  (ref as React.MutableRefObject<HTMLVideoElement | null>).current = value;
};

function PreviewMediaLayer({
  clip,
  selected,
  currentTime,
  isTimelinePlaying,
  playerRef,
  onPointerDown,
  onClick,
  onResizePointerDown,
  onAspectRatioReady,
}: {
  clip: TimelineMediaClip & { type: 'video' | 'image' };
  selected: boolean;
  currentTime: number;
  isTimelinePlaying: boolean;
  playerRef?: React.Ref<HTMLVideoElement>;
  onPointerDown: (clip: TimelineMediaClip, event: React.PointerEvent<HTMLElement>) => void;
  onClick: (clipId: string) => void;
  onResizePointerDown: (clip: TimelineMediaClip, handle: OverlayResizeHandle, event: React.PointerEvent<HTMLElement>) => void;
  onAspectRatioReady?: (clipId: string, aspectRatio: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const resolvedImageSrc = useResolvedMediaSrc(clip.type === 'image' ? clip.src : undefined);
  const rect = getMediaClipRect(clip);
  const freezeFrameTime = clip.type === 'video' && Number.isFinite(Number(clip.freezeFrameTime)) ? Math.max(0, Number(clip.freezeFrameTime)) : null;
  const localTime = getTimelineMediaElementTime(clip, currentTime);
  const sourceEnded = clip.type === 'video' && hasTimelineMediaSourceEnded(clip, currentTime);
  const reportNaturalSize = useCallback((width: number, height: number) => {
    const aspectRatio = getPreviewAspectRatio(width, height);
    if (aspectRatio) onAspectRatioReady?.(clip.id, aspectRatio);
  }, [clip.id, onAspectRatioReady]);

  const setVideoRef = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    assignVideoRef(playerRef, element);
  }, [playerRef]);

  useEffect(() => {
    if (clip.type !== 'video') return;
    const video = videoRef.current;
    if (!video) return;
    applyTimelineMediaPlaybackOptions(video, clip);

    if (Number.isFinite(localTime) && Math.abs(video.currentTime - localTime) > 0.25) {
      video.currentTime = localTime;
    }

    if (!isTimelinePlaying || freezeFrameTime !== null || sourceEnded) {
      video.pause();
      return;
    }

    void video.play().catch(() => undefined);
  }, [clip, freezeFrameTime, isTimelinePlaying, localTime, sourceEnded]);

  useEffect(() => {
    if (clip.type !== 'video' || !onAspectRatioReady) return;
    const video = videoRef.current;
    if (!video) return;

    const syncAspectRatio = () => reportNaturalSize(video.videoWidth, video.videoHeight);
    syncAspectRatio();
    video.addEventListener('loadedmetadata', syncAspectRatio);
    video.addEventListener('loadeddata', syncAspectRatio);
    return () => {
      video.removeEventListener('loadedmetadata', syncAspectRatio);
      video.removeEventListener('loadeddata', syncAspectRatio);
    };
  }, [clip.src, clip.type, onAspectRatioReady, reportNaturalSize]);

  return (
    <div
      data-node-preview-media-frame
      data-node-preview-media-clip-id={clip.id}
      onPointerDown={(event) => onPointerDown(clip, event)}
      onClick={() => onClick(clip.id)}
      className={`absolute cursor-move overflow-hidden transition ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''}`}
      style={{
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: `${rect.width * 100}%`,
        height: `${rect.height * 100}%`,
        opacity: getTimelineClipOpacity(clip),
        transform: `rotate(${getTimelineClipRotation(clip)}deg)`,
        transformOrigin: 'center',
      }}
    >
      {clip.type === 'video' ? (
        <OpenFMVVideo src={clip.src} poster={clip.poster} controls={false} muted={clip.muted === true} playsInline className={getMediaClipFitClassName(clip)} playerRef={setVideoRef} />
      ) : (
        <img src={resolvedImageSrc} alt={clip.name || ''} className={getMediaClipFitClassName(clip)} onLoad={(event) => reportNaturalSize(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)} />
      )}
      {selected && overlayResizeHandles.map((item) => (
        <span
          key={item.handle}
          data-node-media-resize-handle={item.handle}
          onPointerDown={(event) => onResizePointerDown(clip, item.handle, event)}
          className={`absolute z-20 h-2.5 w-2.5 rounded-full border border-white bg-sky-400 shadow-[0_0_0_2px_rgba(0,0,0,0.35)] ${item.className}`}
        />
      ))}
    </div>
  );
}

function PreviewAudioLayer({
  clip,
  currentTime,
  isTimelinePlaying,
}: {
  clip: TimelineMediaClip;
  currentTime: number;
  isTimelinePlaying: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const resolvedSrc = useResolvedMediaSrc(clip.src);
  const localTime = getTimelineMediaElementTime(clip, currentTime);
  const sourceEnded = hasTimelineMediaSourceEnded(clip, currentTime);
  const volume = Math.max(0, Math.min(1, clip.volume ?? 1));

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !resolvedSrc) return;
    audio.volume = volume;
    applyTimelineMediaPlaybackOptions(audio, clip);

    if (Number.isFinite(localTime) && Math.abs(audio.currentTime - localTime) > 0.25) {
      audio.currentTime = localTime;
    }

    if (!isTimelinePlaying || sourceEnded) {
      audio.pause();
      return;
    }

    void audio.play().catch(() => undefined);
  }, [clip, isTimelinePlaying, localTime, resolvedSrc, sourceEnded, volume]);

  return <audio ref={audioRef} src={resolvedSrc} muted={clip.muted === true} className="hidden" />;
}

function PreviewButtonRotationHandle({
  clip,
  dragging,
  label,
  onPointerDown,
}: {
  clip: TimelineInteractionClip;
  dragging: boolean;
  label: string;
  onPointerDown: (clip: TimelineInteractionClip, event: React.PointerEvent<HTMLElement>) => void;
}) {
  const rotation = getTimelineClipRotation(clip);

  return (
    <div
      data-node-overlay-rotation-anchor={clip.id}
      className="pointer-events-none absolute z-50"
      style={getButtonRotationHandleAnchorStyle(clip)}
    >
      <button
        type="button"
        title={label}
        aria-label={label}
        data-node-overlay-rotation-handle={clip.id}
        onPointerDown={(event) => onPointerDown(clip, event)}
        className={`pointer-events-auto absolute -right-5 -top-5 grid h-6 w-6 touch-none place-items-center text-sky-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] transition hover:text-sky-100 ${dragging ? 'cursor-grabbing scale-110 text-sky-100' : 'cursor-grab'}`}
        style={{
          transform: `rotate(${-rotation}deg)`,
          transformOrigin: 'center',
        }}
      >
        <RotateCw size={14} strokeWidth={2.4} />
      </button>
    </div>
  );
}

const getClipRect = (clip: TimelineInteractionClip): OverlayRect => {
  if ('rect' in clip && clip.rect) return clip.rect;
  return { x: 0.38, y: 0.76, width: 0.24, height: 0.1 };
};

const updateInteractionLabel = (clip: TimelineInteractionClip, value: string): TimelineInteractionClip => {
  return { ...clip, label: value, name: value };
};

const updateInteractionPauseMode = (clip: TimelineInteractionClip, pauseOnShow: boolean): TimelineInteractionClip => {
  return { ...clip, pauseOnShow };
};

const updateButtonMode = (clip: TimelineInteractionClip, mode: ButtonMode): TimelineInteractionClip => {
  if (mode !== 'qte') {
    const buttonClip = { ...clip };
    delete buttonClip.mode;
    delete buttonClip.qte;
    return buttonClip;
  }

  const qteConfig = getQteConfig(clip);
  return {
    ...clip,
    mode: 'qte',
    qte: {
      input: qteConfig.input,
      clickCount: clampQteClickCount(qteConfig.clickCount),
      keyLabel: getQteInputLabel(qteConfig.input, qteConfig.keyLabel, qteConfig.clickCount),
      showCountdown: qteConfig.showCountdown !== false,
      showCueLabel: qteConfig.showCueLabel !== false,
    },
  };
};

const updateInteractionQteConfig = (clip: TimelineInteractionClip, patch: Partial<ButtonQteConfig>): TimelineInteractionClip => {
  const currentQte = getQteConfig(clip);
  const mergedQte = {
    ...currentQte,
    ...patch,
  };
  const input = mergedQte.input === 'space' ? 'space' : 'click';
  const keyLabel = typeof patch.keyLabel === 'string'
    ? patch.keyLabel
    : input === currentQte.input ? currentQte.keyLabel : undefined;
  const nextQte: ButtonQteConfig = {
    input,
    clickCount: clampQteClickCount(mergedQte.clickCount),
    keyLabel: getQteInputLabel(input, keyLabel, mergedQte.clickCount),
    showCountdown: mergedQte.showCountdown !== false,
    showCueLabel: mergedQte.showCueLabel !== false,
  };
  return {
    ...clip,
    mode: 'qte',
    qte: nextQte,
  };
};

const getInteractionStyleMode = (clip: TimelineInteractionClip): ButtonMode => (
  isQteButtonClip(clip) ? 'qte' : 'normal'
);

const updateInteractionStyle = (clip: TimelineInteractionClip, patch: ButtonStyleConfig): TimelineInteractionClip => {
  const style = normalizeButtonStyleConfig({
    ...resolveButtonStyleConfig(clip),
    ...patch,
  }, getInteractionStyleMode(clip));
  return style ? { ...clip, style } : clip;
};

const updateInteractionRect = (clip: TimelineInteractionClip, rect: OverlayRect): TimelineInteractionClip => {
  const safeRect = clampOverlayRect(rect);
  return { ...clip, rect: safeRect };
};

const resizeOverlayRect = (originRect: OverlayRect, handle: OverlayResizeHandle, pointerX: number, pointerY: number) => {
  const right = originRect.x + originRect.width;
  const bottom = originRect.y + originRect.height;

  if (handle === 'nw') {
    return clampOverlayRect({
      x: pointerX,
      y: pointerY,
      width: right - pointerX,
      height: bottom - pointerY,
    });
  }

  if (handle === 'ne') {
    return clampOverlayRect({
      x: originRect.x,
      y: pointerY,
      width: pointerX - originRect.x,
      height: bottom - pointerY,
    });
  }

  if (handle === 'sw') {
    return clampOverlayRect({
      x: pointerX,
      y: originRect.y,
      width: right - pointerX,
      height: pointerY - originRect.y,
    });
  }

  return clampOverlayRect({
    x: originRect.x,
    y: originRect.y,
    width: pointerX - originRect.x,
    height: pointerY - originRect.y,
  });
};

const getWheelDeltaPixels = (event: React.WheelEvent<HTMLElement>, pageSize: number) => {
  if (event.deltaMode === 1) return event.deltaY * 16;
  if (event.deltaMode === 2) return event.deltaY * pageSize;
  return event.deltaY;
};

const hasPointerMovedPastDragThreshold = (originX: number, originY: number, clientX: number, clientY: number) => {
  return Math.abs(clientX - originX) > POINTER_DRAG_THRESHOLD_PX || Math.abs(clientY - originY) > POINTER_DRAG_THRESHOLD_PX;
};

const getSyncedScrollTop = (source: HTMLElement, target: HTMLElement) => {
  const sourceMaxScrollTop = Math.max(0, source.scrollHeight - source.clientHeight);
  const targetMaxScrollTop = Math.max(0, target.scrollHeight - target.clientHeight);
  if (sourceMaxScrollTop > 0 && source.scrollTop >= sourceMaxScrollTop - 1) return targetMaxScrollTop;
  return Math.max(0, Math.min(targetMaxScrollTop, source.scrollTop));
};

const getTimelineElementEdgeScroll = (
  scrollElement: HTMLElement,
  pointer: { clientX: number; clientY: number },
  contentWidth: number
) => {
  const viewportRect = scrollElement.getBoundingClientRect();
  return getTimelineEdgeScroll({
    pointerClientX: pointer.clientX,
    pointerClientY: pointer.clientY,
    viewportLeft: viewportRect.left,
    viewportTop: viewportRect.top,
    viewportWidth: scrollElement.clientWidth,
    viewportHeight: scrollElement.clientHeight,
    scrollLeft: scrollElement.scrollLeft,
    scrollTop: scrollElement.scrollTop,
    scrollWidth: scrollElement.scrollWidth,
    scrollHeight: scrollElement.scrollHeight,
    contentWidth,
    edgeThreshold: DEFAULT_TIMELINE_EDGE_SCROLL_THRESHOLD,
    maxScrollSpeed: DEFAULT_TIMELINE_EDGE_SCROLL_MAX_SPEED,
  });
};

export default function NodeTimelineEditor({ onRequestMediaClip }: NodeTimelineEditorProps) {
  const locale = useLocale();
  const t = useTranslations('nodeTimeline');
  const searchParams = useSearchParams();
  const projectId = searchParams.get('id');
  const assetInputRef = useRef<HTMLInputElement>(null);
  const previewViewportRef = useRef<HTMLDivElement>(null);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const timelineContentRef = useRef<HTMLDivElement>(null);
  const timelineTrackHeadsScrollRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<NodeTimeline>(ensureNodeTimeline());
  const currentTimeRef = useRef(0);
  const playbackNodeIdRef = useRef<string | null>(null);
  const previewPauseOnShowClipIdsRef = useRef<Set<string>>(new Set());
  const isSnappingEnabledRef = useRef(true);
  const overlaySnapLinesRef = useRef<PreviewSnapLine[]>([]);
  const timelineScrollSyncingRef = useRef(false);
  const timelineDragPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const timelineExternalDragPointerRef = useRef<{ clientX: number; clientY: number; updatedAt: number } | null>(null);
  const timelineBookmarkDragPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const timelineKeyframeDragPointerRef = useRef<{ clientX: number; clientY: number; shiftKey: boolean } | null>(null);
  const timelineMarqueePointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const timelineTrackReorderPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const timelineTrackReorderTargetRef = useRef<{ insertIndex: number; hasMoved: boolean } | null>(null);
  const timelineDragHistoryPushedRef = useRef(false);
  const timelineDragHistorySnapshotRef = useRef<NodeTimeline | null>(null);
  const timelineKeyframeDragHistoryPushedRef = useRef(false);
  const timelineKeyframeDragHistorySnapshotRef = useRef<NodeTimeline | null>(null);
  const audioVolumeHistoryPushedRef = useRef(false);
  const audioVolumeHistorySnapshotRef = useRef<NodeTimeline | null>(null);
  const overlayDragHistoryPushedRef = useRef(false);
  const overlayDragHistorySnapshotRef = useRef<NodeTimeline | null>(null);
  const overlayRotateStateRef = useRef<{ lastAngle: number; rotation: number } | null>(null);
  const timelineScrubPointerRef = useRef<{ clientX: number; clientY: number; shiftKey: boolean } | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [previewViewportSize, setPreviewViewportSize] = useState({ width: 0, height: 0 });
  const [previewClipAspectRatios, setPreviewClipAspectRatios] = useState<Record<string, number>>({});
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [selectedKeyframeIds, setSelectedKeyframeIds] = useState<string[]>([]);
  const [expandedKeyframeClipIds, setExpandedKeyframeClipIds] = useState<string[]>([]);
  const [clipClipboard, setClipClipboard] = useState<TimelineClipboardState | null>(null);
  const [keyframeClipboard, setKeyframeClipboard] = useState<TimelineKeyframeClipboardState | null>(null);
  const [activeLibraryTab, setActiveLibraryTab] = useState<LibraryTab>('assets');
  const [assetLibrary, setAssetLibrary] = useState<TimelineAssetItem[]>([]);
  const [assetViewMode, setAssetViewMode] = useState<AssetViewMode>('grid');
  const [assetSortMode, setAssetSortMode] = useState<AssetSortMode>('recent');
  const [isAssetDropActive, setIsAssetDropActive] = useState(false);
  const [isImportingAsset, setIsImportingAsset] = useState(false);
  const [assetLibraryError, setAssetLibraryError] = useState('');
  const [draggedAssetId, setDraggedAssetId] = useState<string | null>(null);
  const [draggedInteractionType, setDraggedInteractionType] = useState<TimelineInteractionClipType | null>(null);
  const [overlayDrag, setOverlayDrag] = useState<OverlayDragState | null>(null);
  const [overlaySnapLines, setOverlaySnapLines] = useState<PreviewSnapLine[]>([]);
  const [timelineDrag, setTimelineDrag] = useState<TimelineDragState | null>(null);
  const [timelineKeyframeDrag, setTimelineKeyframeDrag] = useState<TimelineKeyframeDragState | null>(null);
  const [timelineScrub, setTimelineScrub] = useState(false);
  const [bookmarkDrag, setBookmarkDrag] = useState<TimelineBookmarkDragState | null>(null);
  const [marqueeSelection, setMarqueeSelection] = useState<TimelineMarqueeState | null>(null);
  const [timelineContextMenu, setTimelineContextMenu] = useState<TimelineContextMenuState | null>(null);
  const [timelineHistory, setTimelineHistory] = useState<TimelineHistoryState>({ past: [], future: [] });
  const [dragTargetTrackId, setDragTargetTrackId] = useState<string | null>(null);
  const [newTrackDropIndicator, setNewTrackDropIndicator] = useState<TimelineNewTrackDropIndicator | null>(null);
  const [trackReorder, setTrackReorder] = useState<TimelineTrackReorderState | null>(null);
  const [isTimelineExternalDragActive, setIsTimelineExternalDragActive] = useState(false);
  const [currentSnapPoint, setCurrentSnapPoint] = useState<TimelineSnapPoint | null>(null);
  const [isSnappingEnabled, setIsSnappingEnabled] = useState(true);
  const [isRippleEditingEnabled, setIsRippleEditingEnabled] = useState(false);
  const [isTimelinePlaying, setIsTimelinePlaying] = useState(false);
  const { zoom, setZoom, zoomIn, zoomOut } = useTimelineZoom();

  const {
    nodes,
    edges,
    currentProjectId,
    onConnect,
    setEdges,
    updateNodeTimeline,
    saveProjectSession,
  } = useProjectSessionStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      currentProjectId: state.projectId,
      onConnect: state.onConnect,
      setEdges: state.setEdges,
      updateNodeTimeline: state.updateNodeTimeline,
      saveProjectSession: state.saveNow,
    }))
  );
  const {
    selectedNodeId,
    setSelectedNodeId,
  } = useEditorStore(
    useShallow((state) => ({
      selectedNodeId: state.selectedNodeId,
      setSelectedNodeId: state.setSelectedNodeId,
    }))
  );

  const activeNode = useMemo(() => {
    return selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) ?? null : null;
  }, [nodes, selectedNodeId]);
  const selectedOrFirstNode = activeNode ?? nodes.find((node) => node.type !== 'end') ?? nodes[0] ?? null;
  const timeline = useMemo(() => ensureNodeTimeline(selectedOrFirstNode?.data.timeline), [selectedOrFirstNode?.data.timeline]);
  const compiledTimeline = useMemo(() => compileNodeTimeline(timeline), [timeline]);
  const compiledTimelineRef = useRef(compiledTimeline);

  useEffect(() => {
    timelineRef.current = timeline;
  }, [timeline]);

  useEffect(() => {
    compiledTimelineRef.current = compiledTimeline;
  }, [compiledTimeline]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    const viewport = previewViewportRef.current;
    if (!viewport) return;

    const updatePreviewViewportSize = () => {
      const bounds = viewport.getBoundingClientRect();
      setPreviewViewportSize((current) => {
        const width = Math.round(bounds.width);
        const height = Math.round(bounds.height);
        if (current.width === width && current.height === height) return current;
        return { width, height };
      });
    };

    updatePreviewViewportSize();
    const resizeObserver = new ResizeObserver(updatePreviewViewportSize);
    resizeObserver.observe(viewport);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    isSnappingEnabledRef.current = isSnappingEnabled;
  }, [isSnappingEnabled]);

  const updateOverlaySnapLines = useCallback((nextLines: PreviewSnapLine[]) => {
    if (arePreviewSnapLinesEqual(overlaySnapLinesRef.current, nextLines)) return;
    overlaySnapLinesRef.current = nextLines;
    setOverlaySnapLines(nextLines);
  }, []);

  const handlePreviewMediaAspectRatioReady = useCallback((clipId: string, aspectRatio: number) => {
    setPreviewClipAspectRatios((currentRatios) => {
      if (Math.abs((currentRatios[clipId] ?? 0) - aspectRatio) <= 0.001) return currentRatios;
      return { ...currentRatios, [clipId]: aspectRatio };
    });
  }, []);

  const selectedClipRef = useMemo(() => findTimelineClip(timeline, selectedClipId), [selectedClipId, timeline]);
  const selectedClipRefs = useMemo(() => (
    selectedClipIds
      .map((clipId) => findTimelineClip(timeline, clipId))
      .filter((clipRef): clipRef is NonNullable<ReturnType<typeof findTimelineClip>> => Boolean(clipRef))
  ), [selectedClipIds, timeline]);
  const selectedClipIdSet = useMemo(() => new Set(selectedClipRefs.map((clipRef) => clipRef.clip.id)), [selectedClipRefs]);
  const selectedKeyframeIdSet = useMemo(() => new Set(selectedKeyframeIds), [selectedKeyframeIds]);
  const expandedKeyframeClipIdSet = useMemo(() => new Set(expandedKeyframeClipIds), [expandedKeyframeClipIds]);
  const selectedKeyframeRefs = useMemo(() => {
    const keyframeIdSet = new Set(selectedKeyframeIds);
    if (keyframeIdSet.size === 0) return [];

    return timeline.tracks.flatMap((track) => (
      track.clips.flatMap((clip) => (
        (clip.keyframes || [])
          .filter((keyframe) => keyframeIdSet.has(keyframe.id))
          .map((keyframe) => ({ track, clip, keyframe }))
      ))
    ));
  }, [selectedKeyframeIds, timeline.tracks]);
  const selectedEditableClipIds = useMemo(() => (
    selectedClipRefs
      .filter((clipRef) => !clipRef.track.locked)
      .map((clipRef) => clipRef.clip.id)
  ), [selectedClipRefs]);
  const selectedEditableClipRefs = useMemo(() => selectedClipRefs.filter((clipRef) => !clipRef.track.locked), [selectedClipRefs]);
  const selectedEditableAudibleClipRefs = useMemo(() => selectedEditableClipRefs.filter((clipRef) => canTimelineClipHaveAudio(clipRef.clip)), [selectedEditableClipRefs]);
  const selectedEditableAudibleClipIds = useMemo(() => selectedEditableAudibleClipRefs.map((clipRef) => clipRef.clip.id), [selectedEditableAudibleClipRefs]);
  const hasDisabledEditableClip = selectedEditableClipRefs.some((clipRef) => clipRef.clip.enabled === false);
  const hasHiddenEditableClip = selectedEditableClipRefs.some((clipRef) => clipRef.clip.hidden === true);
  const hasMutedEditableClip = selectedEditableAudibleClipRefs.some((clipRef) => canTimelineClipHaveAudio(clipRef.clip) && clipRef.clip.muted === true);
  const hasLinkedEditableClip = selectedEditableClipRefs.some((clipRef) => Boolean(clipRef.clip.linkGroupId));
  const canLinkSelectedClips = selectedEditableClipIds.length >= 2;
  const canUnlinkSelectedClips = selectedEditableClipIds.length > 0 && hasLinkedEditableClip;
  const canToggleSelectedClipLink = hasLinkedEditableClip ? canUnlinkSelectedClips : canLinkSelectedClips;
  const selectedClip = selectedClipRef?.clip ?? null;
  const selectedButtonToolbarClip = useMemo(() => {
    if (!selectedClip || !isInteractionClip(selectedClip) || selectedClip.type !== 'button') return null;
    return resolveTimelineClipKeyframes(selectedClip, currentTime);
  }, [currentTime, selectedClip]);
  const selectedClipKeyframesExpanded = Boolean(selectedClip && expandedKeyframeClipIdSet.has(selectedClip.id));
  const canToggleSelectedSourceAudio = selectedEditableClipRefs.length === 1 && selectedEditableClipRefs[0]?.clip.id === selectedClip?.id && canToggleTimelineSourceAudio(selectedClip);
  const selectedSourceAudioLabel = selectedClip && isTimelineSourceAudioSeparated(selectedClip) ? t('timeline.toolbar.recoverAudio') : t('timeline.toolbar.extractAudio');
  const activeVisualMediaClips = useMemo(() => (
    compiledTimeline.visualMediaClips
      .filter((clip): clip is TimelineMediaClip & { type: 'video' | 'image' } => isTimelineClipActive(clip, currentTime) && isVisualMediaClip(clip))
      .map((clip) => resolveTimelineClipKeyframes(clip, currentTime))
  ), [compiledTimeline.visualMediaClips, currentTime]);
  const visualMediaClip = activeVisualMediaClips.filter((clip) => clip.type === 'video').at(-1) ?? activeVisualMediaClips.at(-1) ?? null;
  const activeAudioClips = useMemo(() => (
    compiledTimeline.mediaClips
      .filter((clip): clip is TimelineMediaClip & { type: 'audio' } => clip.type === 'audio' && isTimelineClipActive(clip, currentTime))
      .map((clip) => resolveTimelineClipKeyframes(clip, currentTime))
  ), [compiledTimeline.mediaClips, currentTime]);
  const currentSplitTargetClipIds = useMemo(() => {
    return getTimelineSplitTargetClipIds({
      timeline,
      time: currentTime,
      clipIds: selectedEditableClipIds.length > 0 ? selectedEditableClipIds : undefined,
    });
  }, [currentTime, selectedEditableClipIds, timeline]);
  const currentBookmark = useMemo(() => findTimelineBookmarkAtTime(timeline, currentTime), [currentTime, timeline]);
  const contextMenuClipRef = useMemo(() => findTimelineClip(timeline, timelineContextMenu?.clipId ?? null), [timeline, timelineContextMenu?.clipId]);
  const contextMenuTrack = useMemo(() => timeline.tracks.find((track) => track.id === timelineContextMenu?.trackId) ?? null, [timeline.tracks, timelineContextMenu?.trackId]);
  const contextMenuTrackIndex = useMemo(() => (
    contextMenuTrack ? timeline.tracks.findIndex((track) => track.id === contextMenuTrack.id) : -1
  ), [contextMenuTrack, timeline.tracks]);
  const canMoveContextTrackUp = contextMenuTrackIndex > 0;
  const canMoveContextTrackDown = contextMenuTrackIndex >= 0 && contextMenuTrackIndex < timeline.tracks.length - 1;
  const canDeleteContextTrack = Boolean(contextMenuTrack && canDeleteTimelineTrack(contextMenuTrack));
  const canToggleContextSourceAudio = Boolean(contextMenuClipRef && !contextMenuClipRef.track.locked && canToggleTimelineSourceAudio(contextMenuClipRef.clip));
  const contextSourceAudioLabel = contextMenuClipRef && isTimelineSourceAudioSeparated(contextMenuClipRef.clip) ? t('timeline.context.recoverAudio') : t('timeline.context.extractAudio');
  const contextMenuBookmark = useMemo(() => (
    timelineContextMenu ? findTimelineBookmarkAtTime(timeline, timelineContextMenu.time) : null
  ), [timeline, timelineContextMenu]);
  const canUndoTimeline = timelineHistory.past.length > 0;
  const canRedoTimeline = timelineHistory.future.length > 0;
  const canSplitContextClip = Boolean(
    timelineContextMenu?.kind === 'clip' &&
    contextMenuClipRef &&
    !contextMenuClipRef.track.locked &&
    timelineContextMenu.time > contextMenuClipRef.clip.startTime + MIN_TIMELINE_CLIP_DURATION &&
    timelineContextMenu.time < getClipEndTime(contextMenuClipRef.clip) - MIN_TIMELINE_CLIP_DURATION
  );
  const canSplitSelectedClip = currentSplitTargetClipIds.length > 0;
  const freezeTargetClipRef = selectedEditableClipRefs.length === 1 && selectedEditableClipRefs[0]?.clip.type === 'video'
    ? selectedEditableClipRefs[0]
    : null;
  const canFreezeSelectedClip = Boolean(
    freezeTargetClipRef &&
    currentTime > freezeTargetClipRef.clip.startTime + MIN_TIMELINE_CLIP_DURATION &&
    currentTime < getClipEndTime(freezeTargetClipRef.clip) - MIN_TIMELINE_CLIP_DURATION
  );
  const canFreezeContextClip = Boolean(
    timelineContextMenu?.kind === 'clip' &&
    contextMenuClipRef &&
    !contextMenuClipRef.track.locked &&
    contextMenuClipRef.clip.type === 'video' &&
    timelineContextMenu.time > contextMenuClipRef.clip.startTime + MIN_TIMELINE_CLIP_DURATION &&
    timelineContextMenu.time < getClipEndTime(contextMenuClipRef.clip) - MIN_TIMELINE_CLIP_DURATION
  );
  const blueprintHref = getLocalizedPath(locale, `/editor${projectId ? `?id=${encodeURIComponent(projectId)}` : ''}`);
  const timelineWidth = Math.max(1, timeline.duration * zoom + 160);
  const ticks = useMemo(() => getTimelineRulerTicks({ duration: timeline.duration, zoom }), [timeline.duration, zoom]);
  const zoomSliderPosition = timelineZoomToSlider(zoom);
  const getExpandedKeyframeLaneCountForTrack = useCallback((track: TimelineTrack) => (
    Math.max(0, ...track.clips.map((clip) => (
      expandedKeyframeClipIdSet.has(clip.id) ? getTimelineClipKeyframeLanes(clip).length : 0
    )))
  ), [expandedKeyframeClipIdSet]);
  const getRenderedTrackHeight = useCallback((track: TimelineTrack) => {
    const baseHeight = getNodeTimelineTrackHeight(track);
    const laneCount = getExpandedKeyframeLaneCountForTrack(track);
    if (laneCount === 0) return baseHeight;
    return baseHeight + TIMELINE_KEYFRAME_LANES_GAP_PX + laneCount * TIMELINE_KEYFRAME_LANE_HEIGHT_PX + TIMELINE_KEYFRAME_LANES_BOTTOM_PADDING_PX;
  }, [getExpandedKeyframeLaneCountForTrack]);
  const fitTimelineToView = useCallback(() => {
    const scrollElement = timelineScrollRef.current;
    if (!scrollElement) return;

    setZoom(getFitTimelineZoom({ duration: timeline.duration, viewportWidth: scrollElement.clientWidth }));
    requestAnimationFrame(() => {
      scrollElement.scrollLeft = 0;
    });
  }, [setZoom, timeline.duration]);
  const marqueeRect = useMemo(() => {
    if (!marqueeSelection) return null;
    return {
      left: Math.min(marqueeSelection.startX, marqueeSelection.currentX),
      top: Math.min(marqueeSelection.startY, marqueeSelection.currentY),
      width: Math.abs(marqueeSelection.currentX - marqueeSelection.startX),
      height: Math.abs(marqueeSelection.currentY - marqueeSelection.startY),
    };
  }, [marqueeSelection]);
  const sortedAssetItems = useMemo(() => {
    return [...assetLibrary].sort((first, second) => {
      if (assetSortMode === 'name') return first.asset.name.localeCompare(second.asset.name);
      return new Date(second.asset.importedAt).getTime() - new Date(first.asset.importedAt).getTime();
    });
  }, [assetLibrary, assetSortMode]);
  const mediaAssetItems = useMemo(() => sortedAssetItems.filter((item) => isTimelineMediaAsset(item.asset)), [sortedAssetItems]);
  const audioAssetItems = useMemo(() => sortedAssetItems.filter((item) => item.asset.type === 'audio'), [sortedAssetItems]);
  const visibleMediaAssetItems = activeLibraryTab === 'audio' ? audioAssetItems : mediaAssetItems;
  const isMediaLibraryTab = activeLibraryTab === 'assets' || activeLibraryTab === 'audio';
  const activeImportAccept = activeLibraryTab === 'audio' ? 'audio/*' : 'image/*,video/*,audio/*';
  const activePanelTitle = activeLibraryTab === 'assets'
    ? t('panel.assets')
    : activeLibraryTab === 'interactions'
      ? t('panel.interactions')
      : t(`rail.${activeLibraryTab}`);
  const previewReferenceClip = useMemo(() => {
    if (activeVisualMediaClips.length > 0) return activeVisualMediaClips[0];
    if (selectedClip && isMediaClip(selectedClip) && isVisualMediaClip(selectedClip)) return selectedClip;
    return compiledTimeline.visualMediaClips.find((clip) => isVisualMediaClip(clip)) ?? null;
  }, [activeVisualMediaClips, compiledTimeline.visualMediaClips, selectedClip]);
  const previewCanvasAspectRatio = useMemo(() => (
    (previewReferenceClip ? previewClipAspectRatios[previewReferenceClip.id] : undefined)
      ?? getAssetAspectRatio(getClipAsset(previewReferenceClip, assetLibrary))
      ?? DEFAULT_PREVIEW_ASPECT_RATIO
  ), [assetLibrary, previewClipAspectRatios, previewReferenceClip]);
  const previewFrameSize = useMemo(() => getFittedPreviewFrameSize({
    aspectRatio: previewCanvasAspectRatio,
    viewportHeight: previewViewportSize.height,
    viewportWidth: previewViewportSize.width,
  }), [previewCanvasAspectRatio, previewViewportSize.height, previewViewportSize.width]);

  const selectClipIds = useCallback((clipIds: string[], primaryClipId?: string | null) => {
    const uniqueClipIds = Array.from(new Set(clipIds));
    setSelectedClipIds(uniqueClipIds);
    setSelectedClipId(primaryClipId && uniqueClipIds.includes(primaryClipId) ? primaryClipId : uniqueClipIds[0] ?? null);
    setSelectedKeyframeIds([]);
  }, []);

  const selectSingleClip = useCallback((clipId: string | null) => {
    selectClipIds(clipId ? [clipId] : [], clipId);
  }, [selectClipIds]);

  const selectLinkedClipGroup = useCallback((clipId: string | null) => {
    if (!clipId) {
      selectSingleClip(null);
      return;
    }
    selectClipIds(getLinkedTimelineClipIds({ timeline, clipIds: [clipId] }), clipId);
  }, [selectClipIds, selectSingleClip, timeline]);

  const refreshAssetLibrary = useCallback(() => {
    const projects = listLocalProjects().map(resolveLocalProjectForEditor);
    setAssetLibrary(buildTimelineAssetLibraryItems({
      projects,
      currentProjectId,
      isAssetSupported: isNodeTimelineLibraryAsset,
    }));
  }, [currentProjectId]);

  useEffect(() => {
    if (!selectedOrFirstNode) return;
    if (selectedOrFirstNode.id !== selectedNodeId) setSelectedNodeId(selectedOrFirstNode.id);
  }, [selectedNodeId, selectedOrFirstNode, setSelectedNodeId]);

  useEffect(() => {
    setTimelineHistory({ past: [], future: [] });
  }, [selectedOrFirstNode?.id]);

  useEffect(() => {
    refreshAssetLibrary();
  }, [refreshAssetLibrary]);

  useEffect(() => {
    if (activeLibraryTab === 'assets' || activeLibraryTab === 'audio') refreshAssetLibrary();
  }, [activeLibraryTab, refreshAssetLibrary]);

  useEffect(() => {
    window.addEventListener('focus', refreshAssetLibrary);
    return () => window.removeEventListener('focus', refreshAssetLibrary);
  }, [refreshAssetLibrary]);

  useEffect(() => {
    const validClipIds = selectedClipIds.filter((clipId) => Boolean(findTimelineClip(timeline, clipId)));
    if (validClipIds.join('|') !== selectedClipIds.join('|')) {
      setSelectedClipIds(validClipIds);
    }
    if (selectedClipId && !validClipIds.includes(selectedClipId)) {
      setSelectedClipId(validClipIds[0] ?? null);
    }
  }, [selectedClipId, selectedClipIds, timeline]);

  useEffect(() => {
    if (selectedKeyframeIds.length === 0) return;
    const validKeyframeIds = new Set(timeline.tracks.flatMap((track) => track.clips.flatMap((clip) => (clip.keyframes || []).map((keyframe) => keyframe.id))));
    const nextSelectedKeyframeIds = selectedKeyframeIds.filter((keyframeId) => validKeyframeIds.has(keyframeId));
    if (nextSelectedKeyframeIds.join('|') !== selectedKeyframeIds.join('|')) {
      setSelectedKeyframeIds(nextSelectedKeyframeIds);
    }
  }, [selectedKeyframeIds, timeline.tracks]);

  useEffect(() => {
    if (expandedKeyframeClipIds.length === 0) return;
    const expandableClipIds = new Set(timeline.tracks.flatMap((track) => track.clips.filter((clip) => (clip.keyframes?.length || 0) > 0).map((clip) => clip.id)));
    const nextExpandedClipIds = expandedKeyframeClipIds.filter((clipId) => expandableClipIds.has(clipId));
    if (nextExpandedClipIds.join('|') !== expandedKeyframeClipIds.join('|')) {
      setExpandedKeyframeClipIds(nextExpandedClipIds);
    }
  }, [expandedKeyframeClipIds, timeline.tracks]);

  useEffect(() => {
    if (!selectedOrFirstNode?.id) return;
    const nextZoom = timelineRef.current.zoom || DEFAULT_TIMELINE_ZOOM;
    setZoom((current) => (Math.abs(current - nextZoom) <= 0.001 ? current : nextZoom));
  }, [selectedOrFirstNode?.id, setZoom]);

  useEffect(() => {
    const nextNodeId = selectedOrFirstNode?.id ?? null;
    if (playbackNodeIdRef.current === nextNodeId) return;
    playbackNodeIdRef.current = nextNodeId;
    previewPauseOnShowClipIdsRef.current = new Set();
    setIsTimelinePlaying(false);
  }, [selectedOrFirstNode?.id]);

  useEffect(() => {
    if (!selectedOrFirstNode?.id) return;
    const nextTimeline = timelineRef.current;
    const nextTime = clampTimelineTime(nextTimeline.playheadTime ?? 0, nextTimeline.duration);
    if (Math.abs(currentTimeRef.current - nextTime) > 0.001) setCurrentTime(nextTime);
  }, [selectedOrFirstNode?.id]);

  const applyTimeline = useCallback(
    (nextTimeline: NodeTimeline) => {
      if (!selectedOrFirstNode) return;
      updateNodeTimeline(selectedOrFirstNode.id, nextTimeline);
    },
    [selectedOrFirstNode, updateNodeTimeline]
  );

  const pushTimelineHistory = useCallback((snapshot: NodeTimeline) => {
    setTimelineHistory((history) => {
      const previousSnapshot = history.past.at(-1);
      if (previousSnapshot === snapshot) return history;
      return {
        past: [...history.past.slice(-(TIMELINE_HISTORY_LIMIT - 1)), snapshot],
        future: [],
      };
    });
  }, []);

  const writeTimeline = useCallback(
    (nextTimeline: NodeTimeline, options: TimelineWriteOptions = {}) => {
      if (nextTimeline === timeline) return;
      if (options.history !== false) pushTimelineHistory(timeline);
      applyTimeline(nextTimeline);
    },
    [applyTimeline, pushTimelineHistory, timeline]
  );

  const resetTimelineSelectionForHistory = useCallback((nextTimeline: NodeTimeline) => {
    selectSingleClip(null);
    setTimelineContextMenu(null);
    setIsTimelinePlaying(false);
    setCurrentSnapPoint(null);
    setCurrentTime(clampTimelineTime(nextTimeline.playheadTime ?? currentTime, nextTimeline.duration));
  }, [currentTime, selectSingleClip]);

  const undoTimeline = useCallback(() => {
    const previousTimeline = timelineHistory.past.at(-1);
    if (!previousTimeline) return;
    setTimelineHistory({
      past: timelineHistory.past.slice(0, -1),
      future: [timeline, ...timelineHistory.future].slice(0, TIMELINE_HISTORY_LIMIT),
    });
    resetTimelineSelectionForHistory(previousTimeline);
    applyTimeline(previousTimeline);
  }, [applyTimeline, resetTimelineSelectionForHistory, timeline, timelineHistory]);

  const redoTimeline = useCallback(() => {
    const nextTimeline = timelineHistory.future[0];
    if (!nextTimeline) return;
    setTimelineHistory({
      past: [...timelineHistory.past.slice(-(TIMELINE_HISTORY_LIMIT - 1)), timeline],
      future: timelineHistory.future.slice(1),
    });
    resetTimelineSelectionForHistory(nextTimeline);
    applyTimeline(nextTimeline);
  }, [applyTimeline, resetTimelineSelectionForHistory, timeline, timelineHistory]);

  useEffect(() => {
    if (!selectedOrFirstNode) return;
    const nextTimeline = setTimelineZoom(timeline, zoom);
    if (nextTimeline.zoom !== selectedOrFirstNode.data.timeline?.zoom) writeTimeline(nextTimeline, { history: false });
  }, [selectedOrFirstNode, timeline, writeTimeline, zoom]);

  useEffect(() => {
    if (!selectedOrFirstNode || isTimelinePlaying || timelineScrub) return;
    const nextTimeline = setTimelinePlayhead(timeline, currentTime);
    const nextPlayheadTime = nextTimeline.playheadTime ?? 0;
    const previousPlayheadTime = timeline.playheadTime;
    if (previousPlayheadTime === undefined && Math.abs(nextPlayheadTime) <= 0.001) return;
    if (previousPlayheadTime !== undefined && Math.abs(nextPlayheadTime - previousPlayheadTime) <= 0.001) return;
    writeTimeline(nextTimeline, { history: false });
  }, [currentTime, isTimelinePlaying, selectedOrFirstNode, timeline, timelineScrub, writeTimeline]);

  useEffect(() => {
    const pauseClipsById = new Map(compiledTimeline.interactionClips.map((clip) => [clip.id, clip]));
    previewPauseOnShowClipIdsRef.current.forEach((clipId) => {
      const clip = pauseClipsById.get(clipId);
      if (!clip || currentTime < clip.startTime - TIMELINE_PLAYBACK_PAUSE_EPSILON) {
        previewPauseOnShowClipIdsRef.current.delete(clipId);
      }
    });
  }, [compiledTimeline.interactionClips, currentTime]);

  const updateCurrentTime = useCallback((time: number) => {
    const nextTime = clampTimelineTime(time, timeline.duration);
    setCurrentTime(nextTime);

    const targetVisualClips = compiledTimeline.visualMediaClips.filter((clip) => isTimelineClipActive(clip, nextTime));
    const targetVisualClip = targetVisualClips.filter((clip) => clip.type === 'video').at(-1) ?? targetVisualClips.at(-1) ?? null;
    if (targetVisualClip?.type === 'video' && videoRef.current) {
      applyTimelineMediaPlaybackOptions(videoRef.current, targetVisualClip);
      const localTime = getTimelineMediaElementTime(targetVisualClip, nextTime);
      if (Number.isFinite(localTime) && Math.abs(videoRef.current.currentTime - localTime) > 0.25) {
        videoRef.current.currentTime = localTime;
      }
    }

  }, [compiledTimeline.visualMediaClips, timeline.duration]);

  const toggleTimelinePlayback = useCallback(() => {
    if (isTimelinePlaying) {
      setIsTimelinePlaying(false);
      return;
    }

    const nextTime = currentTime >= timeline.duration ? 0 : currentTime;
    updateCurrentTime(nextTime);

    const targetVideoClip = compiledTimeline.visualMediaClips
      .filter((clip): clip is TimelineMediaClip & { type: 'video' } => clip.type === 'video' && isTimelineClipActive(clip, nextTime))
      .at(-1);
    const video = videoRef.current;
    if (targetVideoClip && video && !hasTimelineMediaSourceEnded(targetVideoClip, nextTime) && !Number.isFinite(Number(targetVideoClip.freezeFrameTime))) {
      applyTimelineMediaPlaybackOptions(video, targetVideoClip);
      const localTime = getTimelineMediaElementTime(targetVideoClip, nextTime);
      if (Number.isFinite(localTime) && Math.abs(video.currentTime - localTime) > 0.25) {
        video.currentTime = localTime;
      }
      void video.play().catch(() => undefined);
    }

    setIsTimelinePlaying(true);
  }, [compiledTimeline.visualMediaClips, currentTime, isTimelinePlaying, timeline.duration, updateCurrentTime]);

  useEffect(() => {
    if (!isTimelinePlaying) return;

    let frame = 0;
    let previousTimestamp = performance.now();

    const tick = (timestamp: number) => {
      const deltaSeconds = Math.max(0, (timestamp - previousTimestamp) / 1000);
      previousTimestamp = timestamp;
      setCurrentTime((time) => {
        const nextTime = clampTimelineTime(time + deltaSeconds, timeline.duration);
        const pauseStop = getPauseOnShowPlaybackStop({
          clips: compiledTimelineRef.current.interactionClips,
          currentTime: time,
          nextTime,
          pausedClipIds: previewPauseOnShowClipIdsRef.current,
        });
        if (pauseStop) {
          previewPauseOnShowClipIdsRef.current.add(pauseStop.clipId);
          window.setTimeout(() => setIsTimelinePlaying(false), 0);
          return clampTimelineTime(pauseStop.time, timeline.duration);
        }
        if (nextTime >= timeline.duration) {
          window.setTimeout(() => setIsTimelinePlaying(false), 0);
        }
        return nextTime;
      });
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [isTimelinePlaying, timeline.duration]);

  useEffect(() => {
    if (!isTimelinePlaying || timelineScrub) return;
    const scrollElement = timelineScrollRef.current;
    if (!scrollElement) return;

    const playheadX = currentTime * zoom;
    const viewportWidth = scrollElement.clientWidth;
    const visibleStart = scrollElement.scrollLeft;
    const visibleEnd = visibleStart + viewportWidth;
    const isPlayheadOutOfView = playheadX < visibleStart || playheadX > visibleEnd;
    if (!isPlayheadOutOfView) return;

    const maxScrollLeft = Math.max(0, Math.max(timelineWidth, scrollElement.scrollWidth) - viewportWidth);
    scrollElement.scrollLeft = Math.max(0, Math.min(maxScrollLeft, playheadX - viewportWidth / 2));
  }, [currentTime, isTimelinePlaying, timelineScrub, timelineWidth, zoom]);

  useEffect(() => {
    const video = videoRef.current;
    if (!isTimelinePlaying) {
      video?.pause();
      return;
    }

    if (visualMediaClip?.type === 'video' && video) {
      applyTimelineMediaPlaybackOptions(video, visualMediaClip);
      const localTime = getTimelineMediaElementTime(visualMediaClip, currentTime);
      if (Number.isFinite(localTime) && Math.abs(video.currentTime - localTime) > 0.25) {
        video.currentTime = localTime;
      }
      if (hasTimelineMediaSourceEnded(visualMediaClip, currentTime)) {
        video.pause();
        return;
      }
      void video.play().catch(() => undefined);
    }

  }, [currentTime, isTimelinePlaying, visualMediaClip]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || visualMediaClip?.type !== 'video') return;

    const syncTime = () => {
      if (!shouldSyncTimelineToMediaElement(visualMediaClip, currentTimeRef.current)) return;
      const localDelta = Math.max(0, (video.currentTime || 0) - (visualMediaClip.sourceStart || 0));
      setCurrentTime(clampTimelineTime(visualMediaClip.startTime + localDelta / getTimelineMediaPlaybackRate(visualMediaClip), timeline.duration));
    };

    video.addEventListener('timeupdate', syncTime);
    video.addEventListener('seeked', syncTime);
    return () => {
      video.removeEventListener('timeupdate', syncTime);
      video.removeEventListener('seeked', syncTime);
    };
  }, [timeline.duration, visualMediaClip]);

  const updateClip = useCallback(
    (clipId: string, update: (clip: TimelineClip) => TimelineClip, options?: TimelineWriteOptions) => {
      writeTimeline(updateTimelineClip({ timeline, clipId, update }), options);
    },
    [timeline, writeTimeline]
  );

  const addClipKeyframes = useCallback((clipId: string, keyframes: Array<{ property: TimelineKeyframeProperty; value: number }>) => {
    if (keyframes.length === 0) return;
    const nextTimeline = keyframes.reduce((sourceTimeline, keyframe) => (
      upsertTimelineClipKeyframe({
        timeline: sourceTimeline,
        clipId,
        property: keyframe.property,
        time: currentTime,
        value: keyframe.value,
      })
    ), timeline);
    writeTimeline(nextTimeline);
  }, [currentTime, timeline, writeTimeline]);

  const removeClipKeyframes = useCallback((clipId: string, keyframeIds: string[]) => {
    if (keyframeIds.length === 0) return;
    writeTimeline(removeTimelineClipKeyframes({ timeline, clipId, keyframeIds, valueAtTime: currentTime }));
  }, [currentTime, timeline, writeTimeline]);

  const deleteKeyframeRefs = useCallback((keyframeRefs: typeof selectedKeyframeRefs) => {
    const editableKeyframeRefs = keyframeRefs.filter((keyframeRef) => !keyframeRef.track.locked);
    if (editableKeyframeRefs.length === 0) return;

    const keyframeIdsByClipId = new Map<string, string[]>();
    for (const keyframeRef of editableKeyframeRefs) {
      keyframeIdsByClipId.set(keyframeRef.clip.id, [
        ...(keyframeIdsByClipId.get(keyframeRef.clip.id) || []),
        keyframeRef.keyframe.id,
      ]);
    }

    let nextTimeline = timeline;
    for (const [clipId, keyframeIds] of Array.from(keyframeIdsByClipId.entries())) {
      nextTimeline = removeTimelineClipKeyframes({
        timeline: nextTimeline,
        clipId,
        keyframeIds,
        valueAtTime: currentTime,
      });
    }

    if (nextTimeline !== timeline) {
      writeTimeline(nextTimeline);
      setSelectedKeyframeIds([]);
    }
  }, [currentTime, timeline, writeTimeline]);

  const deleteSelectedKeyframes = useCallback(() => {
    deleteKeyframeRefs(selectedKeyframeRefs);
  }, [deleteKeyframeRefs, selectedKeyframeRefs]);

  const deleteContextKeyframes = useCallback(() => {
    if (timelineContextMenu?.kind !== 'keyframe' || !timelineContextMenu.clipId || !timelineContextMenu.keyframeIds?.length) return;
    const clipRef = findTimelineClip(timeline, timelineContextMenu.clipId);
    if (!clipRef || clipRef.track.locked) return;
    const keyframeIdSet = new Set(timelineContextMenu.keyframeIds);
    deleteKeyframeRefs(
      (clipRef.clip.keyframes || [])
        .filter((keyframe) => keyframeIdSet.has(keyframe.id))
        .map((keyframe) => ({ track: clipRef.track, clip: clipRef.clip, keyframe }))
    );
  }, [deleteKeyframeRefs, timeline, timelineContextMenu]);

  const setContextKeyframesInterpolation = useCallback((interpolation: TimelineKeyframeInterpolation) => {
    if (timelineContextMenu?.kind !== 'keyframe' || !timelineContextMenu.clipId || !timelineContextMenu.keyframeIds?.length) return;
    const nextTimeline = setTimelineClipKeyframesInterpolation({
      timeline,
      clipId: timelineContextMenu.clipId,
      keyframeIds: timelineContextMenu.keyframeIds,
      interpolation,
    });
    if (nextTimeline === timeline) return;
    writeTimeline(nextTimeline);
  }, [timeline, timelineContextMenu, writeTimeline]);

  const beginAudioClipVolumeDrag = useCallback((clipId: string) => {
    audioVolumeHistorySnapshotRef.current = timelineRef.current;
    audioVolumeHistoryPushedRef.current = false;
    selectSingleClip(clipId);
  }, [selectSingleClip]);

  const updateAudioClipVolume = useCallback((clipId: string, volume: number) => {
    const nextVolume = roundTimelineAudioVolume(volume);
    const sourceTimeline = timelineRef.current;
    const clipRef = findTimelineClip(sourceTimeline, clipId);
    if (!clipRef || clipRef.track.locked || clipRef.clip.type !== 'audio') return;
    if (Math.abs(clampTimelineAudioVolume(clipRef.clip.volume) - nextVolume) < 0.005) return;

    if (!audioVolumeHistoryPushedRef.current) {
      pushTimelineHistory(audioVolumeHistorySnapshotRef.current ?? sourceTimeline);
      audioVolumeHistoryPushedRef.current = true;
    }

    const nextTimeline = updateTimelineClip({
      timeline: sourceTimeline,
      clipId,
      update: (clip) => (clip.type === 'audio' ? { ...clip, volume: nextVolume } : clip),
    });
    timelineRef.current = nextTimeline;
    writeTimeline(nextTimeline, { history: false });
  }, [pushTimelineHistory, writeTimeline]);

  const finishAudioClipVolumeDrag = useCallback(() => {
    audioVolumeHistoryPushedRef.current = false;
    audioVolumeHistorySnapshotRef.current = null;
  }, []);

  const addInteractionClip = (type: TimelineInteractionClipType) => {
    const clip = createInteractionClip(type, currentTime, timeline.duration);
    writeTimeline(insertTimelineClip({ timeline, clip }));
    selectSingleClip(clip.id);
    setActiveLibraryTab('interactions');
  };

  const deleteSelectedClip = useCallback(() => {
    if (selectedEditableClipIds.length === 0) return;
    const deleteTimeline = isRippleEditingEnabled ? deleteTimelineClipsWithRipple : deleteTimelineClips;
    writeTimeline(deleteTimeline({ timeline, clipIds: selectedEditableClipIds }));
    selectSingleClip(null);
  }, [isRippleEditingEnabled, selectSingleClip, selectedEditableClipIds, timeline, writeTimeline]);

  const setSelectedClipsEnabled = useCallback((enabled: boolean) => {
    if (selectedEditableClipIds.length === 0) return;
    writeTimeline(setTimelineClipsEnabled({ timeline, clipIds: selectedEditableClipIds, enabled }));
  }, [selectedEditableClipIds, timeline, writeTimeline]);

  const setSelectedClipsHidden = useCallback((hidden: boolean) => {
    if (selectedEditableClipIds.length === 0) return;
    writeTimeline(setTimelineClipsHidden({ timeline, clipIds: selectedEditableClipIds, hidden }));
  }, [selectedEditableClipIds, timeline, writeTimeline]);

  const setSelectedClipsMuted = useCallback((muted: boolean) => {
    if (selectedEditableAudibleClipIds.length === 0) return;
    writeTimeline(setTimelineClipsMuted({ timeline, clipIds: selectedEditableAudibleClipIds, muted }));
  }, [selectedEditableAudibleClipIds, timeline, writeTimeline]);

  const toggleSelectedClipLink = useCallback(() => {
    if (hasLinkedEditableClip) {
      const nextTimeline = unlinkTimelineClips({ timeline, clipIds: selectedEditableClipIds });
      writeTimeline(nextTimeline);
      selectClipIds(selectedEditableClipIds, selectedClipId);
      return;
    }

    const result = linkTimelineClips({ timeline, clipIds: selectedEditableClipIds });
    if (!result.linkGroupId) return;
    writeTimeline(result.timeline);
    selectClipIds(selectedEditableClipIds, selectedClipId);
  }, [hasLinkedEditableClip, selectClipIds, selectedClipId, selectedEditableClipIds, timeline, writeTimeline]);

  const toggleSourceAudioForClip = useCallback((clipId: string | null | undefined) => {
    if (!clipId) return;
    const result = toggleTimelineSourceAudioSeparation({ timeline, clipId });
    writeTimeline(result.timeline);
    selectClipIds(result.audioClipId ? [clipId, result.audioClipId] : [clipId], clipId);
  }, [selectClipIds, timeline, writeTimeline]);

  const updateTrack = useCallback(
    (trackId: string, patch: Partial<Pick<TimelineTrack, 'hidden' | 'locked' | 'muted' | 'collapsed'>>) => {
      writeTimeline(updateTimelineTrack({ timeline, trackId, patch }));
    },
    [timeline, writeTimeline]
  );

  const moveTrack = useCallback(
    (trackId: string, direction: 'up' | 'down') => {
      const currentIndex = timeline.tracks.findIndex((track) => track.id === trackId);
      if (currentIndex < 0) return;
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      const nextTimeline = reorderTimelineTrack({ timeline, trackId, targetIndex });
      if (nextTimeline === timeline) return;
      writeTimeline(nextTimeline);
    },
    [timeline, writeTimeline]
  );

  const addTrackAfter = useCallback(
    (track: TimelineTrack) => {
      writeTimeline(addTimelineTrack({ timeline, type: track.type, afterTrackId: track.id }));
    },
    [timeline, writeTimeline]
  );

  const deleteTrack = useCallback(
    (trackId: string) => {
      const track = timeline.tracks.find((item) => item.id === trackId);
      if (!track || !canDeleteTimelineTrack(track)) return;

      const deletedClipIds = new Set(track.clips.map((clip) => clip.id));
      const nextTimeline = deleteTimelineTrack({ timeline, trackId });
      if (nextTimeline === timeline) return;

      writeTimeline(nextTimeline);
      if (selectedClipIds.some((clipId) => deletedClipIds.has(clipId))) {
        selectSingleClip(null);
      }
    },
    [selectSingleClip, selectedClipIds, timeline, writeTimeline]
  );

  const getTrackReorderTargetAtPointer = useCallback((clientY: number): TimelineTrackReorderTarget | null => {
    const content = timelineContentRef.current;
    if (!content) return null;
    const trackElements = Array.from(content.querySelectorAll<HTMLElement>('[data-node-timeline-track-id]'));
    if (trackElements.length === 0) return null;

    const contentRect = content.getBoundingClientRect();
    for (let index = 0; index < trackElements.length; index += 1) {
      const rect = trackElements[index].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        return {
          insertIndex: index,
          top: Math.max(0, rect.top - contentRect.top),
        };
      }
    }

    const lastRect = trackElements.at(-1)?.getBoundingClientRect();
    return {
      insertIndex: trackElements.length,
      top: lastRect ? Math.max(0, lastRect.bottom - contentRect.top + TIMELINE_TRACK_GAP_PX) : 0,
    };
  }, []);

  const getTrackReorderFinalIndex = useCallback((trackId: string, insertIndex: number) => {
    const currentIndex = timeline.tracks.findIndex((track) => track.id === trackId);
    if (currentIndex < 0) return -1;
    const adjustedIndex = insertIndex > currentIndex ? insertIndex - 1 : insertIndex;
    return Math.max(0, Math.min(timeline.tracks.length - 1, adjustedIndex));
  }, [timeline.tracks]);

  const handleTrackReorderPointerDown = useCallback((track: TimelineTrack, event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || timelineDrag || timelineKeyframeDrag || timelineScrub || bookmarkDrag || overlayDrag || marqueeSelection) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button')) return;
    const reorderTarget = getTrackReorderTargetAtPointer(event.clientY);
    if (!reorderTarget) return;

    event.preventDefault();
    event.stopPropagation();
    timelineTrackReorderPointerRef.current = { clientX: event.clientX, clientY: event.clientY };
    timelineTrackReorderTargetRef.current = { insertIndex: reorderTarget.insertIndex, hasMoved: false };
    setTrackReorder({
      ...reorderTarget,
      trackId: track.id,
      originY: event.clientY,
      hasMoved: false,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [bookmarkDrag, getTrackReorderTargetAtPointer, marqueeSelection, overlayDrag, timelineDrag, timelineKeyframeDrag, timelineScrub]);

  const copySelectedKeyframes = useCallback(() => {
    const items = createTimelineKeyframeClipboardItems(selectedKeyframeRefs.map((keyframeRef) => keyframeRef.keyframe));
    if (items.length === 0) return false;
    setKeyframeClipboard({ items });
    setClipClipboard(null);
    return true;
  }, [selectedKeyframeRefs]);

  const copySelectedClip = useCallback(() => {
    if (selectedClipRefs.length === 0) return;
    setClipClipboard({
      items: selectedClipRefs.map((clipRef) => ({ clip: clipRef.clip, trackId: clipRef.track.id })),
    });
    setKeyframeClipboard(null);
  }, [selectedClipRefs]);

  const pasteClipboardClip = useCallback(() => {
    if (!clipClipboard) return;
    const result = pasteTimelineClips({
      timeline,
      items: clipClipboard.items,
      startTime: currentTime,
    });

    if (result.clips.length === 0) return;
    writeTimeline(result.timeline);
    selectClipIds(result.clips.map((clip) => clip.id), result.clips.at(-1)?.id);
  }, [clipClipboard, currentTime, selectClipIds, timeline, writeTimeline]);

  const pasteKeyframeClipboard = useCallback((clipId = selectedClipId, time = currentTime) => {
    if (!keyframeClipboard || !clipId) return false;
    const result = pasteTimelineClipKeyframes({
      timeline,
      clipId,
      items: keyframeClipboard.items,
      time,
    });

    if (result.keyframeIds.length === 0) return false;
    writeTimeline(result.timeline);
    selectClipIds([clipId], clipId);
    setSelectedKeyframeIds(result.keyframeIds);
    return true;
  }, [currentTime, keyframeClipboard, selectClipIds, selectedClipId, timeline, writeTimeline]);

  const pasteClipboardClipAtTime = useCallback((time: number) => {
    if (!clipClipboard) return;
    const result = pasteTimelineClips({
      timeline,
      items: clipClipboard.items,
      startTime: time,
    });

    if (result.clips.length === 0) return;
    writeTimeline(result.timeline);
    selectClipIds(result.clips.map((clip) => clip.id), result.clips.at(-1)?.id);
  }, [clipClipboard, selectClipIds, timeline, writeTimeline]);

  const cutSelectedClip = useCallback(() => {
    const editableClipRefs = selectedClipRefs.filter((clipRef) => !clipRef.track.locked);
    if (editableClipRefs.length === 0) return;
    setClipClipboard({
      items: editableClipRefs.map((clipRef) => ({ clip: clipRef.clip, trackId: clipRef.track.id })),
    });
    setKeyframeClipboard(null);
    writeTimeline(deleteTimelineClips({ timeline, clipIds: editableClipRefs.map((clipRef) => clipRef.clip.id) }));
    selectSingleClip(null);
  }, [selectSingleClip, selectedClipRefs, timeline, writeTimeline]);

  const duplicateSelectedClip = useCallback(() => {
    if (selectedEditableClipIds.length === 0) return;
    const result = selectedEditableClipIds.length === 1
      ? duplicateTimelineClip({ timeline, clipId: selectedEditableClipIds[0] })
      : duplicateTimelineClips({ timeline, clipIds: selectedEditableClipIds });
    const duplicatedClipIds = 'clips' in result ? result.clips.map((clip) => clip.id) : result.clip ? [result.clip.id] : [];
    if (duplicatedClipIds.length === 0) return;
    writeTimeline(result.timeline);
    selectClipIds(duplicatedClipIds, duplicatedClipIds.at(-1));
  }, [selectClipIds, selectedEditableClipIds, timeline, writeTimeline]);

  const splitSelectedClipAtTime = useCallback((time: number, retainSide: SplitTimelineRetainSide = 'both', explicitClipIds?: string[]) => {
    const targetClipIds = getTimelineSplitTargetClipIds({
      timeline,
      time,
      clipIds: explicitClipIds?.length
        ? explicitClipIds
        : selectedEditableClipIds.length > 0 ? selectedEditableClipIds : undefined,
    });
    if (targetClipIds.length === 0) return;

    const result = splitTimelineClips({ timeline, clipIds: targetClipIds, time, retainSide });
    if (result.clipIds.length === 0) return;
    writeTimeline(result.timeline);
    selectClipIds(result.clipIds, result.clipIds.at(-1));
  }, [selectClipIds, selectedEditableClipIds, timeline, writeTimeline]);

  const splitSelectedClip = useCallback(() => {
    if (!canSplitSelectedClip) return;
    splitSelectedClipAtTime(currentTime);
  }, [canSplitSelectedClip, currentTime, splitSelectedClipAtTime]);

  const splitSelectedClipLeft = useCallback(() => {
    if (!canSplitSelectedClip) return;
    splitSelectedClipAtTime(currentTime, 'right');
  }, [canSplitSelectedClip, currentTime, splitSelectedClipAtTime]);

  const splitSelectedClipRight = useCallback(() => {
    if (!canSplitSelectedClip) return;
    splitSelectedClipAtTime(currentTime, 'left');
  }, [canSplitSelectedClip, currentTime, splitSelectedClipAtTime]);

  const freezeVideoClipAtTime = useCallback((clipId: string | null | undefined, time: number) => {
    if (!clipId) return;
    const result = freezeTimelineVideoClipAtTime({ timeline, clipId, time });
    if (!result.clip) return;
    writeTimeline(result.timeline);
    selectSingleClip(result.clip.id);
  }, [selectSingleClip, timeline, writeTimeline]);

  const freezeSelectedClip = useCallback(() => {
    if (!canFreezeSelectedClip) return;
    freezeVideoClipAtTime(freezeTargetClipRef?.clip.id, currentTime);
  }, [canFreezeSelectedClip, currentTime, freezeTargetClipRef?.clip.id, freezeVideoClipAtTime]);

  const toggleCurrentBookmark = useCallback(() => {
    writeTimeline(toggleTimelineBookmark({ timeline, time: currentTime, label: t('timeline.markerLabel', { time: currentTime.toFixed(2) }) }));
  }, [currentTime, t, timeline, writeTimeline]);

  const toggleBookmarkAtTime = useCallback((time: number) => {
    writeTimeline(toggleTimelineBookmark({ timeline, time, label: t('timeline.markerLabel', { time: time.toFixed(2) }) }));
  }, [t, timeline, writeTimeline]);

  const addInteractionClipAtTime = useCallback((type: TimelineInteractionClipType, time: number, trackId?: string | null, forceNewTrack = false, newTrackInsertIndex?: number | null) => {
    const clip = createInteractionClip(type, time, timeline.duration);
    writeTimeline(insertTimelineClip({ timeline, clip, trackId, forceNewTrack, newTrackInsertIndex }));
    selectSingleClip(clip.id);
    setActiveLibraryTab('interactions');
  }, [selectSingleClip, timeline, writeTimeline]);

  const closeTimelineContextMenu = useCallback(() => {
    setTimelineContextMenu(null);
  }, []);

  const openTimelineContextMenu = useCallback((event: React.MouseEvent, menu: Omit<TimelineContextMenuState, 'x' | 'y'>) => {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 220;
    const menuHeight = 320;
    setTimelineContextMenu({
      ...menu,
      x: Math.min(event.clientX, Math.max(0, window.innerWidth - menuWidth - 8)),
      y: Math.min(event.clientY, Math.max(0, window.innerHeight - menuHeight - 8)),
    });
  }, []);

  const runTimelineContextAction = useCallback((action: () => void) => {
    action();
    closeTimelineContextMenu();
  }, [closeTimelineContextMenu]);

  useEffect(() => {
    if (!timelineContextMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-node-timeline-context-menu]')) return;
      closeTimelineContextMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeTimelineContextMenu();
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', closeTimelineContextMenu);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', closeTimelineContextMenu);
    };
  }, [closeTimelineContextMenu, timelineContextMenu]);

  const selectAllTimelineClips = useCallback(() => {
    const clipIds = timeline.tracks.flatMap((track) => (
      track.locked ? [] : track.clips.map((clip) => clip.id)
    ));
    selectClipIds(clipIds, clipIds[0] ?? null);
  }, [selectClipIds, timeline.tracks]);

  const nudgeSelectedTimelineClips = useCallback((deltaTime: number) => {
    if (selectedEditableClipIds.length === 0) return false;
    const nextTimeline = moveLinkedTimelineClipsByDelta({ timeline, clipIds: selectedEditableClipIds, deltaTime });
    writeTimeline(nextTimeline);

    const primaryClipId = selectedClipId && selectedEditableClipIds.includes(selectedClipId) ? selectedClipId : selectedEditableClipIds.at(-1) ?? null;
    const primaryClipRef = findTimelineClip(nextTimeline, primaryClipId);
    if (primaryClipRef) setCurrentTime(clampTimelineTime(primaryClipRef.clip.startTime, nextTimeline.duration));
    return true;
  }, [selectedClipId, selectedEditableClipIds, timeline, writeTimeline]);

  const seekAdjacentTimelineEditPoint = useCallback((direction: 'previous' | 'next') => {
    const editPoint = getAdjacentTimelineEditPoint({ timeline, time: currentTime, direction });
    if (editPoint === null) return;
    updateCurrentTime(editPoint);
  }, [currentTime, timeline, updateCurrentTime]);

  const toggleKeyframeLanesForClip = useCallback((clipId: string | null | undefined) => {
    if (!clipId) return;
    setExpandedKeyframeClipIds((clipIds) => (
      clipIds.includes(clipId)
        ? clipIds.filter((item) => item !== clipId)
        : [...clipIds, clipId]
    ));
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isShortcutEditingTarget(event.target) || timelineDrag || timelineKeyframeDrag || timelineScrub || bookmarkDrag || overlayDrag || marqueeSelection || timelineContextMenu || trackReorder) return;

      const key = event.key.toLowerCase();
      const hasModifier = event.metaKey || event.ctrlKey;
      const hasAlt = event.altKey;
      let handled = true;

      if (hasModifier && key === 'a') {
        selectAllTimelineClips();
      } else if (hasModifier && !hasAlt && key === 'z' && event.shiftKey) {
        redoTimeline();
      } else if (hasModifier && !hasAlt && key === 'z') {
        undoTimeline();
      } else if (hasModifier && !hasAlt && key === 'y') {
        redoTimeline();
      } else if (hasModifier && key === 'c') {
        if (selectedKeyframeRefs.length === 0 || !copySelectedKeyframes()) {
          copySelectedClip();
        }
      } else if (hasModifier && key === 'x') {
        cutSelectedClip();
      } else if (hasModifier && key === 'v') {
        handled = false;
      } else if (hasModifier && key === 'd') {
        duplicateSelectedClip();
      } else if (hasModifier && !hasAlt && key === 'l') {
        toggleSelectedClipLink();
      } else if (!hasModifier && !hasAlt && (event.key === 'Delete' || event.key === 'Backspace') && selectedKeyframeRefs.length > 0) {
        deleteSelectedKeyframes();
      } else if (!hasModifier && !hasAlt && (event.key === 'Delete' || event.key === 'Backspace')) {
        deleteSelectedClip();
      } else if (!hasModifier && !hasAlt && key === 's') {
        splitSelectedClip();
      } else if (!hasModifier && !hasAlt && key === 'q') {
        splitSelectedClipLeft();
      } else if (!hasModifier && !hasAlt && key === 'w') {
        splitSelectedClipRight();
      } else if (!hasModifier && !hasAlt && key === 'f') {
        freezeSelectedClip();
      } else if (!hasModifier && !hasAlt && key === 'm') {
        toggleCurrentBookmark();
      } else if (!hasModifier && !hasAlt && key === 'n') {
        setIsSnappingEnabled((value) => !value);
      } else if (!hasModifier && !hasAlt && key === 'l') {
        updateCurrentTime(currentTime + 1);
      } else if (!hasModifier && !hasAlt && key === 'j') {
        updateCurrentTime(currentTime - 1);
      } else if (!hasModifier && !hasAlt && event.key === '[') {
        seekAdjacentTimelineEditPoint('previous');
      } else if (!hasModifier && !hasAlt && event.key === ']') {
        seekAdjacentTimelineEditPoint('next');
      } else if (!hasModifier && !hasAlt && (event.key === ' ' || key === 'k')) {
        toggleTimelinePlayback();
      } else if (!hasModifier && !hasAlt && event.key === 'Escape') {
        selectSingleClip(null);
        setIsTimelinePlaying(false);
      } else if (!hasModifier && !hasAlt && event.key === 'ArrowLeft') {
        if (event.shiftKey) {
          updateCurrentTime(currentTime - TIMELINE_JUMP_STEP_SECONDS);
        } else if (!nudgeSelectedTimelineClips(-TIMELINE_FRAME_STEP_SECONDS)) {
          updateCurrentTime(currentTime - TIMELINE_FRAME_STEP_SECONDS);
        }
      } else if (!hasModifier && !hasAlt && event.key === 'ArrowRight') {
        if (event.shiftKey) {
          updateCurrentTime(currentTime + TIMELINE_JUMP_STEP_SECONDS);
        } else if (!nudgeSelectedTimelineClips(TIMELINE_FRAME_STEP_SECONDS)) {
          updateCurrentTime(currentTime + TIMELINE_FRAME_STEP_SECONDS);
        }
      } else if (!hasModifier && !hasAlt && (event.key === 'Home' || event.key === 'Enter')) {
        updateCurrentTime(0);
      } else if (!hasModifier && !hasAlt && event.key === 'End') {
        updateCurrentTime(timeline.duration);
      } else if (!hasAlt && (key === '=' || key === '+')) {
        zoomIn();
      } else if (!hasAlt && key === '-') {
        zoomOut();
      } else {
        handled = false;
      }

      if (handled) event.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    copySelectedClip,
    copySelectedKeyframes,
    currentTime,
    cutSelectedClip,
    deleteSelectedClip,
    deleteSelectedKeyframes,
    duplicateSelectedClip,
    freezeSelectedClip,
    nudgeSelectedTimelineClips,
    bookmarkDrag,
    overlayDrag,
    redoTimeline,
    selectAllTimelineClips,
    selectSingleClip,
    selectedKeyframeRefs.length,
    seekAdjacentTimelineEditPoint,
    splitSelectedClip,
    splitSelectedClipLeft,
    splitSelectedClipRight,
    timeline.duration,
    timelineDrag,
    timelineKeyframeDrag,
    timelineScrub,
    trackReorder,
    marqueeSelection,
    timelineContextMenu,
    toggleCurrentBookmark,
    toggleSelectedClipLink,
    toggleTimelinePlayback,
    undoTimeline,
    updateCurrentTime,
    zoomIn,
    zoomOut,
  ]);

  const handleRequestMediaClip = (trackId?: string | null, startTime = currentTime) => {
    if (!selectedOrFirstNode) return;
    onRequestMediaClip({ nodeId: selectedOrFirstNode.id, trackId, startTime });
  };

  const updateTimelineOutputTarget = useCallback(
    (outputId: string, targetNodeId: string | null) => {
      if (!selectedOrFirstNode) return;

      const existingEdge = edges.find((edge) => edge.source === selectedOrFirstNode.id && edge.sourceHandle === outputId);
      if (!targetNodeId) {
        if (!existingEdge) return;
        setEdges(removeTimelineOutputEdge(edges, selectedOrFirstNode.id, outputId));
        return;
      }

      if (existingEdge?.target === targetNodeId) return;
      onConnect({
        source: selectedOrFirstNode.id,
        sourceHandle: outputId,
        target: targetNodeId,
        targetHandle: null,
      });
    },
    [edges, onConnect, selectedOrFirstNode, setEdges]
  );

  const insertAssetsIntoTimeline = useCallback(
    (assets: OpenFMVAsset[], options?: { trackId?: string | null; startTime?: number; forceNewTrack?: boolean; newTrackInsertIndex?: number | null }) => {
      if (!selectedOrFirstNode) return;
      let nextTimeline = timeline;
      let nextStartTime = clampTimelineTime(options?.startTime ?? currentTime, timeline.duration);
      let lastClipId: string | null = null;
      let preferredTrackId = options?.trackId;
      let forceNewTrack = options?.forceNewTrack === true;
      let newTrackInsertIndex = options?.newTrackInsertIndex;

      for (const asset of assets) {
        const clip = isTimelineMediaAsset(asset)
          ? createMediaClipFromTimelineAsset({
              type: asset.type,
              src: getAssetSource(asset),
              name: asset.name,
              assetId: asset.id,
              startTime: nextStartTime,
              metadata: asset.metadata,
            })
          : null;
        if (!clip) continue;
        nextTimeline = insertTimelineClip({ timeline: nextTimeline, clip, trackId: preferredTrackId, forceNewTrack, newTrackInsertIndex });
        preferredTrackId = findTimelineClip(nextTimeline, clip.id)?.track.id ?? preferredTrackId;
        forceNewTrack = false;
        newTrackInsertIndex = undefined;
        nextStartTime = getClipEndTime(clip);
        lastClipId = clip.id;
      }

      if (!lastClipId) return;
      writeTimeline(nextTimeline);
      selectSingleClip(lastClipId);
    },
    [currentTime, selectSingleClip, selectedOrFirstNode, timeline, writeTimeline]
  );

  const insertLibraryAssetsIntoTimeline = useCallback(
    async (assets: OpenFMVAsset[], options?: { trackId?: string | null; startTime?: number; forceNewTrack?: boolean; newTrackInsertIndex?: number | null }) => {
      const supportedAssets = assets.filter(isNodeTimelineLibraryAsset);
      if (supportedAssets.length === 0) return;

      setAssetLibraryError('');
      try {
        if (currentProjectId) {
          const savedProject = await addAssetsToLocalProject(currentProjectId, supportedAssets);
          if (!savedProject) throw new Error(t('panel.selectProjectBeforeImport'));
          refreshAssetLibrary();
        }
        insertAssetsIntoTimeline(supportedAssets, options);
      } catch (error) {
        console.error('Failed to sync node timeline asset into current project', error);
        const message = error instanceof Error ? error.message : t('panel.importFailed');
        setAssetLibraryError(message);
        alert(message);
      }
    },
    [currentProjectId, insertAssetsIntoTimeline, refreshAssetLibrary, t]
  );

  const removeAssetFromLibrary = useCallback(async (item: TimelineAssetItem) => {
    if (!window.confirm(t('panel.removeAssetConfirm', { assetName: item.asset.name, projectTitle: item.projectTitle }))) return;

    setAssetLibraryError('');
    try {
      const savedProject = await removeAssetFromLocalProject(item.projectId, item.asset.id);
      if (!savedProject) throw new Error(t('panel.removeAssetFailed'));
      refreshAssetLibrary();
    } catch (error) {
      console.error('Failed to remove node timeline asset', error);
      const message = error instanceof Error ? error.message : t('panel.removeAssetFailed');
      setAssetLibraryError(message);
      alert(message);
    }
  }, [refreshAssetLibrary, t]);

  const persistImportedAssets = useCallback(
    async (assets: OpenFMVAsset[], options?: { insert?: boolean; trackId?: string | null; startTime?: number; forceNewTrack?: boolean; newTrackInsertIndex?: number | null }) => {
      const supportedAssets = assets.filter(isNodeTimelineLibraryAsset);
      if (supportedAssets.length === 0) {
        setAssetLibraryError(t('panel.unsupportedMedia'));
        return;
      }

      const targetProjectId = currentProjectId ?? (await saveProjectSession())?.id;
      if (!targetProjectId) throw new Error(t('panel.selectProjectBeforeImport'));

      setAssetLibraryError('');
      const savedProject = await addAssetsToLocalProject(targetProjectId, supportedAssets);
      if (!savedProject) throw new Error(t('panel.selectProjectBeforeImport'));
      refreshAssetLibrary();

      if (options?.insert) {
        insertAssetsIntoTimeline(supportedAssets, {
          trackId: options.trackId,
          startTime: options.startTime,
          forceNewTrack: options.forceNewTrack,
          newTrackInsertIndex: options.newTrackInsertIndex,
        });
      }
    },
    [currentProjectId, insertAssetsIntoTimeline, refreshAssetLibrary, saveProjectSession, t]
  );

  const importFilesToAssets = useCallback(
    async (files: File[], options?: { insert?: boolean; trackId?: string | null; startTime?: number; forceNewTrack?: boolean; newTrackInsertIndex?: number | null }) => {
      if (files.length === 0) return;
      setIsImportingAsset(true);
      setAssetLibraryError('');
      try {
        const importedAssets: OpenFMVAsset[] = [];
        for (const file of files) {
          const asset = await importAssetFromFile(file);
          if (isNodeTimelineLibraryAsset(asset)) importedAssets.push(asset);
        }
        await persistImportedAssets(importedAssets, options);
      } catch (error) {
        console.error('Failed to import node timeline assets', error);
        const message = isStorageQuotaError(error) ? t('panel.quotaExceeded') : error instanceof Error ? error.message : t('panel.importFailed');
        setAssetLibraryError(message);
        alert(message);
      } finally {
        setIsImportingAsset(false);
        if (assetInputRef.current) assetInputRef.current.value = '';
      }
    },
    [persistImportedAssets, t]
  );

  const importButtonBackgroundImage = useCallback(async (file: File): Promise<OpenFMVAsset | null> => {
    setIsImportingAsset(true);
    setAssetLibraryError('');
    try {
      const asset = await importAssetFromFile(file);
      if (asset.type !== 'image') throw new Error(t('fields.buttonBackgroundImageOnly'));

      const targetProjectId = currentProjectId ?? (await saveProjectSession())?.id;
      if (!targetProjectId) throw new Error(t('panel.selectProjectBeforeImport'));

      const savedProject = await addAssetsToLocalProject(targetProjectId, [asset]);
      if (!savedProject) throw new Error(t('panel.selectProjectBeforeImport'));
      refreshAssetLibrary();
      return asset;
    } catch (error) {
      console.error('Failed to import button background image', error);
      const message = isStorageQuotaError(error) ? t('panel.quotaExceeded') : error instanceof Error ? error.message : t('panel.importFailed');
      setAssetLibraryError(message);
      alert(message);
      return null;
    } finally {
      setIsImportingAsset(false);
    }
  }, [currentProjectId, refreshAssetLibrary, saveProjectSession, t]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented || isShortcutEditingTarget(event.target)) return;

      const files = getMediaFilesFromClipboardData(event.clipboardData);
      if (files.length > 0) {
        event.preventDefault();
        void importFilesToAssets(files, { insert: true, startTime: currentTime });
        return;
      }

      if (keyframeClipboard && selectedClipId) {
        event.preventDefault();
        pasteKeyframeClipboard(selectedClipId, currentTime);
        return;
      }

      if (clipClipboard) {
        event.preventDefault();
        pasteClipboardClip();
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [clipClipboard, currentTime, importFilesToAssets, keyframeClipboard, pasteClipboardClip, pasteKeyframeClipboard, selectedClipId]);

  const importNativeAsset = useCallback(
    async () => {
      setIsImportingAsset(true);
      setAssetLibraryError('');
      try {
        const asset = await importAssetFromNativePicker();
        if (asset) await persistImportedAssets([asset]);
      } catch (error) {
        console.error('Failed to import node timeline asset', error);
        const message = error instanceof Error ? error.message : t('panel.importFailed');
        setAssetLibraryError(message);
        alert(message);
      } finally {
        setIsImportingAsset(false);
      }
    },
    [persistImportedAssets, t]
  );

  const handleAssetImportClick = () => {
    if (canUseNativeAssetPicker()) {
      void importNativeAsset();
      return;
    }
    assetInputRef.current?.click();
  };

  const handleAssetPanelDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsAssetDropActive(false);
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length > 0) void importFilesToAssets(files);
  };

  const pointerTime = useCallback((clientX: number) => {
    const content = timelineContentRef.current;
    if (!content) return 0;
    const rect = content.getBoundingClientRect();
    return Math.max(0, (clientX - rect.left) / zoom);
  }, [zoom]);

  const getNewTrackInsertTargetAtPointer = useCallback((clientY: number): TimelineNewTrackDropIndicator | null => {
    const content = timelineContentRef.current;
    if (!content) return null;
    const trackElements = Array.from(content.querySelectorAll<HTMLElement>('[data-node-timeline-track-id]'));
    if (trackElements.length === 0) return null;

    const contentRect = content.getBoundingClientRect();
    const firstTrackRect = trackElements[0].getBoundingClientRect();
    if (clientY >= contentRect.top && clientY < firstTrackRect.top) {
      return {
        insertIndex: 0,
        top: Math.max(0, firstTrackRect.top - contentRect.top),
      };
    }

    for (let index = 0; index < trackElements.length - 1; index += 1) {
      const currentRect = trackElements[index].getBoundingClientRect();
      const nextRect = trackElements[index + 1].getBoundingClientRect();
      if (clientY > currentRect.bottom && clientY < nextRect.top) {
        const nextTrackId = trackElements[index + 1].dataset.nodeTimelineTrackId;
        const nextTrackIndex = nextTrackId ? timeline.tracks.findIndex((track) => track.id === nextTrackId) : index + 1;
        return {
          insertIndex: nextTrackIndex >= 0 ? nextTrackIndex : index + 1,
          top: Math.max(0, nextRect.top - contentRect.top),
        };
      }
    }

    const lastTrackRect = trackElements.at(-1)?.getBoundingClientRect();
    if (lastTrackRect && clientY > lastTrackRect.bottom + TIMELINE_TRACK_GAP_PX / 2 && clientY <= contentRect.bottom) {
      return {
        insertIndex: timeline.tracks.length,
        top: Math.max(0, lastTrackRect.bottom - contentRect.top + TIMELINE_TRACK_GAP_PX),
      };
    }

    return null;
  }, [timeline.tracks]);

  const updateNewTrackDropIndicatorAtPointer = useCallback((clientY: number) => {
    const indicator = getNewTrackInsertTargetAtPointer(clientY);
    setNewTrackDropIndicator(indicator);
    return indicator;
  }, [getNewTrackInsertTargetAtPointer]);

  const getTimelineDropData = useCallback((event: React.DragEvent<HTMLElement>) => {
    const interactionType = event.dataTransfer.getData('application/openfmv-interaction-type') || draggedInteractionType;
    const assetId = event.dataTransfer.getData('application/openfmv-asset-id') || draggedAssetId;
    const assetProjectId = event.dataTransfer.getData('application/openfmv-asset-project-id');
    const assetItem = assetLibrary.find((candidate) => candidate.asset.id === assetId && (!assetProjectId || candidate.projectId === assetProjectId))
      ?? assetLibrary.find((candidate) => candidate.asset.id === assetId)
      ?? null;
    const files = Array.from(event.dataTransfer.files || []);
    const hasFiles = files.length > 0 || event.dataTransfer.types.includes('Files');

    return {
      interactionType: isInteractionClipType(interactionType) ? interactionType : null,
      assetItem,
      files,
      hasFiles,
    };
  }, [assetLibrary, draggedAssetId, draggedInteractionType]);

  const canDropOnTimelineTrack = useCallback((track: TimelineTrack, event: React.DragEvent<HTMLElement>) => {
    if (track.locked) return false;
    const dropData = getTimelineDropData(event);
    if (dropData.interactionType) return track.type === 'interaction';
    if (dropData.assetItem) {
      return isTimelineMediaAsset(dropData.assetItem.asset) && track.type === 'media';
    }
    return dropData.hasFiles;
  }, [getTimelineDropData]);

  const canDropOnTimelineCanvas = useCallback((event: React.DragEvent<HTMLElement>) => {
    const dropData = getTimelineDropData(event);
    return Boolean(dropData.interactionType || dropData.assetItem || dropData.hasFiles);
  }, [getTimelineDropData]);

  const startTimelineExternalDragScroll = useCallback((event: React.DragEvent<HTMLElement>) => {
    timelineExternalDragPointerRef.current = { clientX: event.clientX, clientY: event.clientY, updatedAt: performance.now() };
    setIsTimelineExternalDragActive(true);
  }, []);

  const stopTimelineExternalDragScroll = useCallback(() => {
    timelineExternalDragPointerRef.current = null;
    setIsTimelineExternalDragActive(false);
    setNewTrackDropIndicator(null);
  }, []);

  const handleTimelineTrackDrop = (track: TimelineTrack, event: React.DragEvent<HTMLDivElement>) => {
    if (!canDropOnTimelineTrack(track, event)) return;
    event.preventDefault();
    event.stopPropagation();
    stopTimelineExternalDragScroll();
    setDragTargetTrackId(null);
    setNewTrackDropIndicator(null);
    const startTime = clampTimelineTime(pointerTime(event.clientX), timeline.duration);
    const { interactionType, files, assetItem } = getTimelineDropData(event);

    if (interactionType) {
      const targetTrackId = track.type === 'interaction' ? track.id : undefined;
      addInteractionClipAtTime(interactionType, startTime, targetTrackId);
      setDraggedInteractionType(null);
      return;
    }

    if (assetItem) {
      const targetTrackId = isTimelineMediaAsset(assetItem.asset) && track.type === 'media' ? track.id : undefined;
      void insertLibraryAssetsIntoTimeline([assetItem.asset], { trackId: targetTrackId, startTime });
      return;
    }

    if (files.length > 0) {
      void importFilesToAssets(files, { insert: true, trackId: track.id, startTime });
      return;
    }
  };

  const handleTimelineCanvasDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-node-timeline-track-id]')) return;
    if (!canDropOnTimelineCanvas(event)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    startTimelineExternalDragScroll(event);
    setDragTargetTrackId(null);
    updateNewTrackDropIndicatorAtPointer(event.clientY);
  }, [canDropOnTimelineCanvas, startTimelineExternalDragScroll, updateNewTrackDropIndicatorAtPointer]);

  const handleTimelineCanvasDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-node-timeline-track-id]')) return;
    if (!canDropOnTimelineCanvas(event)) return;

    event.preventDefault();
    event.stopPropagation();
    stopTimelineExternalDragScroll();
    setDragTargetTrackId(null);
    const startTime = clampTimelineTime(pointerTime(event.clientX), timeline.duration);
    const newTrackInsertTarget = getNewTrackInsertTargetAtPointer(event.clientY);
    const newTrackInsertIndex = newTrackInsertTarget?.insertIndex ?? null;
    const forceNewTrack = newTrackInsertTarget !== null;
    const { interactionType, files, assetItem } = getTimelineDropData(event);

    if (interactionType) {
      addInteractionClipAtTime(interactionType, startTime, undefined, forceNewTrack, newTrackInsertIndex);
      setDraggedInteractionType(null);
      return;
    }

    if (files.length > 0) {
      void importFilesToAssets(files, { insert: true, startTime, forceNewTrack, newTrackInsertIndex });
      return;
    }

    if (assetItem) void insertLibraryAssetsIntoTimeline([assetItem.asset], { startTime, forceNewTrack, newTrackInsertIndex });
    setDraggedAssetId(null);
  }, [addInteractionClipAtTime, canDropOnTimelineCanvas, getNewTrackInsertTargetAtPointer, getTimelineDropData, importFilesToAssets, insertLibraryAssetsIntoTimeline, pointerTime, stopTimelineExternalDragScroll, timeline.duration]);

  const releaseTimelineScrollSync = useCallback(() => {
    requestAnimationFrame(() => {
      timelineScrollSyncingRef.current = false;
    });
  }, []);

  const applyTimelineEdgeScroll = useCallback((pointer: { clientX: number; clientY: number }) => {
    const scrollElement = timelineScrollRef.current;
    if (!scrollElement) return false;

    const edgeScroll = getTimelineElementEdgeScroll(scrollElement, pointer, timelineWidth);
    const nextScrollLeft = Math.max(0, Math.min(edgeScroll.maxScrollLeft, scrollElement.scrollLeft + edgeScroll.scrollLeftDelta));
    const nextScrollTop = Math.max(0, Math.min(edgeScroll.maxScrollTop, scrollElement.scrollTop + edgeScroll.scrollTopDelta));
    const didScrollLeft = Math.abs(nextScrollLeft - scrollElement.scrollLeft) > 0.01;
    const didScrollTop = Math.abs(nextScrollTop - scrollElement.scrollTop) > 0.01;

    if (!didScrollLeft && !didScrollTop) return false;

    if (didScrollTop) timelineScrollSyncingRef.current = true;
    if (didScrollLeft) scrollElement.scrollLeft = nextScrollLeft;
    if (didScrollTop) {
      scrollElement.scrollTop = nextScrollTop;
      const trackHeadsScrollElement = timelineTrackHeadsScrollRef.current;
      if (trackHeadsScrollElement) {
        trackHeadsScrollElement.scrollTop = getSyncedScrollTop(scrollElement, trackHeadsScrollElement);
      }
      releaseTimelineScrollSync();
    }

    return true;
  }, [releaseTimelineScrollSync, timelineWidth]);

  useEffect(() => {
    if (!isTimelineExternalDragActive) return;

    let animationFrameId: number | null = null;
    const step = () => {
      const pointer = timelineExternalDragPointerRef.current;
      if (!pointer || performance.now() - pointer.updatedAt > 250) {
        stopTimelineExternalDragScroll();
        return;
      }
      if (applyTimelineEdgeScroll(pointer)) {
        updateNewTrackDropIndicatorAtPointer(pointer.clientY);
      }
      animationFrameId = requestAnimationFrame(step);
    };

    animationFrameId = requestAnimationFrame(step);
    window.addEventListener('dragend', stopTimelineExternalDragScroll);
    window.addEventListener('drop', stopTimelineExternalDragScroll);
    return () => {
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
      window.removeEventListener('dragend', stopTimelineExternalDragScroll);
      window.removeEventListener('drop', stopTimelineExternalDragScroll);
    };
  }, [applyTimelineEdgeScroll, isTimelineExternalDragActive, stopTimelineExternalDragScroll, updateNewTrackDropIndicatorAtPointer]);

  const handleTimelineScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (timelineScrollSyncingRef.current) return;
    const trackHeadsScrollElement = timelineTrackHeadsScrollRef.current;
    if (!trackHeadsScrollElement) return;

    const nextScrollTop = getSyncedScrollTop(event.currentTarget, trackHeadsScrollElement);
    if (Math.abs(trackHeadsScrollElement.scrollTop - nextScrollTop) < 0.5) return;
    timelineScrollSyncingRef.current = true;
    trackHeadsScrollElement.scrollTop = nextScrollTop;
    releaseTimelineScrollSync();
  }, [releaseTimelineScrollSync]);

  const handleTrackHeadsScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (timelineScrollSyncingRef.current) return;
    const timelineScrollElement = timelineScrollRef.current;
    if (!timelineScrollElement) return;

    const nextScrollTop = getSyncedScrollTop(event.currentTarget, timelineScrollElement);
    if (Math.abs(timelineScrollElement.scrollTop - nextScrollTop) < 0.5) return;
    timelineScrollSyncingRef.current = true;
    timelineScrollElement.scrollTop = nextScrollTop;
    releaseTimelineScrollSync();
  }, [releaseTimelineScrollSync]);

  const activeTrackReorderTrackId = trackReorder?.trackId ?? null;
  const activeTrackReorderOriginY = trackReorder?.originY ?? null;

  useEffect(() => {
    if (!activeTrackReorderTrackId || activeTrackReorderOriginY === null) return;

    let animationFrameId: number | null = null;
    const activeTrackId = activeTrackReorderTrackId;
    const originY = activeTrackReorderOriginY;

    const applyTrackReorderMove = (clientY: number) => {
      const reorderTarget = getTrackReorderTargetAtPointer(clientY);
      if (!reorderTarget) return;
      const hasMoved = hasPointerMovedPastDragThreshold(0, originY, 0, clientY);
      timelineTrackReorderTargetRef.current = { insertIndex: reorderTarget.insertIndex, hasMoved };
      setTrackReorder((current) => (
        current && current.trackId === activeTrackId
          ? { ...current, ...reorderTarget, hasMoved }
          : current
      ));
    };

    const step = () => {
      const pointer = timelineTrackReorderPointerRef.current;
      if (pointer && applyTimelineEdgeScroll(pointer)) {
        applyTrackReorderMove(pointer.clientY);
      }
      animationFrameId = requestAnimationFrame(step);
    };

    animationFrameId = requestAnimationFrame(step);

    const handlePointerMove = (event: PointerEvent) => {
      timelineTrackReorderPointerRef.current = { clientX: event.clientX, clientY: event.clientY };
      applyTrackReorderMove(event.clientY);
    };

    const handlePointerUp = () => {
      const target = timelineTrackReorderTargetRef.current;
      timelineTrackReorderPointerRef.current = null;
      timelineTrackReorderTargetRef.current = null;
      setTrackReorder(null);

      if (!target?.hasMoved) return;
      const finalIndex = getTrackReorderFinalIndex(activeTrackId, target.insertIndex);
      if (finalIndex < 0) return;
      const currentIndex = timeline.tracks.findIndex((track) => track.id === activeTrackId);
      if (currentIndex === finalIndex) return;
      writeTimeline(reorderTimelineTrack({ timeline, trackId: activeTrackId, targetIndex: finalIndex }));
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    return () => {
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activeTrackReorderOriginY, activeTrackReorderTrackId, applyTimelineEdgeScroll, getTrackReorderFinalIndex, getTrackReorderTargetAtPointer, timeline, writeTimeline]);

  const handleTimelineWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const scrollElement = timelineScrollRef.current;
    if (!scrollElement) return;

    const isZoomGesture = event.ctrlKey || event.metaKey;
    const isHorizontalScrollGesture = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);

    if (isZoomGesture) {
      event.preventDefault();
      event.stopPropagation();

      const normalizedDelta = getWheelDeltaPixels(event, scrollElement.clientWidth || 1);
      const cappedDelta = Math.sign(normalizedDelta) * Math.min(Math.abs(normalizedDelta), 30);
      const nextZoom = clampTimelineZoom(zoom * Math.exp(-cappedDelta / 300));
      if (nextZoom === zoom) return;

      const viewportRect = scrollElement.getBoundingClientRect();
      const viewportOffsetX = event.clientX - viewportRect.left;
      const anchorTime = pointerTime(event.clientX);
      setZoom(nextZoom);

      requestAnimationFrame(() => {
        const maxScrollLeft = Math.max(0, scrollElement.scrollWidth - scrollElement.clientWidth);
        scrollElement.scrollLeft = Math.max(0, Math.min(maxScrollLeft, anchorTime * nextZoom - viewportOffsetX));
      });
      return;
    }

    if (isHorizontalScrollGesture) {
      event.preventDefault();
      const rawDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const cappedDelta = Math.sign(rawDelta) * Math.min(Math.abs(rawDelta), 120);
      scrollElement.scrollLeft = Math.max(0, scrollElement.scrollLeft + cappedDelta);
    }
  }, [pointerTime, setZoom, zoom]);

  const scrubTimelinePlayhead = useCallback((clientX: number, shiftKey = false) => {
    const rawTime = clampTimelineTime(pointerTime(clientX), timeline.duration);
    const snap = isSnappingEnabled && !shiftKey
      ? resolveTimelineSnap({
          targetTime: rawTime,
          snapPoints: buildTimelineSnapPoints({ timeline }),
        })
      : null;
    const nextTime = clampTimelineTime(roundTimelineTime(snap?.snappedTime ?? rawTime), timeline.duration);
    setCurrentSnapPoint(snap?.snapPoint ?? null);
    updateCurrentTime(nextTime);
  }, [isSnappingEnabled, pointerTime, timeline, updateCurrentTime]);

  const handleTimelineScrubPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || timelineDrag || timelineKeyframeDrag || bookmarkDrag || overlayDrag) return;
    event.preventDefault();
    event.stopPropagation();
    setIsTimelinePlaying(false);
    timelineScrubPointerRef.current = { clientX: event.clientX, clientY: event.clientY, shiftKey: event.shiftKey };
    setTimelineScrub(true);
    scrubTimelinePlayhead(event.clientX, event.shiftKey);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [bookmarkDrag, overlayDrag, scrubTimelinePlayhead, timelineDrag, timelineKeyframeDrag]);

  useEffect(() => {
    if (!timelineScrub) return;

    let animationFrameId: number | null = null;

    const step = () => {
      const pointer = timelineScrubPointerRef.current;

      if (pointer && applyTimelineEdgeScroll(pointer)) {
        scrubTimelinePlayhead(pointer.clientX, pointer.shiftKey);
      }

      animationFrameId = requestAnimationFrame(step);
    };

    animationFrameId = requestAnimationFrame(step);

    const handlePointerMove = (event: PointerEvent) => {
      timelineScrubPointerRef.current = { clientX: event.clientX, clientY: event.clientY, shiftKey: event.shiftKey };
      scrubTimelinePlayhead(event.clientX, event.shiftKey);
    };

    const handlePointerUp = () => {
      timelineScrubPointerRef.current = null;
      setTimelineScrub(false);
      setCurrentSnapPoint(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    return () => {
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [applyTimelineEdgeScroll, scrubTimelinePlayhead, timelineScrub]);

  const handleBookmarkPointerDown = useCallback((bookmark: TimelineBookmark, event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    pushTimelineHistory(timeline);
    timelineBookmarkDragPointerRef.current = { clientX: event.clientX, clientY: event.clientY };
    setBookmarkDrag({ bookmarkId: bookmark.id });
    setCurrentSnapPoint(null);
    setCurrentTime(clampTimelineTime(bookmark.time, timeline.duration));
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [pushTimelineHistory, timeline]);

  const handleBookmarkContextMenu = useCallback((bookmark: TimelineBookmark, event: React.MouseEvent<HTMLButtonElement>) => {
    updateCurrentTime(bookmark.time);
    openTimelineContextMenu(event, {
      kind: 'track',
      time: bookmark.time,
    });
  }, [openTimelineContextMenu, updateCurrentTime]);

  useEffect(() => {
    if (!bookmarkDrag) return;

    let animationFrameId: number | null = null;

    const applyBookmarkDrag = (clientX: number) => {
      const rawTime = clampTimelineTime(pointerTime(clientX), timeline.duration);
      const snap = isSnappingEnabled
        ? resolveTimelineSnap({
            targetTime: rawTime,
            snapPoints: buildTimelineSnapPoints({ timeline, playheadTime: currentTime })
              .filter((point) => point.id !== `bookmark:${bookmarkDrag.bookmarkId}`),
          })
        : null;
      const nextTime = clampTimelineTime(snap?.snappedTime ?? rawTime, timeline.duration);
      setCurrentSnapPoint(snap?.snapPoint ?? null);
      setCurrentTime(nextTime);
      writeTimeline(updateTimelineBookmark({
        timeline,
        bookmarkId: bookmarkDrag.bookmarkId,
        patch: { time: nextTime },
      }), { history: false });
    };

    const step = () => {
      const pointer = timelineBookmarkDragPointerRef.current;
      if (pointer && applyTimelineEdgeScroll(pointer)) {
        applyBookmarkDrag(pointer.clientX);
      }
      animationFrameId = requestAnimationFrame(step);
    };

    animationFrameId = requestAnimationFrame(step);

    const handlePointerMove = (event: PointerEvent) => {
      timelineBookmarkDragPointerRef.current = { clientX: event.clientX, clientY: event.clientY };
      applyBookmarkDrag(event.clientX);
    };

    const handlePointerUp = () => {
      timelineBookmarkDragPointerRef.current = null;
      setBookmarkDrag(null);
      setCurrentSnapPoint(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    return () => {
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [applyTimelineEdgeScroll, bookmarkDrag, currentTime, isSnappingEnabled, pointerTime, timeline, writeTimeline]);

  const handleClipContextMenu = useCallback((clip: TimelineClip, event: React.MouseEvent<HTMLButtonElement>) => {
    const time = clampTimelineTime(pointerTime(event.clientX), timeline.duration);
    const clipRef = findTimelineClip(timeline, clip.id);
    if (!selectedClipIdSet.has(clip.id)) selectLinkedClipGroup(clip.id);
    updateCurrentTime(time);
    openTimelineContextMenu(event, {
      kind: 'clip',
      clipId: clip.id,
      trackId: clipRef?.track.id,
      trackType: clipRef?.track.type,
      time,
    });
  }, [openTimelineContextMenu, pointerTime, selectLinkedClipGroup, selectedClipIdSet, timeline, updateCurrentTime]);

  const handleTrackContextMenu = useCallback((track: TimelineTrack, event: React.MouseEvent<HTMLElement>, menuTime?: number, options: { allowButtonTarget?: boolean } = {}) => {
    const target = event.target as HTMLElement | null;
    if (!options.allowButtonTarget && target?.closest('button')) return;
    const time = clampTimelineTime(menuTime ?? pointerTime(event.clientX), timeline.duration);
    updateCurrentTime(time);
    openTimelineContextMenu(event, {
      kind: 'track',
      trackId: track.id,
      trackType: track.type,
      time,
    });
  }, [openTimelineContextMenu, pointerTime, timeline.duration, updateCurrentTime]);

  const getTimelinePoint = useCallback((clientX: number, clientY: number) => {
    const content = timelineContentRef.current;
    if (!content) return { x: 0, y: 0 };
    const rect = content.getBoundingClientRect();
    return {
      x: Math.max(0, clientX - rect.left),
      y: Math.max(0, clientY - rect.top),
    };
  }, []);

  const getTrackIdsInVerticalRange = useCallback((startY: number, endY: number) => {
    const content = timelineContentRef.current;
    if (!content) return [];
    const contentRect = content.getBoundingClientRect();
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);

    return Array.from(content.querySelectorAll<HTMLElement>('[data-node-timeline-track-id]'))
      .filter((trackElement) => {
        const rect = trackElement.getBoundingClientRect();
        const trackTop = rect.top - contentRect.top;
        const trackBottom = rect.bottom - contentRect.top;
        return trackTop < maxY && trackBottom > minY;
      })
      .map((trackElement) => trackElement.dataset.nodeTimelineTrackId)
      .filter((trackId): trackId is string => Boolean(trackId));
  }, []);

  const getClipIdsForMarquee = useCallback((selection: TimelineMarqueeState) => {
    const minX = Math.min(selection.startX, selection.currentX);
    const maxX = Math.max(selection.startX, selection.currentX);
    const minY = Math.min(selection.startY, selection.currentY);
    const maxY = Math.max(selection.startY, selection.currentY);
    if (maxX - minX < 3 || maxY - minY < 3) return [];

    return selectTimelineClipIdsInRange({
      timeline,
      startTime: minX / zoom,
      endTime: maxX / zoom,
      trackIds: getTrackIdsInVerticalRange(minY, maxY),
    });
  }, [getTrackIdsInVerticalRange, timeline, zoom]);

  const getTrackAtPointer = useCallback(
    (clientX: number, clientY: number, clip: TimelineClip) => {
      const trackElement = (document.elementFromPoint(clientX, clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-node-timeline-track-id]');
      const trackId = trackElement?.dataset.nodeTimelineTrackId;
      const track = trackId ? timeline.tracks.find((item) => item.id === trackId) : null;
      if (!track || track.locked || !canClipLiveOnTrack(clip, track)) return null;
      return track;
    },
    [timeline.tracks]
  );

  const handleTimelineMarqueePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || timelineDrag || timelineKeyframeDrag || timelineScrub || overlayDrag) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button')) return;

    event.preventDefault();
    event.stopPropagation();
    const point = getTimelinePoint(event.clientX, event.clientY);
    const additive = event.metaKey || event.ctrlKey || event.shiftKey;
    const nextSelection: TimelineMarqueeState = {
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
      baseClipIds: additive ? selectedClipIds : [],
      additive,
    };
    setMarqueeSelection(nextSelection);
    timelineMarqueePointerRef.current = { clientX: event.clientX, clientY: event.clientY };
    if (!additive) selectSingleClip(null);
  };

  const handleTimelineGutterClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    selectSingleClip(null);
    updateCurrentTime(pointerTime(event.clientX));
  }, [pointerTime, selectSingleClip, updateCurrentTime]);

  useEffect(() => {
    if (!marqueeSelection) return;

    let animationFrameId: number | null = null;

    const applyMarqueeMove = (clientX: number, clientY: number) => {
      const point = getTimelinePoint(clientX, clientY);
      const nextSelection = {
        ...marqueeSelection,
        currentX: point.x,
        currentY: point.y,
      };
      setMarqueeSelection(nextSelection);

      const clipIds = getClipIdsForMarquee(nextSelection);
      const nextClipIds = nextSelection.additive
        ? Array.from(new Set([...nextSelection.baseClipIds, ...clipIds]))
        : clipIds;
      selectClipIds(nextClipIds, clipIds.at(-1) ?? nextClipIds.at(-1) ?? null);
    };

    const step = () => {
      const pointer = timelineMarqueePointerRef.current;
      if (pointer && applyTimelineEdgeScroll(pointer)) {
        applyMarqueeMove(pointer.clientX, pointer.clientY);
      }
      animationFrameId = requestAnimationFrame(step);
    };

    animationFrameId = requestAnimationFrame(step);

    const handlePointerMove = (event: PointerEvent) => {
      timelineMarqueePointerRef.current = { clientX: event.clientX, clientY: event.clientY };
      applyMarqueeMove(event.clientX, event.clientY);
    };

    const handlePointerUp = (event: PointerEvent) => {
      const selectionWidth = Math.abs(marqueeSelection.currentX - marqueeSelection.startX);
      const selectionHeight = Math.abs(marqueeSelection.currentY - marqueeSelection.startY);
      if (selectionWidth < 3 && selectionHeight < 3) {
        updateCurrentTime(pointerTime(event.clientX));
      }
      timelineMarqueePointerRef.current = null;
      setMarqueeSelection(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    return () => {
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [applyTimelineEdgeScroll, getClipIdsForMarquee, getTimelinePoint, marqueeSelection, pointerTime, selectClipIds, updateCurrentTime]);

  const handleTimelineClipPointerDown = (clip: TimelineClip, event: React.PointerEvent<HTMLElement>, mode: TimelineDragState['mode']) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const clipRef = findTimelineClip(timeline, clip.id);
    const isSelectionModifier = event.metaKey || event.ctrlKey || event.shiftKey;
    let nextSelectedClipIds = selectedClipIds;

    if (mode !== 'move') {
      nextSelectedClipIds = selectedClipIdSet.has(clip.id) ? selectedClipIds : [clip.id];
      if (selectedClipIdSet.has(clip.id)) {
        selectClipIds(nextSelectedClipIds, clip.id);
      } else {
        selectSingleClip(clip.id);
      }
    } else if (event.metaKey || event.ctrlKey) {
      nextSelectedClipIds = selectedClipIdSet.has(clip.id)
        ? selectedClipIds.filter((clipId) => clipId !== clip.id)
        : [...selectedClipIds, clip.id];
      selectClipIds(nextSelectedClipIds, nextSelectedClipIds.includes(clip.id) ? clip.id : nextSelectedClipIds.at(-1) ?? null);
    } else if (event.shiftKey) {
      nextSelectedClipIds = selectedClipIdSet.has(clip.id) ? selectedClipIds : [...selectedClipIds, clip.id];
      selectClipIds(nextSelectedClipIds, clip.id);
    } else if (!selectedClipIdSet.has(clip.id)) {
      nextSelectedClipIds = getLinkedTimelineClipIds({ timeline, clipIds: [clip.id] });
      selectClipIds(nextSelectedClipIds, clip.id);
    }

    if (clipRef?.track.locked) {
      return;
    }
    if (isSelectionModifier && !nextSelectedClipIds.includes(clip.id)) return;
    const linkedDragClipIds = mode === 'move' ? getLinkedTimelineClipIds({ timeline, clipIds: nextSelectedClipIds }) : nextSelectedClipIds;
    timelineDragHistoryPushedRef.current = false;
    timelineDragHistorySnapshotRef.current = timeline;
    timelineDragPointerRef.current = { clientX: event.clientX, clientY: event.clientY };
    setTimelineDrag({
      clipId: clip.id,
      clipIds: linkedDragClipIds,
      mode,
      offsetTime: mode === 'move' ? Math.max(0, pointerTime(event.clientX) - clip.startTime) : 0,
      originX: event.clientX,
      originY: event.clientY,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleTimelineKeyframePointerDown = (clip: TimelineClip, keyframes: TimelineClipKeyframe[], event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || keyframes.length === 0) return;
    const clipRef = findTimelineClip(timeline, clip.id);
    if (!clipRef || clipRef.track.locked) return;

    event.preventDefault();
    event.stopPropagation();
    selectSingleClip(clip.id);
    setSelectedKeyframeIds(keyframes.map((keyframe) => keyframe.id));
    updateCurrentTime(clip.startTime + keyframes[0].time);
    timelineKeyframeDragHistoryPushedRef.current = false;
    timelineKeyframeDragHistorySnapshotRef.current = timeline;
    timelineKeyframeDragPointerRef.current = { clientX: event.clientX, clientY: event.clientY, shiftKey: event.shiftKey };
    setTimelineKeyframeDrag({
      clipId: clip.id,
      keyframeIds: keyframes.map((keyframe) => keyframe.id),
      anchorLocalTime: keyframes[0].time,
      originX: event.clientX,
      originY: event.clientY,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleTimelineKeyframeContextMenu = useCallback((clip: TimelineClip, keyframes: TimelineClipKeyframe[], event: React.MouseEvent<HTMLElement>) => {
    if (keyframes.length === 0) return;
    const clipRef = findTimelineClip(timeline, clip.id);
    if (!clipRef) return;
    const time = clampTimelineTime(clip.startTime + keyframes[0].time, timeline.duration);
    selectSingleClip(clip.id);
    setSelectedKeyframeIds(keyframes.map((keyframe) => keyframe.id));
    updateCurrentTime(time);
    openTimelineContextMenu(event, {
      kind: 'keyframe',
      clipId: clip.id,
      keyframeIds: keyframes.map((keyframe) => keyframe.id),
      trackId: clipRef.track.id,
      trackType: clipRef.track.type,
      time,
    });
  }, [openTimelineContextMenu, selectSingleClip, timeline, updateCurrentTime]);

  useEffect(() => {
    if (!timelineKeyframeDrag) return;

    let animationFrameId: number | null = null;
    const sourceTimeline = timelineKeyframeDragHistorySnapshotRef.current ?? timeline;
    const sourceClipRef = findTimelineClip(sourceTimeline, timelineKeyframeDrag.clipId);

    const pushKeyframeDragHistoryOnce = () => {
      if (timelineKeyframeDragHistoryPushedRef.current) return;
      pushTimelineHistory(sourceTimeline);
      timelineKeyframeDragHistoryPushedRef.current = true;
    };

    const applyKeyframeDrag = (clientX: number, clientY: number, shiftKey = false) => {
      if (!sourceClipRef || !hasPointerMovedPastDragThreshold(timelineKeyframeDrag.originX, timelineKeyframeDrag.originY, clientX, clientY)) return;

      const movingKeyframes = (sourceClipRef.clip.keyframes || []).filter((keyframe) => timelineKeyframeDrag.keyframeIds.includes(keyframe.id));
      if (movingKeyframes.length === 0) return;

      const rawTimelineTime = clampTimelineTime(pointerTime(clientX), sourceTimeline.duration);
      const rawDeltaTime = rawTimelineTime - (sourceClipRef.clip.startTime + timelineKeyframeDrag.anchorLocalTime);
      const snap = isSnappingEnabled && !shiftKey
        ? resolveTimelineSnap({
            targetTime: sourceClipRef.clip.startTime + timelineKeyframeDrag.anchorLocalTime + rawDeltaTime,
            snapPoints: buildTimelineSnapPoints({ timeline: sourceTimeline, playheadTime: currentTime }),
          })
        : null;
      const snappedDeltaTime = (snap?.snappedTime ?? rawTimelineTime) - (sourceClipRef.clip.startTime + timelineKeyframeDrag.anchorLocalTime);
      const minDeltaTime = Math.max(...movingKeyframes.map((keyframe) => -keyframe.time));
      const maxDeltaTime = Math.min(...movingKeyframes.map((keyframe) => sourceClipRef.clip.duration - keyframe.time));
      const boundedDeltaTime = roundTimelineTime(Math.max(minDeltaTime, Math.min(maxDeltaTime, snappedDeltaTime)));
      const nextTime = clampTimelineTime(sourceClipRef.clip.startTime + timelineKeyframeDrag.anchorLocalTime + boundedDeltaTime, sourceTimeline.duration);

      setCurrentSnapPoint(snap?.snapPoint ?? null);
      setCurrentTime(nextTime);
      pushKeyframeDragHistoryOnce();
      writeTimeline(moveTimelineClipKeyframes({
        timeline: sourceTimeline,
        clipId: timelineKeyframeDrag.clipId,
        keyframeIds: timelineKeyframeDrag.keyframeIds,
        deltaTime: boundedDeltaTime,
      }), { history: false });
    };

    const step = () => {
      const pointer = timelineKeyframeDragPointerRef.current;
      if (pointer && applyTimelineEdgeScroll(pointer)) {
        applyKeyframeDrag(pointer.clientX, pointer.clientY, pointer.shiftKey);
      }
      animationFrameId = requestAnimationFrame(step);
    };

    animationFrameId = requestAnimationFrame(step);

    const handlePointerMove = (event: PointerEvent) => {
      timelineKeyframeDragPointerRef.current = { clientX: event.clientX, clientY: event.clientY, shiftKey: event.shiftKey };
      applyKeyframeDrag(event.clientX, event.clientY, event.shiftKey);
    };

    const handlePointerUp = () => {
      timelineKeyframeDragPointerRef.current = null;
      timelineKeyframeDragHistoryPushedRef.current = false;
      timelineKeyframeDragHistorySnapshotRef.current = null;
      setTimelineKeyframeDrag(null);
      setCurrentSnapPoint(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    return () => {
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [applyTimelineEdgeScroll, currentTime, isSnappingEnabled, pointerTime, pushTimelineHistory, timeline, timelineKeyframeDrag, writeTimeline]);

  useEffect(() => {
    if (!timelineDrag) return;

    let animationFrameId: number | null = null;
    const pushTimelineDragHistoryOnce = () => {
      if (timelineDragHistoryPushedRef.current) return;
      pushTimelineHistory(timelineDragHistorySnapshotRef.current ?? timeline);
      timelineDragHistoryPushedRef.current = true;
    };
    const writeTimelineDrag = (nextTimeline: NodeTimeline) => {
      pushTimelineDragHistoryOnce();
      writeTimeline(nextTimeline, { history: false });
    };

    const applyTimelineDrag = (clientX: number, clientY: number) => {
      if (!hasPointerMovedPastDragThreshold(timelineDrag.originX, timelineDrag.originY, clientX, clientY)) return;
      const clipRef = findTimelineClip(timeline, timelineDrag.clipId);
      if (!clipRef) return;
      const dragClipIds = timelineDrag.clipIds.length > 0 ? timelineDrag.clipIds : [timelineDrag.clipId];
      const isGroupMove = timelineDrag.mode === 'move' && dragClipIds.length > 1;
      const snapPoints = isSnappingEnabled ? buildTimelineSnapPoints({ timeline, playheadTime: currentTime, excludeClipIds: dragClipIds }) : [];
      const rawTime = pointerTime(clientX);

      if (timelineDrag.mode === 'move') {
        const rawStart = Math.max(0, rawTime - timelineDrag.offsetTime);
        const snappedStart = isSnappingEnabled ? getSnapAdjustedClipStart({ clip: clipRef.clip, targetStartTime: rawStart, snapPoints }) : rawStart;
        const boundedStart = Math.max(0, roundTimelineTime(snappedStart));
        const newTrackInsertTarget = getNewTrackInsertTargetAtPointer(clientY);
        const newTrackInsertIndex = newTrackInsertTarget?.insertIndex ?? null;
        const shouldForceNewTrack = newTrackInsertTarget !== null;
        setNewTrackDropIndicator(newTrackInsertTarget);
        const targetTrack = shouldForceNewTrack ? null : getTrackAtPointer(clientX, clientY, clipRef.clip) ?? clipRef.track;
        const snapPoint = isSnappingEnabled
          ? snapPoints.find((point) => Math.abs(point.time - boundedStart) < 0.001 || Math.abs(point.time - (boundedStart + clipRef.clip.duration)) < 0.001) ?? null
          : null;
        setCurrentSnapPoint(snapPoint);
        if (isGroupMove) {
          setDragTargetTrackId(targetTrack?.id ?? clipRef.track.id);
          writeTimelineDrag(moveTimelineClipGroup({
            timeline,
            clipIds: dragClipIds,
            anchorClipId: timelineDrag.clipId,
            startTime: boundedStart,
            trackId: targetTrack?.id ?? clipRef.track.id,
            forceNewTrack: shouldForceNewTrack,
            newTrackInsertIndex,
          }));
          return;
        }
        setDragTargetTrackId(targetTrack?.id ?? null);
        writeTimelineDrag(moveTimelineClip({ timeline, clipId: timelineDrag.clipId, startTime: boundedStart, trackId: targetTrack?.id, forceNewTrack: shouldForceNewTrack, newTrackInsertIndex }));
        return;
      }

      const trimSide = timelineDrag.mode === 'trim-left' ? 'left' : 'right';
      setNewTrackDropIndicator(null);
      const anchorEdgeTime = trimSide === 'left' ? clipRef.clip.startTime : getClipEndTime(clipRef.clip);
      const rawDelta = rawTime - anchorEdgeTime;
      const trimClipRefs = dragClipIds
        .map((clipId) => findTimelineClip(timeline, clipId))
        .filter((item): item is NonNullable<ReturnType<typeof findTimelineClip>> => Boolean(item && !item.track.locked));
      const groupTrimSnap = isSnappingEnabled && trimClipRefs.length > 1
        ? trimClipRefs.reduce<{
            snapPoint: TimelineSnapPoint | null;
            snapDistance: number;
            adjustedAnchorTime: number;
          } | null>((best, item) => {
            const edgeTime = trimSide === 'left' ? item.clip.startTime : getClipEndTime(item.clip);
            const snap = resolveTimelineSnap({ targetTime: edgeTime + rawDelta, snapPoints });
            if (!snap.snapPoint) return best;
            if (best && snap.snapDistance >= best.snapDistance) return best;
            return {
              snapPoint: snap.snapPoint,
              snapDistance: snap.snapDistance,
              adjustedAnchorTime: roundTimelineTime(anchorEdgeTime + (snap.snappedTime - edgeTime)),
            };
          }, null)
        : null;
      const trimSnap = isSnappingEnabled && !groupTrimSnap ? resolveTimelineSnap({ targetTime: rawTime, snapPoints }) : null;
      const snappedTrimTime = groupTrimSnap?.adjustedAnchorTime ?? trimSnap?.snappedTime ?? rawTime;
      setCurrentSnapPoint(groupTrimSnap?.snapPoint ?? trimSnap?.snapPoint ?? null);

      if (trimClipRefs.length > 1) {
        writeTimelineDrag(trimTimelineClipGroup({
          timeline,
          clipIds: dragClipIds,
          anchorClipId: timelineDrag.clipId,
          side: trimSide,
          time: snappedTrimTime,
        }));
        return;
      }

      const trimTimeline = isRippleEditingEnabled ? trimTimelineClipWithRipple : trimTimelineClip;
      writeTimelineDrag(trimTimeline({ timeline, clipId: timelineDrag.clipId, side: trimSide, time: snappedTrimTime }));
    };

    const step = () => {
      const pointer = timelineDragPointerRef.current;

      if (pointer && applyTimelineEdgeScroll(pointer)) {
        applyTimelineDrag(pointer.clientX, pointer.clientY);
      }

      animationFrameId = requestAnimationFrame(step);
    };

    animationFrameId = requestAnimationFrame(step);

    const handlePointerMove = (event: PointerEvent) => {
      timelineDragPointerRef.current = { clientX: event.clientX, clientY: event.clientY };
      applyTimelineDrag(event.clientX, event.clientY);
    };

    const handlePointerUp = () => {
      timelineDragPointerRef.current = null;
      timelineDragHistoryPushedRef.current = false;
      timelineDragHistorySnapshotRef.current = null;
      setTimelineDrag(null);
      setDragTargetTrackId(null);
      setNewTrackDropIndicator(null);
      setCurrentSnapPoint(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    return () => {
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [applyTimelineEdgeScroll, currentTime, getNewTrackInsertTargetAtPointer, getTrackAtPointer, isRippleEditingEnabled, isSnappingEnabled, pointerTime, pushTimelineHistory, timeline, timelineDrag, writeTimeline]);

  const handleOverlayPointerDown = (clip: TimelineInteractionClip | TimelineMediaClip, event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const frame = previewFrameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const clipRect = getPreviewElementRect(clip);
    selectSingleClip(clip.id);
    overlayDragHistoryPushedRef.current = false;
    overlayDragHistorySnapshotRef.current = timeline;
    setOverlayDrag({
      clipId: clip.id,
      mode: 'move',
      offsetX: event.clientX - rect.left - clipRect.x * rect.width,
      offsetY: event.clientY - rect.top - clipRect.y * rect.height,
      originX: event.clientX,
      originY: event.clientY,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleOverlayResizePointerDown = (clip: TimelineInteractionClip | TimelineMediaClip, handle: OverlayResizeHandle, event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    selectSingleClip(clip.id);
    overlayDragHistoryPushedRef.current = false;
    overlayDragHistorySnapshotRef.current = timeline;
    setOverlayDrag({
      clipId: clip.id,
      mode: 'resize',
      handle,
      originRect: getPreviewElementRect(clip),
      originX: event.clientX,
      originY: event.clientY,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleOverlayRotatePointerDown = (clip: TimelineInteractionClip, event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const frame = previewFrameRef.current;
    if (!frame) return;
    const bounds = frame.getBoundingClientRect();
    const clipRect = getClipRect(clip);
    const centerX = bounds.left + (clipRect.x + clipRect.width / 2) * bounds.width;
    const centerY = bounds.top + (clipRect.y + clipRect.height / 2) * bounds.height;
    const originAngle = getPointerAngleDegrees(centerX, centerY, event.clientX, event.clientY);
    const originRotation = getTimelineClipRotation(clip);
    selectSingleClip(clip.id);
    overlayDragHistoryPushedRef.current = false;
    overlayDragHistorySnapshotRef.current = timeline;
    overlayRotateStateRef.current = {
      lastAngle: originAngle,
      rotation: originRotation,
    };
    setOverlayDrag({
      clipId: clip.id,
      mode: 'rotate',
      centerX,
      centerY,
      originAngle,
      originRotation,
      originX: event.clientX,
      originY: event.clientY,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  useEffect(() => {
    if (!overlayDrag) return;

    const pushOverlayDragHistoryOnce = () => {
      if (overlayDragHistoryPushedRef.current) return;
      pushTimelineHistory(overlayDragHistorySnapshotRef.current ?? timelineRef.current);
      overlayDragHistoryPushedRef.current = true;
    };
    const writeOverlayDrag = (nextTimeline: NodeTimeline) => {
      pushOverlayDragHistoryOnce();
      timelineRef.current = nextTimeline;
      compiledTimelineRef.current = compileNodeTimeline(nextTimeline);
      applyTimeline(nextTimeline);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!hasPointerMovedPastDragThreshold(overlayDrag.originX, overlayDrag.originY, event.clientX, event.clientY)) return;
      const frame = previewFrameRef.current;
      if (!frame) return;
      const bounds = frame.getBoundingClientRect();
      const sourceTimeline = timelineRef.current;
      const sourceCompiledTimeline = compiledTimelineRef.current;
      const clipRef = findTimelineClip(sourceTimeline, overlayDrag.clipId);
      const clip = clipRef?.clip;
      const canTransformClip = clip && !clipRef.track.locked && (isInteractionClip(clip) || (isMediaClip(clip) && isVisualMediaClip(clip)));
      if (!canTransformClip) return;

      if (overlayDrag.mode === 'rotate') {
        const pointerDistance = Math.hypot(event.clientX - overlayDrag.centerX, event.clientY - overlayDrag.centerY);
        if (pointerDistance < OVERLAY_ROTATION_DEAD_ZONE_PX) return;
        const pointerAngle = getPointerAngleDegrees(overlayDrag.centerX, overlayDrag.centerY, event.clientX, event.clientY);
        const rotateState = overlayRotateStateRef.current ?? {
          lastAngle: overlayDrag.originAngle,
          rotation: overlayDrag.originRotation,
        };
        const rawRotation = rotateState.rotation + getShortestRotationDelta(pointerAngle, rotateState.lastAngle);
        const nextRotation = roundOverlayRotation(isSnappingEnabledRef.current ? snapOverlayRotation(rawRotation) : rawRotation);
        overlayRotateStateRef.current = {
          lastAngle: pointerAngle,
          rotation: nextRotation,
        };
        if (getTimelineClipRotation(clip) === nextRotation) return;
        updateOverlaySnapLines([]);
        writeOverlayDrag(updateTimelineClip({
          timeline: sourceTimeline,
          clipId: overlayDrag.clipId,
          update: (item) => (
            isInteractionClip(item) || (isMediaClip(item) && isVisualMediaClip(item))
              ? { ...item, rotation: nextRotation }
              : item
          ),
        }));
        return;
      }

      const snapTargets = buildPreviewSnapTargets(
        [...sourceCompiledTimeline.visualMediaClips, ...sourceCompiledTimeline.interactionClips]
          .filter((item) => item.id !== overlayDrag.clipId)
          .map(getPreviewElementRect)
      );

      if (overlayDrag.mode === 'move') {
        const rect = getPreviewElementRect(clip);
        const rawRect = {
          ...rect,
          x: (event.clientX - bounds.left - overlayDrag.offsetX) / bounds.width,
          y: (event.clientY - bounds.top - overlayDrag.offsetY) / bounds.height,
        };
        const snap = isSnappingEnabledRef.current ? snapOverlayRect({ rect: rawRect, targets: snapTargets }) : { rect: rawRect, lines: [] };
        updateOverlaySnapLines(snap.lines);
        writeOverlayDrag(updateTimelineClipRect({ timeline: sourceTimeline, clipId: overlayDrag.clipId, rect: snap.rect }));
        return;
      }

      const pointerX = (event.clientX - bounds.left) / bounds.width;
      const pointerY = (event.clientY - bounds.top) / bounds.height;
      const rawRect = resizeOverlayRect(overlayDrag.originRect, overlayDrag.handle, pointerX, pointerY);
      const snap = isSnappingEnabledRef.current ? snapOverlayRect({ rect: rawRect, resizeHandle: overlayDrag.handle, targets: snapTargets }) : { rect: rawRect, lines: [] };
      updateOverlaySnapLines(snap.lines);
      writeOverlayDrag(updateTimelineClipRect({ timeline: sourceTimeline, clipId: overlayDrag.clipId, rect: snap.rect }));
    };

    const handlePointerUp = () => {
      overlayDragHistoryPushedRef.current = false;
      overlayDragHistorySnapshotRef.current = null;
      overlayRotateStateRef.current = null;
      setOverlayDrag(null);
      updateOverlaySnapLines([]);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [applyTimeline, overlayDrag, pushTimelineHistory, updateOverlaySnapLines]);

  if (!selectedOrFirstNode) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-white">
        <div className="max-w-sm text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-openfmv-card border border-white/10 bg-white/[0.07] text-openfmv-muted">
            <Layers size={26} />
          </div>
          <h2 className="mt-5 text-xl font-semibold">{t('empty.noNodesTitle')}</h2>
          <p className="mt-2 text-sm leading-6 text-openfmv-muted">{t('empty.noNodesDescription')}</p>
          <Link href={blueprintHref} className="mt-5 inline-flex h-openfmv-control items-center gap-2 rounded-openfmv-control bg-white/[0.10] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.15]">
            <GitBranch size={16} />
            {t('empty.blueprint')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col gap-[0.18rem] pt-[58px] text-white">
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(220px,250px)_minmax(420px,1fr)_minmax(210px,250px)] gap-[0.19rem] px-3 min-[1180px]:grid-cols-[minmax(250px,330px)_minmax(520px,1fr)_minmax(230px,330px)] min-[1440px]:grid-cols-[minmax(320px,460px)_minmax(640px,1fr)_minmax(320px,400px)]">
      <aside className="grid min-h-0 grid-cols-[48px_minmax(0,1fr)] overflow-hidden rounded-openfmv-tool border border-white/10 bg-[#171717] shadow-[0_18px_56px_rgba(0,0,0,0.30)]">
        <div className="flex flex-col border-r border-white/10 bg-[#141516]">
          <div className="flex flex-col gap-1 p-1.5">
            {([
              { id: 'assets' as const, label: t('tabs.assets'), icon: FolderOpen },
              { id: 'interactions' as const, label: t('tabs.interactions'), icon: Hand },
              { id: 'audio' as const, label: t('rail.audio'), icon: Headphones },
            ]).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveLibraryTab(item.id)}
                  aria-label={item.label}
                  title={item.label}
                  aria-pressed={activeLibraryTab === item.id}
                  className={`grid h-openfmv-editor w-openfmv-editor place-items-center rounded-openfmv-tool border transition ${activeLibraryTab === item.id ? 'border-sky-400/45 bg-sky-500/14 text-sky-200' : 'border-transparent text-openfmv-muted hover:bg-white/[0.06] hover:text-white'}`}
                >
                  <Icon size={17} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid min-h-0 grid-rows-[44px_minmax(0,1fr)]">
          <div className="flex items-center justify-between border-b border-white/10 px-3">
            <div className="min-w-0 text-sm font-semibold text-openfmv-sub">{activePanelTitle}</div>
            {isMediaLibraryTab ? (
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setAssetViewMode((mode) => (mode === 'grid' ? 'list' : 'grid'))} className="grid h-openfmv-tool w-openfmv-tool place-items-center rounded-openfmv-tool text-openfmv-muted transition hover:bg-white/[0.06] hover:text-white" title={t(assetViewMode === 'grid' ? 'panel.listView' : 'panel.gridView')} aria-label={t(assetViewMode === 'grid' ? 'panel.listView' : 'panel.gridView')}>
                  <List size={15} />
                </button>
                <button type="button" onClick={() => setAssetSortMode((mode) => (mode === 'recent' ? 'name' : 'recent'))} className="grid h-openfmv-tool w-openfmv-tool place-items-center rounded-openfmv-tool text-openfmv-muted transition hover:bg-white/[0.06] hover:text-white" title={t(assetSortMode === 'recent' ? 'panel.sortByName' : 'panel.sortByRecent')} aria-label={t(assetSortMode === 'recent' ? 'panel.sortByName' : 'panel.sortByRecent')}>
                  <ArrowDownUp size={15} />
                </button>
                <button type="button" onClick={handleAssetImportClick} disabled={isImportingAsset} className="inline-flex h-openfmv-tool items-center gap-2 rounded-openfmv-tool border border-white/10 px-2.5 text-xs font-semibold text-white transition hover:bg-white/[0.07] disabled:opacity-50">
                  <Upload size={14} />
                  {isImportingAsset ? t('panel.importing') : t('actions.import')}
                </button>
              </div>
            ) : activeLibraryTab === 'interactions' ? (
              <div className="flex items-center gap-1">
                {interactionPanelClipTypes.map((type) => {
                  const Icon = interactionIcons[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      draggable
                      onClick={() => addInteractionClip(type)}
                      onDragStart={(event) => {
                        setDraggedInteractionType(type);
                        event.dataTransfer.effectAllowed = 'copy';
                        event.dataTransfer.setData('application/openfmv-interaction-type', type);
                        event.dataTransfer.setData('text/plain', t(`clipTypes.${type}`));
                      }}
                      onDragEnd={() => {
                        setDraggedInteractionType(null);
                        setDragTargetTrackId(null);
                      }}
                      className="grid h-openfmv-tool w-openfmv-tool place-items-center rounded-openfmv-tool border border-white/10 text-openfmv-sub transition hover:bg-white/[0.07] hover:text-white"
                      title={t(`clipTypes.${type}`)}
                      aria-label={t(`clipTypes.${type}`)}
                    >
                      <Icon size={15} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div />
            )}
          </div>

          {isMediaLibraryTab ? (
            <div
              className={`min-h-0 overflow-y-auto p-3 transition ${isAssetDropActive ? 'bg-sky-400/10' : ''}`}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsAssetDropActive(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
              }}
              onDragLeave={() => setIsAssetDropActive(false)}
              onDrop={handleAssetPanelDrop}
            >
              <input ref={assetInputRef} type="file" accept={activeImportAccept} multiple className="hidden" onChange={(event) => void importFilesToAssets(Array.from(event.target.files || []))} />
              {assetLibraryError && (
                <div className="mb-2 rounded-openfmv-tool border border-orange-300/20 bg-orange-500/10 px-3 py-2 text-xs leading-5 text-orange-100">
                  {assetLibraryError}
                </div>
              )}
              {isAssetDropActive || visibleMediaAssetItems.length === 0 ? (
                <button type="button" onClick={handleAssetImportClick} disabled={isImportingAsset} className="grid h-40 w-full place-items-center rounded-openfmv-tool border border-dashed border-white/22 bg-white/[0.045] text-center transition hover:border-white/34 hover:bg-white/[0.065] disabled:opacity-60">
                  <span>
                    <CloudUpload size={38} className="mx-auto text-openfmv-sub" />
                    <span className="mt-4 block text-sm text-openfmv-sub">{isImportingAsset ? t('panel.importing') : activeLibraryTab === 'audio' ? t('panel.dropAudio') : t('panel.dropMedia')}</span>
                    <span className="mt-2 block px-5 text-xs leading-5 text-openfmv-muted">{activeLibraryTab === 'audio' ? t('panel.dragAudioToTimeline') : t('panel.dragMediaToTimeline')}</span>
                  </span>
                </button>
              ) : (
                <div className={assetViewMode === 'grid' ? 'grid grid-cols-2 gap-2' : 'space-y-2'}>
                  {visibleMediaAssetItems.map((item) => {
                    const { asset, projectId, projectTitle } = item;
                    const metadataLabel = getAssetMetadataLabel(asset);
                    return (
                      <div key={getTimelineAssetItemKey(item)} className="group/card relative min-w-0">
                        <button
                          type="button"
                          draggable
                          onClick={() => void insertLibraryAssetsIntoTimeline([asset])}
                          onDragStart={(event) => {
                            setDraggedAssetId(asset.id);
                            event.dataTransfer.effectAllowed = 'copy';
                            event.dataTransfer.setData('application/openfmv-asset-id', asset.id);
                            event.dataTransfer.setData('application/openfmv-asset-project-id', projectId);
                            event.dataTransfer.setData('text/plain', asset.name);
                          }}
                          onDragEnd={() => setDraggedAssetId(null)}
                          className={`w-full min-w-0 rounded-openfmv-tool border border-white/10 bg-white/[0.045] text-left transition hover:border-white/24 hover:bg-white/[0.075] ${assetViewMode === 'grid' ? 'p-2' : 'flex items-center gap-2 p-2 pr-9'}`}
                          title={t('panel.addToTimeline')}
                        >
                          <div className={`grid shrink-0 place-items-center overflow-hidden rounded-openfmv-tool bg-black/28 text-openfmv-sub ${assetViewMode === 'grid' ? 'mb-2 aspect-video w-full' : 'h-12 w-14'}`}>
                            <AssetLibraryPreview asset={asset} />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-white">{asset.name}</div>
                            <div className="mt-1 truncate text-[10px] text-openfmv-muted">
                              {t(`mediaTypes.${asset.type}`)}
                              {metadataLabel ? ` / ${metadataLabel}` : ''}
                            </div>
                            <div className="mt-0.5 truncate text-[10px] text-openfmv-muted">{projectTitle}</div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void removeAssetFromLibrary(item);
                          }}
                          className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-openfmv-tool border border-white/10 bg-black/70 text-openfmv-muted opacity-0 shadow-[0_10px_28px_rgba(0,0,0,0.35)] transition hover:border-red-300/35 hover:bg-red-500/16 hover:text-red-100 focus:opacity-100 group-hover/card:opacity-100"
                          title={t('panel.removeAsset')}
                          aria-label={t('panel.removeAsset')}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeLibraryTab === 'interactions' ? (
            <div className="min-h-0 overflow-y-auto p-3">
              <div className="grid grid-cols-2 gap-2">
                {interactionPanelClipTypes.map((type) => {
                  const Icon = interactionIcons[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      draggable
                      onClick={() => addInteractionClip(type)}
                      onDragStart={(event) => {
                        setDraggedInteractionType(type);
                        event.dataTransfer.effectAllowed = 'copy';
                        event.dataTransfer.setData('application/openfmv-interaction-type', type);
                        event.dataTransfer.setData('text/plain', t(`clipTypes.${type}`));
                      }}
                      onDragEnd={() => {
                        setDraggedInteractionType(null);
                        setDragTargetTrackId(null);
                      }}
                      className="flex h-20 flex-col items-center justify-center gap-2 rounded-openfmv-tool border border-white/10 bg-white/[0.045] text-xs font-semibold text-openfmv-sub transition hover:bg-white/[0.07] hover:text-white"
                    >
                      <Icon size={18} />
                      <span className="truncate px-1">{t(`clipTypes.${type}`)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div />
          )}
        </div>
      </aside>

      <section className="min-h-0 overflow-hidden rounded-openfmv-tool border border-white/10 bg-[#171717] shadow-[0_18px_56px_rgba(0,0,0,0.30)]">
        <div className="flex size-full min-h-0 min-w-0 flex-col">
          <div className="flex min-h-0 min-w-0 flex-1 p-2 pb-0">
            <div ref={previewViewportRef} className="relative flex size-full min-h-0 min-w-0 items-center justify-center overflow-visible">
              <div
                ref={previewFrameRef}
                data-node-preview-frame
                className={getPreviewFrameClassName()}
                style={previewFrameSize ? {
                  height: previewFrameSize.height,
                  width: previewFrameSize.width,
                } : {
                  aspectRatio: previewCanvasAspectRatio,
                  width: '100%',
                }}
              >
              <div className="absolute inset-0 overflow-hidden">
                {activeVisualMediaClips.length > 0 ? (
                  activeVisualMediaClips.map((clip) => (
                    <PreviewMediaLayer
                      key={clip.id}
                      clip={clip}
                      selected={clip.id === selectedClip?.id}
                      currentTime={currentTime}
                      isTimelinePlaying={isTimelinePlaying}
                    playerRef={clip.id === visualMediaClip?.id && clip.type === 'video' ? videoRef : undefined}
                    onPointerDown={handleOverlayPointerDown}
                    onClick={selectSingleClip}
                    onResizePointerDown={handleOverlayResizePointerDown}
                    onAspectRatioReady={handlePreviewMediaAspectRatioReady}
                  />
                  ))
                ) : (
                  <div className="grid h-full w-full place-items-center bg-[linear-gradient(135deg,#151821,#070a10_62%,#17120f)]">
                    <div className="text-center">
                      <Film size={34} className="mx-auto text-openfmv-muted" />
                      <div className="mt-3 text-sm font-semibold text-openfmv-sub">{t('preview.noVisualMedia')}</div>
                    </div>
                  </div>
                )}
                {overlaySnapLines.map((line) => (
                  <div
                    key={`${line.orientation}-${line.position}`}
                    data-node-overlay-snap-line={line.orientation}
                    className={`pointer-events-none absolute z-30 bg-sky-300/90 shadow-[0_0_12px_rgba(56,189,248,0.45)] ${line.orientation === 'vertical' ? 'bottom-0 top-0 w-px' : 'left-0 right-0 h-px'}`}
                    style={line.orientation === 'vertical' ? { left: `${line.position * 100}%` } : { top: `${line.position * 100}%` }}
                  />
                ))}
                {compiledTimeline.interactionClips.map((clip) => {
                  const resolvedClip = resolveTimelineClipKeyframes(clip, currentTime);
                  const rect = getClipRect(resolvedClip);
                  const active = isTimelineClipActive(clip, currentTime);
                  const qteConfig = isQteButtonClip(resolvedClip) ? getQteConfig(resolvedClip) : null;
                  const qteCueLabel = qteConfig && qteConfig.showCueLabel !== false ? getQteCueLabel(qteConfig) : null;
                  const buttonVisualStyle = getButtonClipInlineStyle(resolvedClip);
                  const selected = resolvedClip.id === selectedClip?.id;
                  const previewOpacity = active || selected
                    ? getTimelineClipOpacity(resolvedClip)
                    : Math.min(getTimelineClipOpacity(resolvedClip), 0.45);
                  const rotating = overlayDrag?.mode === 'rotate' && overlayDrag.clipId === resolvedClip.id;
                  return (
                    <button
                      key={clip.id}
                      type="button"
                      onPointerDown={(event) => handleOverlayPointerDown(resolvedClip, event)}
                      onClick={() => selectSingleClip(resolvedClip.id)}
                      className={getPreviewClipClassName(resolvedClip, selected, active)}
                      style={{
                        left: `${rect.x * 100}%`,
                        top: `${rect.y * 100}%`,
                        width: `${rect.width * 100}%`,
                        height: `${rect.height * 100}%`,
                        opacity: previewOpacity,
                        transform: `rotate(${getTimelineClipRotation(resolvedClip)}deg)`,
                        transformOrigin: 'center',
                        transition: rotating ? 'none' : undefined,
                        backgroundColor: 'transparent',
                        borderColor: 'transparent',
                        borderWidth: 0,
                        boxShadow: 'none',
                        color: buttonVisualStyle.color,
                      }}
                    >
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0"
                        style={buttonVisualStyle}
                      />
                      {qteConfig ? (
                        <span className="relative z-10 flex min-w-0 max-w-full flex-col items-center justify-center gap-0.5 text-center leading-tight">
                          {qteCueLabel && (
                            <span className="block max-w-full truncate font-mono text-[10px] font-semibold leading-none text-white/75">
                              {qteCueLabel}
                            </span>
                          )}
                          <span className="block max-w-full truncate">{getTimelineQteDisplayName(resolvedClip)}</span>
                        </span>
                      ) : (
                        <span className="relative z-10 truncate">{getTimelineClipLabel(resolvedClip)}</span>
                      )}
                      {selected && overlayResizeHandles.map((item) => (
                        <span
                          key={item.handle}
                          data-node-overlay-resize-handle={item.handle}
                          onPointerDown={(event) => handleOverlayResizePointerDown(resolvedClip, item.handle, event)}
                          className={`absolute z-20 h-2.5 w-2.5 rounded-full border border-white bg-sky-400 shadow-[0_0_0_2px_rgba(0,0,0,0.35)] ${item.className}`}
                        />
                      ))}
                    </button>
                  );
                })}
              </div>
              {selectedButtonToolbarClip && (
                <PreviewButtonRotationHandle
                  clip={selectedButtonToolbarClip}
                  dragging={overlayDrag?.mode === 'rotate' && overlayDrag.clipId === selectedButtonToolbarClip.id}
                  label={t('fields.rotation')}
                  onPointerDown={handleOverlayRotatePointerDown}
                />
              )}
              {selectedButtonToolbarClip && overlayDrag?.mode !== 'rotate' && (
                <ButtonFloatingStyleToolbar
                  t={t}
                  clip={selectedButtonToolbarClip}
                  assetItems={assetLibrary}
                  draggedAssetId={draggedAssetId}
                  isImportingImage={isImportingAsset}
                  onImportImage={importButtonBackgroundImage}
                  onUpdate={(update) => updateClip(selectedButtonToolbarClip.id, (clip) => (isInteractionClip(clip) ? update(clip) : clip))}
                />
              )}
            </div>
            {activeAudioClips.map((clip) => (
              <PreviewAudioLayer key={clip.id} clip={clip} currentTime={currentTime} isTimelinePlaying={isTimelinePlaying} />
            ))}
            </div>
          </div>

          <div className="grid h-openfmv-control shrink-0 grid-cols-[1fr_auto_1fr] items-center px-3">
            <div className="flex min-w-0 items-center font-mono text-xs">
              <span className="text-white">{currentTime.toFixed(2)}</span>
              <span className="px-2 text-openfmv-muted">/</span>
              <span className="text-openfmv-muted">{timeline.duration.toFixed(2)}s</span>
            </div>
            <button type="button" onClick={toggleTimelinePlayback} className={`grid h-openfmv-tool w-openfmv-tool place-items-center rounded-openfmv-pill transition hover:bg-white/[0.12] hover:text-white ${isTimelinePlaying ? 'bg-sky-400/18 text-sky-100' : 'text-openfmv-sub'}`} title={isTimelinePlaying ? t('actions.pause') : t('actions.play')} aria-label={isTimelinePlaying ? t('actions.pause') : t('actions.play')}>
              {isTimelinePlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
            </button>
            <div className="min-w-0 justify-self-end text-right text-xs font-semibold text-openfmv-sub">
              <span className="block truncate">{getNodeTitle(selectedOrFirstNode, t)}</span>
            </div>
          </div>
        </div>
      </section>

      <aside className="min-h-0 overflow-y-auto rounded-openfmv-tool border border-white/10 bg-[#202020] shadow-[0_18px_56px_rgba(0,0,0,0.30)]">
        <div className="border-b border-white/10 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-openfmv-muted">{t('inspector.title')}</div>
            {selectedClip && <span className="rounded-openfmv-pill border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[9px] font-semibold uppercase text-openfmv-sub">{selectedClip.type}</span>}
          </div>
          <h2 className="mt-1.5 truncate text-sm font-semibold text-white">{selectedClip ? getTimelineClipLabel(selectedClip) : t('inspector.noClipSelected')}</h2>
        </div>

        <div className="p-3">
        {!selectedClip ? (
          <div className="rounded-openfmv-tool border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-openfmv-muted">
            {t('inspector.empty')}
          </div>
        ) : isMediaClip(selectedClip) ? (
          <MediaClipInspector
            t={t}
            clip={resolveTimelineClipKeyframes(selectedClip, currentTime)}
            currentTime={currentTime}
            onUpdate={(update) => updateClip(selectedClip.id, (clip) => (isMediaClip(clip) ? update(clip) : clip))}
            onAddKeyframes={(keyframes) => addClipKeyframes(selectedClip.id, keyframes)}
            onRemoveKeyframes={(keyframeIds) => removeClipKeyframes(selectedClip.id, keyframeIds)}
            onDelete={deleteSelectedClip}
          />
        ) : isInteractionClip(selectedClip) ? (
          <InteractionClipInspector
            t={t}
            clip={resolveTimelineClipKeyframes(selectedClip, currentTime)}
            nodes={nodes}
            activeNode={selectedOrFirstNode}
            edges={edges}
            onOutputTargetChange={updateTimelineOutputTarget}
            onUpdate={(update) => updateClip(selectedClip.id, (clip) => (isInteractionClip(clip) ? update(clip) : clip))}
          />
        ) : null}
        </div>
      </aside>
      </div>

      <section className="mx-3 mb-3 h-[34vh] min-h-[260px] shrink-0 overflow-hidden rounded-openfmv-tool border border-white/10 bg-[#171717] shadow-[0_18px_56px_rgba(0,0,0,0.26)]">
        <div className="relative flex h-openfmv-control items-center justify-between border-b border-white/10 bg-[#1b1b1b] px-3">
          <div className="flex items-center gap-1 text-openfmv-sub">
            {([
              { icon: Undo2, label: t('timeline.toolbar.undo'), onClick: undoTimeline, disabled: !canUndoTimeline },
              { icon: Redo2, label: t('timeline.toolbar.redo'), onClick: redoTimeline, disabled: !canRedoTimeline },
              { icon: Scissors, label: t('timeline.toolbar.split'), onClick: splitSelectedClip, disabled: !canSplitSelectedClip },
              { icon: AlignLeft, label: t('timeline.toolbar.splitLeft'), onClick: splitSelectedClipLeft, disabled: !canSplitSelectedClip },
              { icon: AlignRight, label: t('timeline.toolbar.splitRight'), onClick: splitSelectedClipRight, disabled: !canSplitSelectedClip },
              { icon: Headphones, label: selectedSourceAudioLabel, onClick: () => toggleSourceAudioForClip(selectedClip?.id), disabled: !canToggleSelectedSourceAudio, active: selectedClip ? isTimelineSourceAudioSeparated(selectedClip) : false },
              { icon: hasLinkedEditableClip ? Unlink2 : LinkIcon, label: hasLinkedEditableClip ? t('timeline.toolbar.unlink') : t('timeline.toolbar.link'), onClick: toggleSelectedClipLink, disabled: !canToggleSelectedClipLink, active: hasLinkedEditableClip },
              { icon: hasHiddenEditableClip ? Eye : EyeOff, label: hasHiddenEditableClip ? t('timeline.toolbar.showClips') : t('timeline.toolbar.hideClips'), onClick: () => setSelectedClipsHidden(!hasHiddenEditableClip), disabled: selectedEditableClipIds.length === 0, active: hasHiddenEditableClip },
              { icon: hasMutedEditableClip ? Volume2 : VolumeX, label: hasMutedEditableClip ? t('timeline.toolbar.unmuteClips') : t('timeline.toolbar.muteClips'), onClick: () => setSelectedClipsMuted(!hasMutedEditableClip), disabled: selectedEditableAudibleClipIds.length === 0, active: hasMutedEditableClip },
              { icon: Copy, label: t('timeline.toolbar.duplicate'), onClick: duplicateSelectedClip, disabled: selectedEditableClipIds.length === 0 },
              { icon: Snowflake, label: t('timeline.toolbar.freeze'), onClick: freezeSelectedClip, disabled: !canFreezeSelectedClip },
              { icon: Diamond, label: selectedClipKeyframesExpanded ? t('timeline.toolbar.collapseKeyframes') : t('timeline.toolbar.expandKeyframes'), onClick: () => toggleKeyframeLanesForClip(selectedClip?.id), disabled: !selectedClip?.keyframes?.length, active: selectedClipKeyframesExpanded },
              { icon: Trash2, label: t('actions.delete'), onClick: deleteSelectedClip, disabled: selectedEditableClipIds.length === 0 },
              { icon: Bookmark, label: currentBookmark ? t('timeline.toolbar.removeMarker') : t('timeline.toolbar.marker'), onClick: toggleCurrentBookmark, active: Boolean(currentBookmark) },
            ]).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  disabled={item.disabled}
                  className={`grid h-openfmv-tool w-openfmv-tool place-items-center rounded-openfmv-tool transition hover:bg-white/[0.07] hover:text-white disabled:opacity-35 ${item.active ? 'bg-amber-400/16 text-amber-200' : ''}`}
                  title={item.label}
                  aria-label={item.label}
                >
                  <Icon size={15} />
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1 text-openfmv-sub">
            <button type="button" onClick={() => setIsRippleEditingEnabled((value) => !value)} aria-pressed={isRippleEditingEnabled} className={`grid h-openfmv-tool w-openfmv-tool place-items-center rounded-openfmv-tool transition hover:bg-white/[0.07] ${isRippleEditingEnabled ? 'text-sky-300' : 'text-openfmv-muted'}`} title={isRippleEditingEnabled ? t('timeline.toolbar.disableRipple') : t('timeline.toolbar.enableRipple')} aria-label={isRippleEditingEnabled ? t('timeline.toolbar.disableRipple') : t('timeline.toolbar.enableRipple')}>
              <ChevronsRight size={15} />
            </button>
            <button type="button" onClick={() => setIsSnappingEnabled((value) => !value)} aria-pressed={isSnappingEnabled} className={`grid h-openfmv-tool w-openfmv-tool place-items-center rounded-openfmv-tool transition hover:bg-white/[0.07] ${isSnappingEnabled ? 'text-sky-300' : 'text-openfmv-muted'}`} title={isSnappingEnabled ? t('timeline.toolbar.disableSnap') : t('timeline.toolbar.enableSnap')} aria-label={isSnappingEnabled ? t('timeline.toolbar.disableSnap') : t('timeline.toolbar.enableSnap')}>
              <Magnet size={15} />
            </button>
            <button type="button" onClick={zoomOut} className="grid h-openfmv-tool w-openfmv-tool place-items-center rounded-openfmv-tool hover:bg-white/[0.08] hover:text-white" title={t('timeline.zoomOut')} aria-label={t('timeline.zoomOut')}>
              <ZoomOut size={15} />
            </button>
            <div className="relative h-8 w-24">
              <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/10">
                <div className="h-full rounded-full bg-sky-400" style={{ width: `${zoomSliderPosition * 100}%` }} />
              </div>
              <input
                type="range"
                min={0}
                max={1000}
                step={1}
                value={Math.round(zoomSliderPosition * 1000)}
                onChange={(event) => setZoom(timelineSliderToZoom(Number(event.target.value) / 1000))}
                className="absolute inset-0 h-8 w-full cursor-pointer appearance-none bg-transparent outline-none [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-white/60 [&::-moz-range-thumb]:bg-sky-300 [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white/60 [&::-webkit-slider-thumb]:bg-sky-300"
                title={t('timeline.zoom')}
                aria-label={t('timeline.zoom')}
              />
            </div>
            <button type="button" onClick={zoomIn} className="grid h-openfmv-tool w-openfmv-tool place-items-center rounded-openfmv-tool hover:bg-white/[0.08] hover:text-white" title={t('timeline.zoomIn')} aria-label={t('timeline.zoomIn')}>
              <ZoomIn size={15} />
            </button>
            <button type="button" onClick={fitTimelineToView} className="grid h-openfmv-tool w-openfmv-tool place-items-center rounded-openfmv-tool hover:bg-white/[0.08] hover:text-white" title={t('timeline.zoomFit')} aria-label={t('timeline.zoomFit')}>
              <Maximize2 size={15} />
            </button>
          </div>
        </div>

        <div className="grid h-[calc(100%-40px)] grid-cols-[112px_minmax(0,1fr)]">
          <div className="grid min-h-0 grid-rows-[36px_minmax(0,1fr)] border-r border-white/10">
            <div className="h-9 border-b border-white/10" />
            <div ref={timelineTrackHeadsScrollRef} data-node-timeline-track-heads-scroll onScroll={handleTrackHeadsScroll} className="min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex flex-col p-1.5" style={{ gap: TIMELINE_TRACK_GAP_PX }}>
                {timeline.tracks.map((track) => {
                  const Icon = getTrackIcon(track);
                  const VisibilityIcon = track.hidden ? EyeOff : Eye;
                  const AudioIcon = track.muted ? VolumeX : Volume2;
                  const LockIcon = track.locked ? Lock : Unlock;
                  const trackHeight = getRenderedTrackHeight(track);
                  const isCollapsed = track.collapsed === true;
                  const laneCount = getExpandedKeyframeLaneCountForTrack(track);
                  return (
                    <div
                      key={track.id}
                      data-node-timeline-track-head-id={track.id}
                      onContextMenu={(event) => handleTrackContextMenu(track, event, currentTime, { allowButtonTarget: true })}
                      onPointerDown={(event) => handleTrackReorderPointerDown(track, event)}
                      className={`flex cursor-grab items-center justify-end gap-1 rounded-openfmv-tool px-2 text-openfmv-sub transition active:cursor-grabbing ${track.hidden ? 'opacity-55' : ''} ${track.locked ? 'bg-white/[0.035]' : ''} ${trackReorder?.trackId === track.id ? 'bg-sky-400/12 text-sky-100' : ''}`}
                      style={{ height: trackHeight }}
                    >
                      {laneCount > 0 && (
                        <span className="mr-auto rounded-openfmv-tool border border-sky-300/20 bg-sky-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-sky-200">
                          {t('fields.keyframes')}
                        </span>
                      )}
                      <button type="button" onClick={() => updateTrack(track.id, { collapsed: !isCollapsed })} className="grid h-6 w-6 place-items-center rounded-openfmv-tool text-openfmv-muted transition hover:bg-white/[0.07] hover:text-white" title={isCollapsed ? t('timeline.toolbar.expandTrack') : t('timeline.toolbar.collapseTrack')} aria-label={isCollapsed ? t('timeline.toolbar.expandTrack') : t('timeline.toolbar.collapseTrack')}>
                        <ChevronDown size={14} className={`transition ${isCollapsed ? '-rotate-90' : ''}`} />
                      </button>
                      {canTimelineTrackHaveAudio(track) && (
                        <button type="button" onClick={() => updateTrack(track.id, { muted: !track.muted })} className="grid h-6 w-6 place-items-center rounded-openfmv-tool text-openfmv-muted transition hover:bg-white/[0.07] hover:text-white" title={track.muted ? t('timeline.toolbar.unmuteTrack') : t('timeline.toolbar.muteTrack')} aria-label={track.muted ? t('timeline.toolbar.unmuteTrack') : t('timeline.toolbar.muteTrack')}>
                          <AudioIcon size={14} className={track.muted ? 'text-red-300' : ''} />
                        </button>
                      )}
                      {canTimelineTrackBeHidden(track) && (
                        <button type="button" onClick={() => updateTrack(track.id, { hidden: !track.hidden })} className="grid h-6 w-6 place-items-center rounded-openfmv-tool text-openfmv-muted transition hover:bg-white/[0.07] hover:text-white" title={track.hidden ? t('timeline.toolbar.showTrack') : t('timeline.toolbar.hideTrack')} aria-label={track.hidden ? t('timeline.toolbar.showTrack') : t('timeline.toolbar.hideTrack')}>
                          <VisibilityIcon size={14} />
                        </button>
                      )}
                      <button type="button" onClick={() => updateTrack(track.id, { locked: !track.locked })} className="grid h-6 w-6 place-items-center rounded-openfmv-tool text-openfmv-muted transition hover:bg-white/[0.07] hover:text-white" title={track.locked ? t('timeline.toolbar.unlockTrack') : t('timeline.toolbar.lockTrack')} aria-label={track.locked ? t('timeline.toolbar.unlockTrack') : t('timeline.toolbar.lockTrack')}>
                        <LockIcon size={14} className={track.locked ? 'text-amber-200' : ''} />
                      </button>
                      <Icon size={16} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div ref={timelineScrollRef} data-node-timeline-scroll className="min-w-0 overflow-auto" onScroll={handleTimelineScroll} onWheel={handleTimelineWheel}>
            <div
              ref={timelineContentRef}
              data-node-timeline-canvas
              className="relative min-h-full min-w-full"
              style={{ width: timelineWidth }}
              onDragOver={handleTimelineCanvasDragOver}
              onDrop={handleTimelineCanvasDrop}
            >
              <div data-node-timeline-ruler onPointerDown={handleTimelineScrubPointerDown} className="sticky top-0 z-20 h-9 cursor-crosshair border-b border-white/10 bg-[#0b1018]">
                {ticks.map((tick) => (
                  <div key={`${tick.time}-${tick.label || 'tick'}`} className={`absolute top-0 ${tick.label ? 'h-full border-l border-white/10' : 'h-2 border-l border-white/12'}`} style={{ left: tick.time * zoom }}>
                    {tick.label && (
                      <span className="absolute left-1.5 top-1.5 rounded-[3px] bg-[#0b1018] px-1 font-mono text-[10px] leading-4 text-openfmv-sub shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
                        {tick.label}
                      </span>
                    )}
                  </div>
                ))}
                {timeline.bookmarks.map((bookmark) => (
                  <button
                    key={bookmark.id}
                    type="button"
                    data-node-timeline-bookmark-id={bookmark.id}
                    onPointerDown={(event) => handleBookmarkPointerDown(bookmark, event)}
                    onContextMenu={(event) => handleBookmarkContextMenu(bookmark, event)}
                    onClick={(event) => {
                      event.stopPropagation();
                      updateCurrentTime(bookmark.time);
                    }}
                    className="absolute top-1 z-30 -ml-2 grid h-7 w-4 cursor-grab place-items-center text-amber-200 transition hover:text-amber-100 active:cursor-grabbing"
                    style={{ left: bookmark.time * zoom }}
                    title={bookmark.label || t('timeline.markerAt', { time: bookmark.time.toFixed(2) })}
                    aria-label={bookmark.label || t('timeline.markerAt', { time: bookmark.time.toFixed(2) })}
                  >
                    <Bookmark size={14} fill="currentColor" />
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="absolute inset-x-0 top-9 z-0 h-[calc(100%-36px)] cursor-crosshair"
                onClick={handleTimelineGutterClick}
                aria-label={t('timeline.seekTimeline')}
              />

              <div className="relative z-10 flex flex-col p-1.5 pt-1" style={{ gap: TIMELINE_TRACK_GAP_PX }}>
                {timeline.tracks.map((track) => {
                  const baseTrackHeight = getNodeTimelineTrackHeight(track);
                  const trackHeight = getRenderedTrackHeight(track);
                  const clipHeight = track.collapsed ? TIMELINE_COLLAPSED_CLIP_HEIGHT_PX : TIMELINE_CLIP_HEIGHT_PX;
                  const clipTop = Math.max(0, (baseTrackHeight - clipHeight) / 2);
                  const emptyButtonTop = Math.max(0, (baseTrackHeight - TIMELINE_EMPTY_MEDIA_BUTTON_HEIGHT_PX) / 2);
                  return (
                  <div
                    key={track.id}
                    data-node-timeline-track-id={track.id}
                    className={`relative border border-white/[0.06] bg-white/[0.025] transition ${track.type === 'media' && draggedAssetId ? 'border-sky-300/30 bg-sky-400/[0.055]' : ''} ${track.type === 'interaction' && draggedInteractionType ? 'border-orange-300/30 bg-orange-400/[0.045]' : ''} ${dragTargetTrackId === track.id ? 'border-sky-300/45 bg-sky-400/[0.08]' : ''} ${track.hidden ? 'opacity-45' : ''} ${track.locked ? 'bg-white/[0.04]' : ''}`}
                    style={{ height: trackHeight }}
                    onContextMenu={(event) => handleTrackContextMenu(track, event)}
                    onDragOver={(event) => {
                      if (!canDropOnTimelineTrack(track, event)) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'copy';
                      startTimelineExternalDragScroll(event);
                      setDragTargetTrackId(track.id);
                      setNewTrackDropIndicator(null);
                    }}
                    onDragLeave={() => setDragTargetTrackId(null)}
                    onDrop={(event) => handleTimelineTrackDrop(track, event)}
                    onPointerDown={handleTimelineMarqueePointerDown}
                  >
                    {track.type === 'media' && track.clips.length === 0 && (
                      <button type="button" onClick={() => handleRequestMediaClip(track.id)} disabled={track.locked} className="absolute left-3 inline-flex h-7 items-center gap-2 rounded-openfmv-tool border border-dashed border-white/15 px-2 text-xs text-openfmv-muted hover:border-white/30 hover:text-white disabled:pointer-events-none disabled:opacity-40" style={{ top: emptyButtonTop }}>
                        <Plus size={13} />
                        {t('timeline.addMedia')}
                      </button>
                    )}
                    {track.clips.map((clip) => {
                      const left = clip.startTime * zoom;
                      const width = Math.max(34, clip.duration * zoom);
                      const selected = selectedClipIdSet.has(clip.id);
                      const MediaIcon = isMediaClip(clip) ? mediaIcons[clip.type] : null;
                      const InteractionIcon = isInteractionClip(clip) ? interactionIcons[clip.type] : null;
                      const keyframeLanes = expandedKeyframeClipIdSet.has(clip.id) ? getTimelineClipKeyframeLanes(clip) : [];
                      return (
                        <React.Fragment key={clip.id}>
                          <button
                            type="button"
                            data-node-timeline-clip-id={clip.id}
                            onPointerDown={(event) => handleTimelineClipPointerDown(clip, event, 'move')}
                            onContextMenu={(event) => handleClipContextMenu(clip, event)}
                            onClick={(event) => {
                              event.stopPropagation();
                              updateCurrentTime(clip.startTime);
                            }}
                            className={getClipTone(clip, selected)}
                            style={{ left, top: clipTop, width, height: clipHeight }}
                          >
                            {selected && !track.locked && (
                              <>
                                <span data-node-timeline-trim-handle="left" onPointerDown={(event) => handleTimelineClipPointerDown(clip, event, 'trim-left')} className="absolute inset-y-0 left-0 w-2 cursor-w-resize bg-white/20" />
                                <span data-node-timeline-trim-handle="right" onPointerDown={(event) => handleTimelineClipPointerDown(clip, event, 'trim-right')} className="absolute inset-y-0 right-0 w-2 cursor-e-resize bg-white/20" />
                              </>
                            )}
                            {isMediaClip(clip) && isVisualMediaClip(clip) && <MediaClipThumbnail clip={clip} />}
                            {isMediaClip(clip) && clip.type === 'audio' && (
                              <>
                                <AudioClipWaveform clip={clip} width={width} />
                                <AudioClipVolumeLine
                                  clip={clip}
                                  disabled={track.locked}
                                  onChangeStart={beginAudioClipVolumeDrag}
                                  onChange={updateAudioClipVolume}
                                  onChangeEnd={finishAudioClipVolumeDrag}
                                />
                              </>
                            )}
                            {selected && clip.keyframes && clip.keyframes.length > 0 && (
                              <TimelineClipKeyframeIndicators
                                clip={clip}
                                width={width}
                                zoom={zoom}
                              selectedKeyframeIds={selectedKeyframeIdSet}
                              onPointerDown={handleTimelineKeyframePointerDown}
                              onContextMenu={handleTimelineKeyframeContextMenu}
                              getLabel={(time) => t('timeline.keyframeAt', { time: time.toFixed(2) })}
                            />
                            )}
                            <span className="relative z-10 flex min-w-0 items-center gap-1.5 px-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
                              {MediaIcon && <MediaIcon size={13} />}
                              {InteractionIcon && <InteractionIcon size={13} />}
                              <span className="truncate">{getTimelineClipLabel(clip)}</span>
                            </span>
                          </button>
                          {keyframeLanes.length > 0 && (
                            <TimelineClipExpandedKeyframeLanes
                              clip={clip}
                              lanes={keyframeLanes}
                              top={baseTrackHeight + TIMELINE_KEYFRAME_LANES_GAP_PX}
                              width={width}
                              zoom={zoom}
                              selectedKeyframeIds={selectedKeyframeIdSet}
                              getPropertyLabel={(property) => getTimelineKeyframePropertyLabel(t, property)}
                              getKeyframeLabel={(time) => t('timeline.keyframeAt', { time: time.toFixed(2) })}
                              onPointerDown={handleTimelineKeyframePointerDown}
                              onContextMenu={handleTimelineKeyframeContextMenu}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                  );
                })}
              </div>

              {newTrackDropIndicator && (
                <div
                  aria-hidden="true"
                  data-node-timeline-new-track-drop-line
                  className="pointer-events-none absolute left-0 right-0 z-30 h-0.5 bg-sky-300 shadow-[0_0_0_1px_rgba(56,189,248,0.28),0_0_18px_rgba(56,189,248,0.5)]"
                  style={{ top: newTrackDropIndicator.top }}
                />
              )}

              {trackReorder?.hasMoved && (
                <div
                  aria-hidden="true"
                  data-node-timeline-track-reorder-line
                  className="pointer-events-none absolute left-0 right-0 z-30 h-0.5 bg-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.24),0_0_16px_rgba(255,255,255,0.32)]"
                  style={{ top: trackReorder.top }}
                />
              )}

              {currentSnapPoint && (
                <div className="pointer-events-none absolute bottom-0 top-0 z-30 w-px bg-orange-300" style={{ left: currentSnapPoint.time * zoom }} />
              )}
              <button
                type="button"
                data-node-timeline-playhead
                onPointerDown={handleTimelineScrubPointerDown}
                className="absolute bottom-0 top-0 z-40 -ml-2 w-4 cursor-col-resize"
                style={{ left: currentTime * zoom }}
                title={t('timeline.seekTimeline')}
                aria-label={t('timeline.seekTimeline')}
              >
                <span className="pointer-events-none absolute bottom-0 left-1/2 top-0 w-px bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" />
              </button>
              {marqueeRect && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute z-40 rounded-openfmv-tool border border-sky-300/80 bg-sky-400/14 shadow-[0_0_0_1px_rgba(2,132,199,0.22)]"
                  style={{
                    left: marqueeRect.left,
                    top: marqueeRect.top,
                    width: marqueeRect.width,
                    height: marqueeRect.height,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </section>
      </div>

      {timelineContextMenu && (
        <div
          data-node-timeline-context-menu
          className="fixed z-50 w-[220px] overflow-hidden rounded-openfmv-tool border border-white/10 bg-[#1b1b1b] p-1.5 text-sm text-openfmv-sub shadow-[0_20px_70px_rgba(0,0,0,0.45)]"
          style={{ left: timelineContextMenu.x, top: timelineContextMenu.y }}
        >
          {timelineContextMenu.kind === 'keyframe' ? (
            <>
              <ContextMenuButton icon={Diamond} label={t('timeline.context.seekToKeyframe')} onClick={() => runTimelineContextAction(() => updateCurrentTime(timelineContextMenu.time))} />
              <ContextMenuButton icon={Copy} label={t('timeline.context.copy')} disabled={!timelineContextMenu.keyframeIds?.length} onClick={() => runTimelineContextAction(copySelectedKeyframes)} />
              <ContextMenuButton
                icon={ClipboardPaste}
                label={t('timeline.context.paste')}
                disabled={!keyframeClipboard || !timelineContextMenu.clipId || contextMenuClipRef?.track.locked}
                onClick={() => runTimelineContextAction(() => pasteKeyframeClipboard(timelineContextMenu.clipId, timelineContextMenu.time))}
              />
              <div className="my-1 h-px bg-white/10" />
              <ContextMenuButton
                icon={SlidersHorizontal}
                label={t('timeline.context.linearKeyframes')}
                disabled={!timelineContextMenu.keyframeIds?.length || contextMenuClipRef?.track.locked}
                onClick={() => runTimelineContextAction(() => setContextKeyframesInterpolation('linear'))}
              />
              <ContextMenuButton
                icon={Pause}
                label={t('timeline.context.holdKeyframes')}
                disabled={!timelineContextMenu.keyframeIds?.length || contextMenuClipRef?.track.locked}
                onClick={() => runTimelineContextAction(() => setContextKeyframesInterpolation('hold'))}
              />
              <div className="my-1 h-px bg-white/10" />
              <ContextMenuButton icon={Trash2} label={t('timeline.context.deleteKeyframe')} disabled={!timelineContextMenu.keyframeIds?.length} danger onClick={() => runTimelineContextAction(deleteContextKeyframes)} />
            </>
          ) : timelineContextMenu.kind === 'clip' ? (
            <>
              <ContextMenuButton icon={Copy} label={t('timeline.context.copy')} disabled={selectedClipRefs.length === 0} onClick={() => runTimelineContextAction(copySelectedClip)} />
              <ContextMenuButton icon={Scissors} label={t('timeline.context.cut')} disabled={selectedEditableClipIds.length === 0} onClick={() => runTimelineContextAction(cutSelectedClip)} />
              <ContextMenuButton icon={ClipboardPaste} label={t('timeline.context.paste')} disabled={!clipClipboard} onClick={() => runTimelineContextAction(() => pasteClipboardClipAtTime(timelineContextMenu.time))} />
              <ContextMenuButton icon={Copy} label={t('timeline.context.duplicate')} disabled={selectedEditableClipIds.length === 0} onClick={() => runTimelineContextAction(duplicateSelectedClip)} />
              <ContextMenuButton icon={hasLinkedEditableClip ? Unlink2 : LinkIcon} label={hasLinkedEditableClip ? t('timeline.context.unlink') : t('timeline.context.link')} disabled={!canToggleSelectedClipLink} onClick={() => runTimelineContextAction(toggleSelectedClipLink)} />
              <ContextMenuButton icon={Scissors} label={t('timeline.context.split')} disabled={!canSplitContextClip} onClick={() => runTimelineContextAction(() => splitSelectedClipAtTime(timelineContextMenu.time, 'both', contextMenuClipRef ? [contextMenuClipRef.clip.id] : undefined))} />
              <ContextMenuButton icon={AlignLeft} label={t('timeline.context.splitLeft')} disabled={!canSplitContextClip} onClick={() => runTimelineContextAction(() => splitSelectedClipAtTime(timelineContextMenu.time, 'right', contextMenuClipRef ? [contextMenuClipRef.clip.id] : undefined))} />
              <ContextMenuButton icon={AlignRight} label={t('timeline.context.splitRight')} disabled={!canSplitContextClip} onClick={() => runTimelineContextAction(() => splitSelectedClipAtTime(timelineContextMenu.time, 'left', contextMenuClipRef ? [contextMenuClipRef.clip.id] : undefined))} />
              <ContextMenuButton icon={hasDisabledEditableClip ? Eye : EyeOff} label={hasDisabledEditableClip ? t('timeline.context.enableClips') : t('timeline.context.disableClips')} disabled={selectedEditableClipIds.length === 0} onClick={() => runTimelineContextAction(() => setSelectedClipsEnabled(hasDisabledEditableClip))} />
              <ContextMenuButton icon={hasHiddenEditableClip ? Eye : EyeOff} label={hasHiddenEditableClip ? t('timeline.context.showClips') : t('timeline.context.hideClips')} disabled={selectedEditableClipIds.length === 0} onClick={() => runTimelineContextAction(() => setSelectedClipsHidden(!hasHiddenEditableClip))} />
              <ContextMenuButton icon={hasMutedEditableClip ? Volume2 : VolumeX} label={hasMutedEditableClip ? t('timeline.context.unmuteClips') : t('timeline.context.muteClips')} disabled={selectedEditableAudibleClipIds.length === 0} onClick={() => runTimelineContextAction(() => setSelectedClipsMuted(!hasMutedEditableClip))} />
              <ContextMenuButton icon={Headphones} label={contextSourceAudioLabel} disabled={!canToggleContextSourceAudio} onClick={() => runTimelineContextAction(() => toggleSourceAudioForClip(contextMenuClipRef?.clip.id))} />
              <ContextMenuButton icon={Snowflake} label={t('timeline.context.freeze')} disabled={!canFreezeContextClip} onClick={() => runTimelineContextAction(() => freezeVideoClipAtTime(contextMenuClipRef?.clip.id, timelineContextMenu.time))} />
              {contextMenuClipRef?.clip.keyframes?.length ? (
                <ContextMenuButton
                  icon={Diamond}
                  label={expandedKeyframeClipIdSet.has(contextMenuClipRef.clip.id) ? t('timeline.context.collapseKeyframes') : t('timeline.context.expandKeyframes')}
                  onClick={() => runTimelineContextAction(() => toggleKeyframeLanesForClip(contextMenuClipRef.clip.id))}
                />
              ) : null}
              <ContextMenuButton icon={Bookmark} label={contextMenuBookmark ? t('timeline.context.removeMarker') : t('timeline.context.addMarker')} onClick={() => runTimelineContextAction(() => toggleBookmarkAtTime(timelineContextMenu.time))} />
              <div className="my-1 h-px bg-white/10" />
              <ContextMenuButton icon={Trash2} label={t('timeline.context.delete')} disabled={selectedEditableClipIds.length === 0} danger onClick={() => runTimelineContextAction(deleteSelectedClip)} />
            </>
          ) : (
            <>
              <ContextMenuButton icon={ClipboardPaste} label={t('timeline.context.paste')} disabled={!clipClipboard} onClick={() => runTimelineContextAction(() => pasteClipboardClipAtTime(timelineContextMenu.time))} />
              <ContextMenuButton icon={Bookmark} label={contextMenuBookmark ? t('timeline.context.removeMarker') : t('timeline.context.addMarker')} onClick={() => runTimelineContextAction(() => toggleBookmarkAtTime(timelineContextMenu.time))} />
              {timelineContextMenu.trackType === 'media' && (
                <ContextMenuButton icon={Upload} label={t('timeline.context.addMedia')} disabled={contextMenuTrack?.locked} onClick={() => runTimelineContextAction(() => handleRequestMediaClip(timelineContextMenu.trackId, timelineContextMenu.time))} />
              )}
              {timelineContextMenu.trackType === 'interaction' && (
                <>
                  <div className="my-1 h-px bg-white/10" />
                  <ContextMenuButton
                    icon={interactionIcons.button}
                    label={t('clipTypes.button')}
                    disabled={contextMenuTrack?.locked}
                    onClick={() => runTimelineContextAction(() => addInteractionClipAtTime('button', timelineContextMenu.time, timelineContextMenu.trackId))}
                  />
                </>
              )}
              {contextMenuTrack && (
                <>
                  <div className="my-1 h-px bg-white/10" />
                  {canTimelineTrackHaveAudio(contextMenuTrack) && (
                    <ContextMenuButton
                      icon={contextMenuTrack.muted ? Volume2 : VolumeX}
                      label={contextMenuTrack.muted ? t('timeline.toolbar.unmuteTrack') : t('timeline.toolbar.muteTrack')}
                      onClick={() => runTimelineContextAction(() => updateTrack(contextMenuTrack.id, { muted: !contextMenuTrack.muted }))}
                    />
                  )}
                  {canTimelineTrackBeHidden(contextMenuTrack) && (
                    <ContextMenuButton
                      icon={contextMenuTrack.hidden ? Eye : EyeOff}
                      label={contextMenuTrack.hidden ? t('timeline.toolbar.showTrack') : t('timeline.toolbar.hideTrack')}
                      onClick={() => runTimelineContextAction(() => updateTrack(contextMenuTrack.id, { hidden: !contextMenuTrack.hidden }))}
                    />
                  )}
                  <ContextMenuButton
                    icon={contextMenuTrack.locked ? Unlock : Lock}
                    label={contextMenuTrack.locked ? t('timeline.toolbar.unlockTrack') : t('timeline.toolbar.lockTrack')}
                    onClick={() => runTimelineContextAction(() => updateTrack(contextMenuTrack.id, { locked: !contextMenuTrack.locked }))}
                  />
                  <ContextMenuButton
                    icon={ChevronDown}
                    label={contextMenuTrack.collapsed ? t('timeline.toolbar.expandTrack') : t('timeline.toolbar.collapseTrack')}
                    onClick={() => runTimelineContextAction(() => updateTrack(contextMenuTrack.id, { collapsed: !contextMenuTrack.collapsed }))}
                  />
                  <ContextMenuButton
                    icon={Plus}
                    label={t('timeline.toolbar.addTrack')}
                    onClick={() => runTimelineContextAction(() => addTrackAfter(contextMenuTrack))}
                  />
                  <ContextMenuButton
                    icon={ArrowUp}
                    label={t('timeline.toolbar.moveTrackUp')}
                    disabled={!canMoveContextTrackUp}
                    onClick={() => runTimelineContextAction(() => moveTrack(contextMenuTrack.id, 'up'))}
                  />
                  <ContextMenuButton
                    icon={ArrowDown}
                    label={t('timeline.toolbar.moveTrackDown')}
                    disabled={!canMoveContextTrackDown}
                    onClick={() => runTimelineContextAction(() => moveTrack(contextMenuTrack.id, 'down'))}
                  />
                  {canDeleteContextTrack && (
                    <>
                      <div className="my-1 h-px bg-white/10" />
                      <ContextMenuButton
                        icon={Trash2}
                        label={t('timeline.context.deleteTrack')}
                        danger
                        onClick={() => runTimelineContextAction(() => deleteTrack(contextMenuTrack.id))}
                      />
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

function TimelineClipKeyframeIndicators({
  clip,
  width,
  zoom,
  selectedKeyframeIds,
  onPointerDown,
  onContextMenu,
  getLabel,
}: {
  clip: TimelineClip;
  width: number;
  zoom: number;
  selectedKeyframeIds: Set<string>;
  onPointerDown: (clip: TimelineClip, keyframes: TimelineClipKeyframe[], event: React.PointerEvent<HTMLElement>) => void;
  onContextMenu: (clip: TimelineClip, keyframes: TimelineClipKeyframe[], event: React.MouseEvent<HTMLElement>) => void;
  getLabel: (time: number) => string;
}) {
  if (width < TIMELINE_KEYFRAME_INDICATOR_MIN_WIDTH_PX || !clip.keyframes?.length) return null;

  const indicators = Array.from(
    clip.keyframes.reduce((map, keyframe) => {
      const indicatorTime = roundTimelineTime(keyframe.time);
      map.set(indicatorTime, [...(map.get(indicatorTime) || []), keyframe]);
      return map;
    }, new Map<number, TimelineClipKeyframe[]>())
  ).sort(([firstTime], [secondTime]) => firstTime - secondTime);

  return (
    <span className="pointer-events-none absolute inset-x-1 top-1/2 z-20 block h-0">
      {indicators.map(([localTime, keyframes]) => {
        const key = keyframes.map((keyframe) => keyframe.id).join(':');
        const selected = keyframes.some((keyframe) => selectedKeyframeIds.has(keyframe.id));
        const time = clampTimelineTime(clip.startTime + localTime, clip.startTime + clip.duration);
        return (
          <span
            key={key}
            data-node-timeline-keyframe-id={key}
            className={`pointer-events-auto absolute top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 cursor-grab rounded-[2px] border shadow-[0_1px_5px_rgba(0,0,0,0.45)] transition active:cursor-grabbing ${
              selected
                ? 'border-sky-100 bg-sky-300'
                : 'border-white/70 bg-white/90 hover:border-sky-100 hover:bg-sky-200'
            }`}
            style={{ left: Math.max(4, Math.min(width - 4, localTime * zoom)) }}
            onPointerDown={(event) => onPointerDown(clip, keyframes, event)}
            onContextMenu={(event) => onContextMenu(clip, keyframes, event)}
            title={getLabel(time)}
            aria-label={getLabel(time)}
          />
        );
      })}
    </span>
  );
}

function TimelineClipExpandedKeyframeLanes({
  clip,
  lanes,
  top,
  width,
  zoom,
  selectedKeyframeIds,
  getPropertyLabel,
  getKeyframeLabel,
  onPointerDown,
  onContextMenu,
}: {
  clip: TimelineClip;
  lanes: Array<{ property: TimelineKeyframeProperty; keyframes: TimelineClipKeyframe[] }>;
  top: number;
  width: number;
  zoom: number;
  selectedKeyframeIds: Set<string>;
  getPropertyLabel: (property: TimelineKeyframeProperty) => string;
  getKeyframeLabel: (time: number) => string;
  onPointerDown: (clip: TimelineClip, keyframes: TimelineClipKeyframe[], event: React.PointerEvent<HTMLElement>) => void;
  onContextMenu: (clip: TimelineClip, keyframes: TimelineClipKeyframe[], event: React.MouseEvent<HTMLElement>) => void;
}) {
  return (
    <div
      data-node-timeline-keyframe-lanes={clip.id}
      className="absolute z-10 overflow-visible"
      style={{ left: clip.startTime * zoom, top, width }}
    >
      {lanes.map((lane, index) => (
        <div
          key={lane.property}
          data-node-timeline-keyframe-lane={lane.property}
          className="absolute left-0 rounded-openfmv-tool border border-sky-300/12 bg-sky-400/[0.045]"
          style={{
            top: index * TIMELINE_KEYFRAME_LANE_HEIGHT_PX,
            width,
            height: TIMELINE_KEYFRAME_LANE_HEIGHT_PX - 3,
          }}
        >
          <span className="pointer-events-none absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded bg-black/45 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-sky-100/90">
            {getPropertyLabel(lane.property)}
          </span>
          {lane.keyframes.map((keyframe) => {
            const selected = selectedKeyframeIds.has(keyframe.id);
            const time = clampTimelineTime(clip.startTime + keyframe.time, clip.startTime + clip.duration);
            return (
              <span
                key={keyframe.id}
                data-node-timeline-keyframe-id={keyframe.id}
                data-node-timeline-expanded-keyframe-id={keyframe.id}
                className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 cursor-grab rounded-[2px] border shadow-[0_1px_5px_rgba(0,0,0,0.45)] transition active:cursor-grabbing ${
                  selected
                    ? 'border-sky-100 bg-sky-300'
                    : 'border-white/65 bg-white/90 hover:border-sky-100 hover:bg-sky-200'
                }`}
                style={{ left: Math.max(4, Math.min(width - 4, keyframe.time * zoom)) }}
                onPointerDown={(event) => onPointerDown(clip, [keyframe], event)}
                onContextMenu={(event) => onContextMenu(clip, [keyframe], event)}
                title={getKeyframeLabel(time)}
                aria-label={getKeyframeLabel(time)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ContextMenuButton({
  icon: Icon,
  label,
  disabled,
  danger,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-openfmv-tool w-full items-center gap-2 rounded-openfmv-tool px-2 text-left transition hover:bg-white/[0.07] hover:text-white disabled:pointer-events-none disabled:opacity-35 ${danger ? 'text-red-200 hover:bg-red-500/12' : ''}`}
    >
      <Icon size={14} />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

function AssetLibraryPreview({ asset }: { asset: OpenFMVAsset }) {
  const src = useResolvedMediaSrc(getAssetSource(asset));
  const poster = useResolvedMediaSrc(getTimelineMediaAssetPoster(asset.metadata));
  const Icon = mediaIcons[asset.type as TimelineMediaClipType] || Film;

  if (asset.type === 'image') return <img src={src} alt={asset.name} className="h-full w-full object-cover" />;
  if (asset.type === 'video') {
    if (poster) return <img src={poster} alt={asset.name} className="h-full w-full object-cover" />;
    return <video src={src} className="h-full w-full object-cover" muted playsInline preload="metadata" />;
  }
  return <Icon size={18} />;
}

function MediaClipThumbnail({ clip }: { clip: TimelineMediaClip }) {
  const resolvedSrc = useResolvedMediaSrc(clip.src);
  const resolvedPoster = useResolvedMediaSrc(clip.poster);

  if (clip.type === 'image') {
    return (
      <span aria-hidden="true" data-node-media-thumbnail className="pointer-events-none absolute inset-0 z-0">
        {resolvedSrc && <img src={resolvedSrc} alt="" className="h-full w-full object-cover opacity-70" />}
        <span className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-black/45" />
      </span>
    );
  }

  if (clip.type === 'video') {
    return (
      <span aria-hidden="true" data-node-media-thumbnail className="pointer-events-none absolute inset-0 z-0">
        {resolvedPoster ? (
          <img src={resolvedPoster} alt="" className="h-full w-full object-cover opacity-70" />
        ) : resolvedSrc ? (
          <video src={resolvedSrc} className="h-full w-full object-cover opacity-65" muted playsInline preload="metadata" />
        ) : null}
        <span className="absolute inset-0 bg-gradient-to-r from-black/72 via-black/24 to-black/48" />
      </span>
    );
  }

  return null;
}

function AudioClipWaveform({
  clip,
  width,
}: {
  clip: TimelineMediaClip;
  width: number;
}) {
  const resolvedSrc = useResolvedMediaSrc(clip.src);
  const barCount = useMemo(() => Math.max(10, Math.min(MAX_AUDIO_WAVEFORM_BARS, Math.floor(width / 3))), [width]);
  const placeholderPeaks = useMemo(() => buildAudioWaveformPlaceholder(barCount), [barCount]);
  const [peaks, setPeaks] = useState<number[] | null>(null);

  useEffect(() => {
    let isCancelled = false;
    setPeaks(null);

    if (!resolvedSrc || typeof window === 'undefined') {
      return () => {
        isCancelled = true;
      };
    }

    void getDecodedAudioBuffer(resolvedSrc)
      .then((buffer) => {
        const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
        const nextPeaks = buildAudioWaveformPeaks({
          channels,
          sampleRate: buffer.sampleRate,
          sourceStartSec: clip.sourceStart || 0,
          durationSec: clip.duration,
          barCount,
        });
        if (!isCancelled) setPeaks(nextPeaks);
      })
      .catch(() => {
        if (!isCancelled) setPeaks([]);
      });

    return () => {
      isCancelled = true;
    };
  }, [barCount, clip.duration, clip.sourceStart, resolvedSrc]);

  const visiblePeaks = peaks && peaks.length > 0 ? peaks : placeholderPeaks;
  const isLoaded = Boolean(peaks && peaks.length > 0);

  return (
    <span
      aria-hidden="true"
      data-node-audio-waveform
      className={`pointer-events-none absolute inset-x-1 bottom-1 top-1 z-0 flex items-center gap-px ${isLoaded ? 'opacity-75' : 'opacity-30'}`}
    >
      {visiblePeaks.map((peak, index) => {
        const height = peak > 0 ? Math.max(7, Math.min(100, peak * 100)) : 4;
        return <span key={index} className="min-w-px flex-1 rounded-full bg-fuchsia-50/75" style={{ height: `${height}%` }} />;
      })}
    </span>
  );
}

function AudioClipVolumeLine({
  clip,
  disabled,
  onChangeStart,
  onChange,
  onChangeEnd,
}: {
  clip: TimelineMediaClip;
  disabled?: boolean;
  onChangeStart: (clipId: string) => void;
  onChange: (clipId: string, volume: number) => void;
  onChangeEnd: () => void;
}) {
  const surfaceRef = useRef<HTMLSpanElement>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const volume = clampTimelineAudioVolume(clip.volume);
  const lineTop = getAudioVolumeLineTop(volume);
  const volumeLabel = getAudioVolumeLabel(volume);

  const getVolumeFromPointer = useCallback((clientY: number) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return volume;
    const offset = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const nextVolume = rect.height <= 0 ? volume : (1 - offset / rect.height) * 2;
    return roundTimelineAudioVolume(nextVolume);
  }, [volume]);

  const updateFromPointer = useCallback((clientY: number) => {
    onChange(clip.id, getVolumeFromPointer(clientY));
  }, [clip.id, getVolumeFromPointer, onChange]);

  const finishDrag = useCallback(() => {
    activePointerIdRef.current = null;
    setIsDragging(false);
    onChangeEnd();
  }, [onChangeEnd]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLSpanElement>) => {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    activePointerIdRef.current = event.pointerId;
    setIsDragging(true);
    onChangeStart(clip.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event.clientY);
  }, [clip.id, disabled, onChangeStart, updateFromPointer]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLSpanElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    updateFromPointer(event.clientY);
  }, [updateFromPointer]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLSpanElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    finishDrag();
  }, [finishDrag]);

  const handlePointerCancel = useCallback((event: React.PointerEvent<HTMLSpanElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    finishDrag();
  }, [finishDrag]);

  const handleLostPointerCapture = useCallback(() => {
    if (activePointerIdRef.current === null) return;
    finishDrag();
  }, [finishDrag]);

  return (
    <span ref={surfaceRef} aria-hidden="true" data-node-audio-volume-line className="pointer-events-none absolute inset-x-1 bottom-1 top-1 z-20">
      <span className={`pointer-events-none absolute inset-x-0 -translate-y-1/2 border-t transition ${isDragging ? 'border-white' : 'border-white/55 group-hover:border-white/85'}`} style={{ top: lineTop }} />
      <span
        data-node-audio-volume-handle
        className={`absolute inset-x-0 -translate-y-1/2 touch-none cursor-ns-resize ${disabled ? 'pointer-events-none opacity-40' : 'pointer-events-auto'}`}
        style={{ top: lineTop, height: AUDIO_VOLUME_LINE_HIT_AREA_PX }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handleLostPointerCapture}
      />
      {isDragging && (
        <span className="pointer-events-none absolute right-1 top-1 rounded-openfmv-tool bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.38)]">
          {volumeLabel}
        </span>
      )}
    </span>
  );
}

function KeyframedNumberField({
  clip,
  currentTime,
  property,
  label,
  value,
  step,
  disabled,
  onBaseChange,
  onAddKeyframes,
  onRemoveKeyframes,
}: {
  clip: TimelineClip;
  currentTime: number;
  property: TimelineKeyframeProperty;
  label: string;
  value: number;
  step: number;
  disabled?: boolean;
  onBaseChange: (value: number) => void;
  onAddKeyframes: (keyframes: Array<{ property: TimelineKeyframeProperty; value: number }>) => void;
  onRemoveKeyframes: (keyframeIds: string[]) => void;
}) {
  const keyframes = (clip.keyframes || []).filter((keyframe) => keyframe.property === property);
  const localTime = getTimelineClipLocalTime(clip, currentTime);
  const isWithinClip = currentTime >= clip.startTime && currentTime <= getClipEndTime(clip);
  const activeKeyframe = isWithinClip
    ? keyframes.find((keyframe) => Math.abs(keyframe.time - localTime) <= 0.01) ?? null
    : null;
  const hasAnimatedKeyframes = keyframes.length > 0;
  const isToggleDisabled = disabled || !isWithinClip;

  const toggleKeyframe = () => {
    if (isToggleDisabled) return;
    if (activeKeyframe) {
      onRemoveKeyframes([activeKeyframe.id]);
      return;
    }
    onAddKeyframes([{ property, value }]);
  };

  return (
    <NumberField
      label={label}
      value={value}
      step={step}
      disabled={disabled}
      beforeLabel={(
        <button
          type="button"
          onClick={toggleKeyframe}
          disabled={isToggleDisabled}
          aria-pressed={Boolean(activeKeyframe)}
          className={`grid h-5 w-5 place-items-center rounded-openfmv-tool transition hover:bg-white/[0.08] disabled:opacity-35 ${activeKeyframe ? 'text-sky-300' : hasAnimatedKeyframes ? 'text-sky-200/70' : 'text-openfmv-muted'}`}
          title={label}
          aria-label={label}
        >
          <Diamond size={12} className={activeKeyframe ? 'fill-current' : ''} />
        </button>
      )}
      onChange={(nextValue) => {
        if (hasAnimatedKeyframes && isWithinClip) {
          onAddKeyframes([{ property, value: nextValue }]);
          return;
        }
        onBaseChange(nextValue);
      }}
    />
  );
}

function VideoClipSizeInspector({
  t,
  clip,
  onUpdate,
}: {
  t: NodeTimelineTranslator;
  clip: TimelineMediaClip;
  onUpdate: (update: (clip: TimelineMediaClip) => TimelineMediaClip) => void;
}) {
  const rect = getMediaClipRect(clip);
  const updateRect = (key: keyof OverlayRect, value: number) => {
    onUpdate((item) => ({ ...item, rect: clampOverlayRect({ ...getMediaClipRect(item), [key]: value }) }));
  };

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-xs font-semibold text-openfmv-muted">{t('fields.fit')}</span>
        <select value={clip.fit || 'contain'} onChange={(event) => onUpdate((item) => ({ ...item, fit: event.target.value === 'cover' ? 'cover' : 'contain' }))} className="openfmv-dark-select h-openfmv-control w-full rounded-openfmv-tool border border-white/12 bg-white/[0.075] px-3 text-sm text-white outline-none focus:border-white/30">
          <option value="contain">{t('fields.fitContain')}</option>
          <option value="cover">{t('fields.fitCover')}</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label={t('fields.x')} value={Number(rect.x.toFixed(2))} step={0.01} onChange={(value) => updateRect('x', value)} />
        <NumberField label={t('fields.y')} value={Number(rect.y.toFixed(2))} step={0.01} onChange={(value) => updateRect('y', value)} />
        <NumberField label={t('fields.width')} value={Number(rect.width.toFixed(2))} step={0.01} onChange={(value) => updateRect('width', value)} />
        <NumberField label={t('fields.height')} value={Number(rect.height.toFixed(2))} step={0.01} onChange={(value) => updateRect('height', value)} />
      </div>
    </div>
  );
}

function MediaClipInspector({
  t,
  clip,
  currentTime,
  onUpdate,
  onAddKeyframes,
  onRemoveKeyframes,
  onDelete,
}: {
  t: NodeTimelineTranslator;
  clip: TimelineMediaClip;
  currentTime: number;
  onUpdate: (update: (clip: TimelineMediaClip) => TimelineMediaClip) => void;
  onAddKeyframes: (keyframes: Array<{ property: TimelineKeyframeProperty; value: number }>) => void;
  onRemoveKeyframes: (keyframeIds: string[]) => void;
  onDelete: () => void;
}) {
  if (clip.type === 'video') {
    return <VideoClipSizeInspector t={t} clip={clip} onUpdate={onUpdate} />;
  }

  const playbackRate = getTimelineMediaPlaybackRate(clip);
  const sourceStart = Math.max(0, clip.sourceStart || 0);
  const sourceDuration = Math.max(0, clip.sourceDuration ?? roundTimelineTime(clip.duration * playbackRate));
  const sourceOut = roundTimelineTime(sourceStart + sourceDuration);

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-xs font-semibold text-openfmv-muted">{t('fields.name')}</span>
        <input value={clip.name || ''} onChange={(event) => onUpdate((item) => ({ ...item, name: event.target.value }))} className="h-openfmv-control w-full rounded-openfmv-tool border border-white/12 bg-white/[0.075] px-3 text-sm text-white outline-none focus:border-white/30" />
      </label>
      <label className="flex h-openfmv-control items-center justify-between rounded-openfmv-tool border border-white/10 bg-white/[0.055] px-3 text-sm text-openfmv-sub">
        {t('fields.enabled')}
        <input type="checkbox" checked={clip.enabled !== false} onChange={(event) => onUpdate((item) => ({ ...item, enabled: event.target.checked }))} className="h-4 w-4 accent-sky-500" />
      </label>
      <label className="flex h-openfmv-control items-center justify-between rounded-openfmv-tool border border-white/10 bg-white/[0.055] px-3 text-sm text-openfmv-sub">
        {t('fields.hidden')}
        <input type="checkbox" checked={clip.hidden === true} onChange={(event) => onUpdate((item) => ({ ...item, hidden: event.target.checked }))} className="h-4 w-4 accent-sky-500" />
      </label>
      {canTimelineClipHaveAudio(clip) && (
        <label className="flex h-openfmv-control items-center justify-between rounded-openfmv-tool border border-white/10 bg-white/[0.055] px-3 text-sm text-openfmv-sub">
          {t('fields.muted')}
          <input type="checkbox" checked={clip.muted === true} onChange={(event) => onUpdate((item) => ({ ...item, muted: event.target.checked }))} className="h-4 w-4 accent-fuchsia-500" />
        </label>
      )}
      {canTimelineClipHaveAudio(clip) && (
        <label className="flex h-openfmv-control items-center justify-between rounded-openfmv-tool border border-white/10 bg-white/[0.055] px-3 text-sm text-openfmv-sub">
          {t('fields.preservePitch')}
          <input type="checkbox" checked={clip.preservePitch !== false} onChange={(event) => onUpdate((item) => ({ ...item, preservePitch: event.target.checked }))} className="h-4 w-4 accent-fuchsia-500" />
        </label>
      )}
      <div className="grid grid-cols-2 gap-2">
        <NumberField label={t('fields.start')} value={clip.startTime} step={0.1} onChange={(value) => onUpdate((item) => ({ ...item, startTime: Math.max(0, value) }))} />
        <NumberField label={t('fields.duration')} value={clip.duration} step={0.1} onChange={(value) => onUpdate((item) => ({ ...item, duration: Math.max(0.1, value) }))} />
        <NumberField label={t('fields.sourceIn')} value={clip.sourceStart || 0} step={0.1} onChange={(value) => onUpdate((item) => ({ ...item, sourceStart: Math.max(0, value) }))} />
        <NumberField label={t('fields.sourceDuration')} value={sourceDuration} step={0.1} onChange={(value) => onUpdate((item) => ({ ...item, sourceDuration: Math.max(0, value) }))} />
        <NumberField label={t('fields.sourceOut')} value={sourceOut} step={0.1} onChange={(value) => onUpdate((item) => ({ ...item, sourceDuration: Math.max(0, roundTimelineTime(value - Math.max(0, item.sourceStart || 0))) }))} />
        <KeyframedNumberField clip={clip} currentTime={currentTime} property="opacity" label={t('fields.opacity')} value={getTimelineClipOpacity(clip)} step={0.05} onBaseChange={(value) => onUpdate((item) => ({ ...item, opacity: clampTimelineClipOpacity(value) }))} onAddKeyframes={onAddKeyframes} onRemoveKeyframes={onRemoveKeyframes} />
        <KeyframedNumberField clip={clip} currentTime={currentTime} property="rotation" label={t('fields.rotation')} value={getTimelineClipRotation(clip)} step={1} onBaseChange={(value) => onUpdate((item) => ({ ...item, rotation: clampTimelineClipRotation(value) }))} onAddKeyframes={onAddKeyframes} onRemoveKeyframes={onRemoveKeyframes} />
        {canTimelineClipHaveAudio(clip) && (
          <NumberField label={t('fields.speed')} value={getTimelineMediaPlaybackRate(clip)} step={0.01} onChange={(value) => onUpdate((item) => ({ ...item, playbackRate: clampTimelineMediaPlaybackRate(value) }))} />
        )}
        <KeyframedNumberField clip={clip} currentTime={currentTime} property="volume" label={t('fields.volume')} value={clip.volume ?? 1} step={0.05} disabled={clip.type !== 'audio'} onBaseChange={(value) => onUpdate((item) => ({ ...item, volume: Math.max(0, Math.min(2, value)) }))} onAddKeyframes={onAddKeyframes} onRemoveKeyframes={onRemoveKeyframes} />
      </div>
      {isVisualMediaClip(clip) && (
        <>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-openfmv-muted">{t('fields.fit')}</span>
            <select value={clip.fit || 'contain'} onChange={(event) => onUpdate((item) => ({ ...item, fit: event.target.value === 'cover' ? 'cover' : 'contain' }))} className="openfmv-dark-select h-openfmv-control w-full rounded-openfmv-tool border border-white/12 bg-white/[0.075] px-3 text-sm text-white outline-none focus:border-white/30">
              <option value="contain">{t('fields.fitContain')}</option>
              <option value="cover">{t('fields.fitCover')}</option>
            </select>
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(['x', 'y', 'width', 'height'] as const).map((key) => (
              <KeyframedNumberField key={key} clip={clip} currentTime={currentTime} property={key} label={key} value={Number(getMediaClipRect(clip)[key].toFixed(2))} step={0.01} onBaseChange={(value) => onUpdate((item) => ({ ...item, rect: clampOverlayRect({ ...getMediaClipRect(item), [key]: value }) }))} onAddKeyframes={onAddKeyframes} onRemoveKeyframes={onRemoveKeyframes} />
            ))}
          </div>
        </>
      )}
      <div className="rounded-openfmv-tool border border-white/10 bg-white/[0.035] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-xs font-semibold text-white">{t('fields.keyframes')}</div>
          <div className="text-[10px] font-mono text-openfmv-muted">{t('fields.keyframeCount', { count: clip.keyframes?.length ?? 0 })}</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onAddKeyframes([{ property: 'opacity', value: getTimelineClipOpacity(clip) }])} className="h-openfmv-tool rounded-openfmv-tool border border-white/10 bg-white/[0.06] px-2 text-xs font-semibold text-openfmv-sub transition hover:bg-white/[0.10] hover:text-white">
            {t('fields.addOpacityKeyframe')}
          </button>
          <button type="button" onClick={() => onAddKeyframes([{ property: 'rotation', value: getTimelineClipRotation(clip) }])} className="h-openfmv-tool rounded-openfmv-tool border border-white/10 bg-white/[0.06] px-2 text-xs font-semibold text-openfmv-sub transition hover:bg-white/[0.10] hover:text-white">
            {t('fields.addRotationKeyframe')}
          </button>
          {isVisualMediaClip(clip) && (
            <button type="button" onClick={() => {
              const rect = getMediaClipRect(clip);
              onAddKeyframes([
                { property: 'x', value: rect.x },
                { property: 'y', value: rect.y },
                { property: 'width', value: rect.width },
                { property: 'height', value: rect.height },
              ]);
            }} className="h-openfmv-tool rounded-openfmv-tool border border-white/10 bg-white/[0.06] px-2 text-xs font-semibold text-openfmv-sub transition hover:bg-white/[0.10] hover:text-white">
              {t('fields.addPositionKeyframe')}
            </button>
          )}
          {clip.type === 'audio' && (
            <button type="button" onClick={() => onAddKeyframes([{ property: 'volume', value: clip.volume ?? 1 }])} className="h-openfmv-tool rounded-openfmv-tool border border-white/10 bg-white/[0.06] px-2 text-xs font-semibold text-openfmv-sub transition hover:bg-white/[0.10] hover:text-white">
              {t('fields.addVolumeKeyframe')}
            </button>
          )}
        </div>
      </div>
      <label className="block">
        <span className="mb-2 block text-xs font-semibold text-openfmv-muted">{t('fields.source')}</span>
        <input value={clip.src} onChange={(event) => onUpdate((item) => ({ ...item, src: event.target.value }))} className="h-openfmv-control w-full rounded-openfmv-tool border border-white/12 bg-white/[0.075] px-3 text-sm text-white outline-none focus:border-white/30" />
      </label>
      <button type="button" onClick={onDelete} className="inline-flex h-openfmv-control w-full items-center justify-center gap-2 rounded-openfmv-tool border border-red-400/20 bg-red-500/8 px-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/14">
        <Trash2 size={15} />
        {t('actions.deleteClip')}
      </button>
    </div>
  );
}

function InspectorFieldRow({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-2 py-1.5">
      <div className="grid h-7 w-7 place-items-center rounded-openfmv-tool text-openfmv-muted" title={label} aria-label={label}>
        {Icon && <Icon size={14} />}
        <span className="sr-only">{label}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function InspectorDivider() {
  return <div className="my-1.5 border-t border-white/10" />;
}

function InspectorTextInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-openfmv-tool w-full rounded-openfmv-tool border border-white/10 bg-[#171717] px-2.5 text-xs text-white outline-none placeholder:text-openfmv-muted transition hover:border-white/18 hover:bg-[#1d1d1d] focus:border-white/20 focus:bg-[#1d1d1d]"
    />
  );
}

function InspectorSegmentedControl({
  value,
  options,
  tone = 'neutral',
  compact = false,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string; icon?: LucideIcon; visual?: React.ReactNode }>;
  tone?: 'neutral' | 'accent' | 'cyan';
  compact?: boolean;
  onChange: (value: string) => void;
}) {
  const activeClass = tone === 'cyan'
    ? 'bg-cyan-400/28 text-white'
    : tone === 'accent'
      ? 'bg-openfmv-accent text-white'
      : 'bg-white/[0.16] text-white';

  return (
    <div className="grid h-openfmv-tool rounded-openfmv-tool border border-white/10 bg-[#171717] p-0.5 transition hover:border-white/18 hover:bg-[#1d1d1d]" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((option) => {
        const Icon = option.icon;
        const selected = value === option.value;
        const visual = option.visual || (Icon ? <Icon size={13} className="shrink-0" /> : null);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            title={option.label}
            aria-label={option.label}
            className={`flex min-w-0 items-center justify-center gap-1 rounded-openfmv-tool ${compact ? 'px-0' : 'px-1.5'} text-xs font-semibold transition ${selected ? activeClass : 'text-openfmv-muted hover:bg-white/[0.06] hover:text-white'}`}
          >
            {visual}
            {!compact && <span className="truncate">{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

function InspectorSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-10 rounded-openfmv-pill transition ${checked ? 'bg-cyan-400' : 'bg-white/18'}`}
    >
      <span className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-openfmv-pill bg-white shadow transition ${checked ? 'left-[21px]' : 'left-1'}`} />
    </button>
  );
}

function InspectorSwitchRow({
  label,
  icon,
  shortLabel,
  checked,
  onChange,
}: {
  label: string;
  icon: LucideIcon;
  shortLabel: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const Icon = icon;
  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-2 py-1.5">
      <div className="grid h-7 w-7 place-items-center rounded-openfmv-tool text-openfmv-muted" title={label} aria-label={label}>
        <Icon size={14} />
        <span className="sr-only">{label}</span>
      </div>
      <div className="flex h-openfmv-tool items-center justify-between gap-2 rounded-openfmv-tool border border-white/10 bg-[#171717] px-2.5 transition hover:border-white/18 hover:bg-[#1d1d1d]">
        <span className={`truncate text-xs font-semibold ${checked ? 'text-white' : 'text-openfmv-muted'}`}>{shortLabel}</span>
        <InspectorSwitch checked={checked} onChange={onChange} />
      </div>
    </div>
  );
}

function ButtonShapeIcon({ shape, compact = false }: { shape: ButtonStyleShape; compact?: boolean }) {
  const radiusClass = shape === 'pill' ? 'rounded-openfmv-pill' : shape === 'square' || shape === 'diamond' || shape === 'hexagon' ? 'rounded-[2px]' : shape === 'oval' ? 'rounded-[50%]' : 'rounded-[7px]';
  const clipPath = getButtonStyleClipPath(shape);
  const sizeClass = compact ? 'h-3 w-[22px]' : 'h-4 w-7';
  const borderClass = compact ? 'border-2' : 'border';
  return (
    <span
      className={`block ${sizeClass} ${borderClass} border-current bg-white/10 ${radiusClass}`}
      style={{ clipPath, WebkitClipPath: clipPath }}
    />
  );
}

const getButtonShapeOptions = (t: NodeTimelineTranslator): Array<{ label: string; value: ButtonStyleShape }> => [
  { label: t('fields.buttonShapeRounded'), value: 'rounded' },
  { label: t('fields.buttonShapePill'), value: 'pill' },
  { label: t('fields.buttonShapeSquare'), value: 'square' },
  { label: t('fields.buttonShapeOval'), value: 'oval' },
  { label: t('fields.buttonShapeDiamond'), value: 'diamond' },
  { label: t('fields.buttonShapeHexagon'), value: 'hexagon' },
];

const getButtonBackgroundFitOptions = (t: NodeTimelineTranslator): Array<{ label: string; value: ButtonStyleBackgroundFit }> => {
  const labels: Record<ButtonStyleBackgroundFit, string> = {
    cover: t('fields.buttonBackgroundFitCover'),
    contain: t('fields.buttonBackgroundFitContain'),
    stretch: t('fields.buttonBackgroundFitStretch'),
  };
  return BUTTON_STYLE_BACKGROUND_FITS.map((value) => ({ label: labels[value], value }));
};

type FloatingToolbarPanel = 'shape' | 'fill' | 'border' | 'text';

function ButtonFloatingStyleToolbar({
  t,
  clip,
  assetItems,
  draggedAssetId,
  isImportingImage,
  onImportImage,
  onUpdate,
}: {
  t: NodeTimelineTranslator;
  clip: TimelineInteractionClip;
  assetItems: TimelineAssetItem[];
  draggedAssetId: string | null;
  isImportingImage: boolean;
  onImportImage: (file: File) => Promise<OpenFMVAsset | null>;
  onUpdate: (update: (clip: TimelineInteractionClip) => TimelineInteractionClip) => void;
}) {
  const [openPanel, setOpenPanel] = useState<FloatingToolbarPanel | null>(null);
  const style = resolveButtonStyleConfig(clip);
  const placement = getButtonFloatingToolbarPlacement(clip);
  const setStyle = (patch: ButtonStyleConfig) => onUpdate((item) => updateInteractionStyle(item, patch));
  const togglePanel = (panel: FloatingToolbarPanel) => setOpenPanel((currentPanel) => (currentPanel === panel ? null : panel));

  useEffect(() => {
    setOpenPanel(null);
  }, [clip.id]);

  return (
    <div
      className="absolute z-40 w-max text-slate-900"
      style={placement.style}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpenPanel(null);
      }}
    >
      <div className="flex h-9 items-center overflow-hidden rounded-[9px] border border-black/[0.08] bg-white p-0.5 shadow-[0_14px_34px_rgba(15,23,42,0.16)]">
        <FloatingToolbarButton
          label={t('fields.buttonStyleShape')}
          active={openPanel === 'shape'}
          onClick={() => togglePanel('shape')}
        >
          <ButtonShapeIcon shape={style.shape} />
        </FloatingToolbarButton>
        <FloatingToolbarDivider />
        <FloatingToolbarButton
          label={t('fields.buttonFillColor')}
          active={openPanel === 'fill'}
          onClick={() => togglePanel('fill')}
        >
          <span
            className="h-5 w-5 rounded-full border border-slate-300"
            style={{ backgroundColor: getButtonStyleRgba(style.fillColor, style.fillOpacity) }}
          />
        </FloatingToolbarButton>
        <FloatingToolbarButton
          label={t('fields.buttonBorderColor')}
          active={openPanel === 'border'}
          onClick={() => togglePanel('border')}
        >
          <span
            className="h-5 w-5 rounded-full border-[5px] bg-white"
            style={{ borderColor: getButtonStyleRgba(style.borderColor, style.borderWidth > 0 ? style.borderOpacity : 0.2) }}
          />
        </FloatingToolbarButton>
        <FloatingToolbarDivider />
        <FloatingToolbarButton
          label={t('fields.buttonTextColor')}
          active={openPanel === 'text'}
          onClick={() => togglePanel('text')}
        >
          <span className="relative grid h-6 w-6 place-items-center">
            <Type size={18} strokeWidth={2.2} />
            <span className="absolute bottom-0 h-0.5 w-4 rounded-openfmv-pill" style={{ backgroundColor: style.textColor }} />
          </span>
        </FloatingToolbarButton>
      </div>

      {openPanel === 'shape' && (
        <FloatingShapePanel
          t={t}
          placement={placement.panelPlacement}
          value={style.shape}
          onChange={(shape) => setStyle({ shape })}
        />
      )}
      {openPanel === 'fill' && (
        <FloatingFillPanel
          t={t}
          placement={placement.panelPlacement}
          assetItems={assetItems}
          draggedAssetId={draggedAssetId}
          style={style}
          isImporting={isImportingImage}
          onFillColorChange={(fillColor) => setStyle({ fillColor, fillOpacity: style.fillOpacity <= 0 ? 0.92 : style.fillOpacity })}
          onFillClear={() => setStyle({ fillOpacity: 0 })}
          onFillOpacityChange={(fillOpacity) => setStyle({ fillOpacity: clampButtonStyleOpacity(fillOpacity, style.fillOpacity) })}
          onPickAsset={(asset) => setStyle({
            backgroundImageAssetId: asset.id,
            backgroundImageSrc: getAssetSource(asset),
            backgroundImageFit: style.backgroundImageFit ?? 'cover',
          })}
          onImport={async (file) => {
            const asset = await onImportImage(file);
            if (!asset) return;
            setStyle({
              backgroundImageAssetId: asset.id,
              backgroundImageSrc: getAssetSource(asset),
              backgroundImageFit: style.backgroundImageFit ?? 'cover',
            });
          }}
          onRemove={() => setStyle({
            backgroundImageAssetId: undefined,
            backgroundImageSrc: undefined,
            backgroundImageFit: 'cover',
          })}
          onFitChange={(backgroundImageFit) => setStyle({ backgroundImageFit })}
        />
      )}
      {openPanel === 'border' && (
        <FloatingBorderPanel
          t={t}
          placement={placement.panelPlacement}
          value={style.borderColor}
          opacity={style.borderOpacity}
          width={style.borderWidth}
          onColorChange={(borderColor) => setStyle({ borderColor, borderWidth: style.borderWidth <= 0 ? 1 : style.borderWidth })}
          onOpacityChange={(borderOpacity) => setStyle({ borderOpacity: clampButtonStyleOpacity(borderOpacity, style.borderOpacity) })}
          onWidthChange={(borderWidth) => setStyle({ borderWidth: clampButtonBorderWidth(borderWidth, style.borderWidth) })}
        />
      )}
      {openPanel === 'text' && (
        <FloatingColorPanel
          label={t('fields.buttonTextColor')}
          placement={placement.panelPlacement}
          value={style.textColor}
          onChange={(textColor) => setStyle({ textColor })}
        />
      )}
    </div>
  );
}

function FloatingToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-expanded={active}
      onClick={onClick}
      className={`flex h-8 items-center gap-1 rounded-[7px] px-1.5 transition ${active ? 'bg-slate-100 text-slate-950' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'}`}
    >
      {children}
      <ChevronDown size={13} strokeWidth={2.4} className={`transition ${active ? 'rotate-180' : ''}`} />
    </button>
  );
}

function FloatingToolbarDivider() {
  return <div className="mx-0.5 h-6 w-px bg-slate-200" />;
}

function FloatingPanelShell({
  placement,
  widthClass = 'w-[268px]',
  children,
}: {
  placement: FloatingToolbarPlacement;
  widthClass?: string;
  children: React.ReactNode;
}) {
  const placementClass = placement === 'below' ? 'top-[calc(100%+6px)]' : 'bottom-[calc(100%+6px)]';
  return (
    <div className={`absolute left-0 rounded-[9px] border border-black/[0.08] bg-white p-2.5 text-slate-900 shadow-[0_18px_44px_rgba(15,23,42,0.18)] ${widthClass} ${placementClass}`}>
      {children}
    </div>
  );
}

function FloatingFillPanel({
  t,
  placement,
  assetItems,
  draggedAssetId,
  style,
  isImporting,
  onFillColorChange,
  onFillClear,
  onFillOpacityChange,
  onPickAsset,
  onImport,
  onRemove,
  onFitChange,
}: {
  t: NodeTimelineTranslator;
  placement: FloatingToolbarPlacement;
  assetItems: TimelineAssetItem[];
  draggedAssetId: string | null;
  style: ResolvedButtonStyleConfig;
  isImporting: boolean;
  onFillColorChange: (color: string) => void;
  onFillClear: () => void;
  onFillOpacityChange: (opacity: number) => void;
  onPickAsset: (asset: OpenFMVAsset) => void;
  onImport: (file: File) => Promise<void>;
  onRemove: () => void;
  onFitChange: (fit: ButtonStyleBackgroundFit) => void;
}) {
  return (
    <FloatingPanelShell placement={placement} widthClass="w-[356px]">
      <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-3">
        <div className="min-w-0">
          <div className="mb-2 text-[11px] font-semibold text-slate-600">{t('fields.buttonFillColor')}</div>
          <FloatingColorSwatches
            label={t('fields.buttonFillColor')}
            value={style.fillColor}
            includeClear
            clearSelected={style.fillOpacity === 0}
            className="grid grid-cols-5 gap-1.5"
            onChange={onFillColorChange}
            onClear={onFillClear}
          />
          <FloatingOpacityControl label={t('fields.buttonFillOpacity')} value={style.fillOpacity} onChange={onFillOpacityChange} />
        </div>
        <div className="min-w-0 border-l border-slate-200 pl-3">
          <FloatingBackgroundControls
            t={t}
            assetItems={assetItems}
            draggedAssetId={draggedAssetId}
            style={style}
            isImporting={isImporting}
            onPickAsset={onPickAsset}
            onImport={onImport}
            onRemove={onRemove}
            onFitChange={onFitChange}
          />
        </div>
      </div>
    </FloatingPanelShell>
  );
}

function FloatingBackgroundControls({
  t,
  assetItems,
  draggedAssetId,
  style,
  isImporting,
  onPickAsset,
  onImport,
  onRemove,
  onFitChange,
}: {
  t: NodeTimelineTranslator;
  assetItems: TimelineAssetItem[];
  draggedAssetId: string | null;
  style: ResolvedButtonStyleConfig;
  isImporting: boolean;
  onPickAsset: (asset: OpenFMVAsset) => void;
  onImport: (file: File) => Promise<void>;
  onRemove: () => void;
  onFitChange: (fit: ButtonStyleBackgroundFit) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const hasBackground = Boolean(style.backgroundImageSrc);
  const resolvedBackgroundSrc = useResolvedMediaSrc(style.backgroundImageSrc);
  const fitOptions = getButtonBackgroundFitOptions(t);
  const getDraggedImageAssetItem = (event?: React.DragEvent<HTMLElement>) => {
    const assetId = event?.dataTransfer.getData('application/openfmv-asset-id') || draggedAssetId;
    const projectId = event?.dataTransfer.getData('application/openfmv-asset-project-id');
    const assetItem = assetItems.find((item) => item.asset.id === assetId && (!projectId || item.projectId === projectId))
      ?? assetItems.find((item) => item.asset.id === assetId)
      ?? null;
    return assetItem?.asset.type === 'image' ? assetItem : null;
  };
  const canDropImage = (event: React.DragEvent<HTMLElement>) => {
    if (getDraggedImageAssetItem(event)) return true;
    return Array.from(event.dataTransfer.files || []).some((file) => file.type.startsWith('image/'));
  };
  const handleBackgroundDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!canDropImage(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setDragActive(true);
  };
  const handleBackgroundDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!canDropImage(event)) return;
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const assetItem = getDraggedImageAssetItem(event);
    if (assetItem) {
      onPickAsset(assetItem.asset);
      return;
    }

    const imageFile = Array.from(event.dataTransfer.files || []).find((file) => file.type.startsWith('image/'));
    if (imageFile) void onImport(imageFile);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-slate-600">
          <ImageIcon size={13} className="shrink-0 text-slate-400" />
          <span className="truncate">{t('fields.buttonBackgroundImage')}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={isImporting}
            onClick={() => inputRef.current?.click()}
            className="grid h-7 w-7 place-items-center rounded-[7px] text-slate-500 transition hover:bg-blue-50 hover:text-blue-600 disabled:opacity-45"
            title={t('fields.buttonBackgroundUpload')}
            aria-label={t('fields.buttonBackgroundUpload')}
          >
            <Upload size={14} />
          </button>
          <button
            type="button"
            disabled={!hasBackground}
            onClick={onRemove}
            className="grid h-7 w-7 place-items-center rounded-[7px] text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-30"
            title={t('fields.buttonBackgroundRemove')}
            aria-label={t('fields.buttonBackgroundRemove')}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) void onImport(file);
        }}
      />

      <div
        className={`mt-1.5 grid h-[58px] overflow-hidden rounded-[8px] border transition ${dragActive ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : hasBackground ? 'border-slate-200 bg-slate-100' : 'border-dashed border-slate-300 bg-slate-50'}`}
        onDragEnter={handleBackgroundDragOver}
        onDragOver={handleBackgroundDragOver}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleBackgroundDrop}
      >
        {resolvedBackgroundSrc ? (
          <img src={resolvedBackgroundSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-slate-400">
            <ImageIcon size={18} />
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="shrink-0 text-[10px] font-semibold text-slate-400">{t('fields.buttonBackgroundFit')}</span>
        <div className="grid h-7 min-w-0 flex-1 grid-cols-3 rounded-[8px] bg-slate-100 p-0.5">
          {fitOptions.map((option) => {
            const selected = (style.backgroundImageFit ?? 'cover') === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onFitChange(option.value)}
                className={`min-w-0 rounded-[6px] px-1.5 text-[10px] font-semibold transition ${selected ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <span className="block truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function FloatingShapePanel({
  t,
  placement,
  value,
  onChange,
}: {
  t: NodeTimelineTranslator;
  placement: FloatingToolbarPlacement;
  value: ButtonStyleShape;
  onChange: (shape: ButtonStyleShape) => void;
}) {
  const options = getButtonShapeOptions(t);

  return (
    <FloatingPanelShell placement={placement} widthClass="w-[142px]">
      <div className="mb-2 text-[11px] font-semibold text-slate-600">{t('fields.buttonStyleShape')}</div>
      <div className="grid grid-cols-3 gap-1.5">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-label={option.label}
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              title={option.label}
              className={`grid h-8 place-items-center rounded-[7px] transition ${selected ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-300' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              <ButtonShapeIcon shape={option.value} compact />
            </button>
          );
        })}
      </div>
    </FloatingPanelShell>
  );
}

function FloatingColorPanel({
  label,
  placement,
  value,
  opacity,
  opacityLabel,
  includeClear = false,
  onChange,
  onClear,
  onOpacityChange,
}: {
  label: string;
  placement: FloatingToolbarPlacement;
  value: string;
  opacity?: number;
  opacityLabel?: string;
  includeClear?: boolean;
  onChange: (value: string) => void;
  onClear?: () => void;
  onOpacityChange?: (value: number) => void;
}) {
  return (
    <FloatingPanelShell placement={placement}>
      <div className="mb-2 text-[11px] font-semibold text-slate-600">{label}</div>
      <FloatingColorSwatches
        label={label}
        value={value}
        includeClear={includeClear}
        clearSelected={includeClear && opacity === 0}
        onChange={onChange}
        onClear={onClear}
      />
      {typeof opacity === 'number' && opacityLabel && onOpacityChange && (
        <FloatingOpacityControl label={opacityLabel} value={opacity} onChange={onOpacityChange} />
      )}
    </FloatingPanelShell>
  );
}

function FloatingBorderPanel({
  t,
  placement,
  value,
  opacity,
  width,
  onColorChange,
  onOpacityChange,
  onWidthChange,
}: {
  t: NodeTimelineTranslator;
  placement: FloatingToolbarPlacement;
  value: string;
  opacity: number;
  width: number;
  onColorChange: (value: string) => void;
  onOpacityChange: (value: number) => void;
  onWidthChange: (value: number) => void;
}) {
  const widthOptions = [0, 1, 2, 4];

  return (
    <FloatingPanelShell placement={placement}>
      <div className="mb-2 text-[11px] font-semibold text-slate-600">{t('fields.buttonBorderColor')}</div>
      <div className="mb-2 grid grid-cols-4 gap-1.5">
        {widthOptions.map((option) => {
          const selected = Math.round(width) === option;
          return (
            <button
              key={option}
              type="button"
              aria-label={`${t('fields.buttonBorderWidth')} ${option}`}
              aria-pressed={selected}
              onClick={() => onWidthChange(option)}
              className={`grid h-8 place-items-center rounded-[7px] transition ${selected ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
            >
              {option === 0 ? (
                <span className="relative h-5 w-5 rounded-full border border-slate-400">
                  <span className="absolute left-1/2 top-0 h-full w-px -rotate-45 bg-slate-400" />
                </span>
              ) : (
                <span className="w-7 rounded-openfmv-pill bg-current" style={{ height: Math.max(1, option) }} />
              )}
            </button>
          );
        })}
      </div>
      <FloatingColorSwatches
        label={t('fields.buttonBorderColor')}
        value={value}
        onChange={onColorChange}
      />
      <FloatingOpacityControl label={t('fields.buttonBorderOpacity')} value={opacity} onChange={onOpacityChange} />
    </FloatingPanelShell>
  );
}

function FloatingColorSwatches({
  label,
  value,
  includeClear = false,
  clearSelected = false,
  className = 'grid grid-cols-9 gap-1.5',
  onChange,
  onClear,
}: {
  label: string;
  value: string;
  includeClear?: boolean;
  clearSelected?: boolean;
  className?: string;
  onChange: (value: string) => void;
  onClear?: () => void;
}) {
  const safeValue = normalizeButtonHexColor(value, '#ffffff');
  return (
    <div className={className}>
      {includeClear && (
        <button
          type="button"
          aria-label={`${label} none`}
          aria-pressed={clearSelected}
          onClick={onClear}
          className={`relative h-[22px] w-[22px] rounded-full border bg-white transition ${clearSelected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-300 hover:border-slate-500'}`}
        >
          <span className="absolute left-1/2 top-0 h-full w-px -rotate-45 bg-slate-300" />
        </button>
      )}
      {BUTTON_STYLE_SWATCHES.map((color) => {
        const selected = !clearSelected && safeValue === color;
        return (
          <button
            key={color}
            type="button"
            aria-label={`${label} ${color}`}
            aria-pressed={selected}
            onClick={() => onChange(color)}
            className={`grid h-[22px] w-[22px] place-items-center rounded-full border transition ${selected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-black/[0.08] hover:ring-2 hover:ring-slate-200'}`}
            style={{ backgroundColor: color }}
          >
            {selected && <Check size={10} className="text-white drop-shadow" />}
          </button>
        );
      })}
    </div>
  );
}

function FloatingOpacityControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const safeValue = clampButtonStyleOpacity(value);
  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-medium text-slate-700">
        <span>{label}</span>
        <span>{Math.round(safeValue * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={safeValue}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full accent-blue-500"
        aria-label={label}
      />
    </div>
  );
}

const getQteKeyLabelFromEvent = (event: React.KeyboardEvent<HTMLButtonElement>) => {
  if (event.code === 'Space' || event.key === ' ') return 'Space';
  if (event.key === 'Escape') return 'Esc';
  if (event.key.length === 1) return event.key.toUpperCase();
  if (event.key.startsWith('Arrow')) return event.key.replace('Arrow', 'Arrow ');
  return event.key;
};

function InspectorKeyCapture({
  value,
  changeLabel,
  captureLabel,
  showValue = true,
  toggleLabel,
  onChange,
  onShowValueChange,
}: {
  value: string;
  changeLabel: string;
  captureLabel: string;
  showValue?: boolean;
  toggleLabel?: string;
  onChange: (value: string) => void;
  onShowValueChange?: (visible: boolean) => void;
}) {
  const [isCapturing, setIsCapturing] = useState(false);
  const label = isCapturing ? captureLabel : normalizeQteKeyLabel(value);
  const VisibilityIcon = showValue ? Eye : EyeOff;

  return (
    <div className="grid h-openfmv-tool w-full grid-cols-[minmax(0,1fr)_32px] overflow-hidden rounded-openfmv-tool border border-white/10 bg-[#171717] text-xs font-semibold text-white transition hover:border-white/18 hover:bg-[#1d1d1d]">
      <button
        type="button"
        aria-label={isCapturing ? captureLabel : changeLabel}
        title={isCapturing ? captureLabel : changeLabel}
        onClick={(event) => {
          event.currentTarget.focus();
          setIsCapturing(true);
        }}
        onBlur={() => setIsCapturing(false)}
        onKeyDown={(event) => {
          if (!isCapturing) {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setIsCapturing(true);
            }
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          onChange(getQteKeyLabelFromEvent(event));
          setIsCapturing(false);
        }}
        className={`flex min-w-0 items-center px-2.5 text-left outline-none transition ${isCapturing ? 'bg-cyan-400/10' : 'focus:bg-cyan-400/10'}`}
      >
        <span className={`min-w-0 truncate ${showValue ? '' : 'text-openfmv-muted'}`}>{label}</span>
      </button>
      {onShowValueChange && (
        <button
          type="button"
          aria-label={toggleLabel}
          title={toggleLabel}
          onClick={() => onShowValueChange(!showValue)}
          className="grid h-full place-items-center border-l border-white/10 text-openfmv-muted transition hover:bg-white/[0.06] hover:text-white"
        >
          <VisibilityIcon size={14} />
        </button>
      )}
    </div>
  );
}

function InspectorClickCountStepper({
  value,
  ariaLabel,
  showValue = true,
  toggleLabel,
  onChange,
  onShowValueChange,
}: {
  value: number;
  ariaLabel: string;
  showValue?: boolean;
  toggleLabel?: string;
  onChange: (value: number) => void;
  onShowValueChange?: (visible: boolean) => void;
}) {
  const count = clampQteClickCount(value);
  const VisibilityIcon = showValue ? Eye : EyeOff;

  return (
    <div className={`grid h-openfmv-tool w-full ${onShowValueChange ? 'grid-cols-[32px_minmax(0,1fr)_32px_32px]' : 'grid-cols-[32px_minmax(0,1fr)_32px]'} overflow-hidden rounded-openfmv-tool border border-white/10 bg-[#171717] text-xs font-semibold text-white transition hover:border-white/18 hover:bg-[#1d1d1d]`}>
      <button
        type="button"
        aria-label={`${ariaLabel} -`}
        disabled={count <= 1}
        onClick={() => onChange(count - 1)}
        className="grid h-full place-items-center border-r border-white/10 text-openfmv-muted transition hover:bg-white/[0.06] hover:text-white disabled:opacity-35"
      >
        <Minus size={13} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label={ariaLabel}
        value={count}
        onChange={(event) => onChange(clampQteClickCount(event.target.value))}
        className={`h-full min-w-0 border-0 bg-transparent px-2 text-center font-mono text-xs outline-none ${showValue ? 'text-white' : 'text-openfmv-muted'}`}
      />
      <button
        type="button"
        aria-label={`${ariaLabel} +`}
        disabled={count >= 20}
        onClick={() => onChange(count + 1)}
        className="grid h-full place-items-center border-l border-white/10 text-openfmv-muted transition hover:bg-white/[0.06] hover:text-white disabled:opacity-35"
      >
        <Plus size={13} />
      </button>
      {onShowValueChange && (
        <button
          type="button"
          aria-label={toggleLabel}
          title={toggleLabel}
          onClick={() => onShowValueChange(!showValue)}
          className="grid h-full place-items-center border-l border-white/10 text-openfmv-muted transition hover:bg-white/[0.06] hover:text-white"
        >
          <VisibilityIcon size={14} />
        </button>
      )}
    </div>
  );
}

function QteOutcomeRow({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-2">
      <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-openfmv-muted" title={label}>
        <Icon size={13} className="shrink-0" />
        <span className="min-w-0 truncate">{label}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function TimelineOutputTargetSelect({
  t,
  outputId,
  nodes,
  activeNode,
  edges,
  onChange,
}: {
  t: NodeTimelineTranslator;
  outputId: string;
  nodes: AppNode[];
  activeNode: AppNode;
  edges: AppEdge[];
  onChange: (outputId: string, targetNodeId: string | null) => void;
}) {
  const targetNodes = nodes.filter((node) => node.id !== activeNode.id);
  const selectedTargetId = edges.find((edge) => edge.source === activeNode.id && edge.sourceHandle === outputId)?.target ?? '';

  return (
    <select
      value={selectedTargetId}
      onChange={(event) => onChange(outputId, event.target.value || null)}
      className="openfmv-dark-select h-openfmv-tool w-full rounded-openfmv-tool border border-white/10 bg-[#171717] px-2.5 text-xs font-semibold text-white outline-none transition hover:border-white/18 hover:bg-[#1d1d1d] focus:border-white/24"
      title={outputId}
    >
      <option value="">{t('fields.chooseScene')}</option>
      {targetNodes.map((node) => (
        <option key={node.id} value={node.id}>
          {getNodeTitle(node, t)}
        </option>
      ))}
    </select>
  );
}

function InteractionClipInspector({
  t,
  clip,
  nodes,
  activeNode,
  edges,
  onOutputTargetChange,
  onUpdate,
}: {
  t: NodeTimelineTranslator;
  clip: TimelineInteractionClip;
  nodes: AppNode[];
  activeNode: AppNode;
  edges: AppEdge[];
  onOutputTargetChange: (outputId: string, targetNodeId: string | null) => void;
  onUpdate: (update: (clip: TimelineInteractionClip) => TimelineInteractionClip) => void;
}) {
  const isPauseWait = clip.pauseOnShow === true;
  const mode = getButtonMode(clip);
  const isQte = mode === 'qte';
  const qteConfig = getQteConfig(clip);
  const clickOutputId = getTimelineClipOutputHandleId(clip.id);
  const timeoutOutputId = getTimelineClipOutputHandleId(clip.id, 'timeout');

  return (
    <div className="space-y-1">
      <InspectorFieldRow label={t('fields.buttonMode')} icon={Diamond}>
        <InspectorSegmentedControl
          value={mode}
          tone="accent"
          options={[
            { label: t('fields.buttonModeNormal'), value: 'normal', icon: MousePointerClick },
            { label: t('fields.buttonModeQte'), value: 'qte', icon: Diamond },
          ]}
          onChange={(value) => onUpdate((item) => updateButtonMode(item, value === 'qte' ? 'qte' : 'normal'))}
        />
      </InspectorFieldRow>

      {isQte ? (
        <>
          <InspectorFieldRow label={t('fields.qteName')} icon={Type}>
            <InspectorTextInput value={getTimelineQteDisplayName(clip)} onChange={(value) => onUpdate((item) => updateInteractionLabel(item, value))} />
          </InspectorFieldRow>
          <InspectorFieldRow label={t('fields.qteCondition')} icon={Keyboard}>
            <InspectorSegmentedControl
              value={qteConfig.input}
              tone="cyan"
              options={[
                { label: t('fields.qteInputClick'), value: 'click', icon: MousePointerClick },
                { label: t('fields.qteInputSpace'), value: 'space', icon: Keyboard },
              ]}
              onChange={(value) => onUpdate((item) => updateInteractionQteConfig(item, { input: value === 'space' ? 'space' : 'click' }))}
            />
          </InspectorFieldRow>
          {qteConfig.input === 'click' && (
            <InspectorFieldRow label={t('fields.qteClickCount')} icon={MousePointerClick}>
              <InspectorClickCountStepper
                value={qteConfig.clickCount || 1}
                ariaLabel={t('fields.qteClickCount')}
                onChange={(value) => onUpdate((item) => updateInteractionQteConfig(item, { input: 'click', clickCount: value }))}
                showValue={qteConfig.showCueLabel !== false}
                toggleLabel={qteConfig.showCueLabel === false ? 'Show click text' : 'Hide click text'}
                onShowValueChange={(visible) => onUpdate((item) => updateInteractionQteConfig(item, { showCueLabel: visible }))}
              />
            </InspectorFieldRow>
          )}
          {qteConfig.input === 'space' && (
            <InspectorFieldRow label={t('fields.qteKey')} icon={Keyboard}>
              <InspectorKeyCapture
                value={qteConfig.keyLabel || 'Space'}
                changeLabel={t('fields.qteChangeKey')}
                captureLabel={t('fields.qtePressNewKey')}
                onChange={(value) => onUpdate((item) => updateInteractionQteConfig(item, { input: 'space', keyLabel: value }))}
                showValue={qteConfig.showCueLabel !== false}
                toggleLabel={qteConfig.showCueLabel === false ? 'Show key text' : 'Hide key text'}
                onShowValueChange={(visible) => onUpdate((item) => updateInteractionQteConfig(item, { showCueLabel: visible }))}
              />
            </InspectorFieldRow>
          )}
        </>
      ) : (
        <InspectorFieldRow label={t('fields.label')} icon={Type}>
          <InspectorTextInput value={clip.label || ''} onChange={(value) => onUpdate((item) => updateInteractionLabel(item, value))} />
        </InspectorFieldRow>
      )}

      <InspectorDivider />

      {!isQte && (
        <>
          <InspectorSwitchRow
            label={t('fields.pauseOnShow')}
            icon={Pause}
            shortLabel={t('fields.pauseShort')}
            checked={isPauseWait}
            onChange={(checked) => onUpdate((item) => updateInteractionPauseMode(item, checked))}
          />

          <InspectorDivider />
        </>
      )}

      <div className="space-y-2 py-1">
        <QteOutcomeRow label={t('fields.qteSuccessAction')} icon={Check}>
          <TimelineOutputTargetSelect
            t={t}
            outputId={clickOutputId}
            nodes={nodes}
            activeNode={activeNode}
            edges={edges}
            onChange={onOutputTargetChange}
          />
        </QteOutcomeRow>
        {isQte && (
          <QteOutcomeRow label={t('fields.qteFailAction')} icon={X}>
            <TimelineOutputTargetSelect
              t={t}
              outputId={timeoutOutputId}
              nodes={nodes}
              activeNode={activeNode}
              edges={edges}
              onChange={onOutputTargetChange}
            />
          </QteOutcomeRow>
        )}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  step,
  disabled,
  beforeLabel,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  disabled?: boolean;
  beforeLabel?: React.ReactNode;
  onChange: (value: number) => void;
}) {
  return (
    <div className="block">
      <span className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-openfmv-muted">
        {beforeLabel}
        <span>{label}</span>
      </span>
      <input
        type="number"
        aria-label={label}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-openfmv-control w-full rounded-openfmv-tool border border-white/12 bg-white/[0.075] px-2 font-mono text-xs text-white outline-none focus:border-white/30 disabled:opacity-45"
      />
    </div>
  );
}
