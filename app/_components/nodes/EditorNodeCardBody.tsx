import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { Position } from '@xyflow/react';
import { ArrowRight, GitBranch, ImageIcon, ListTree, Music2, Video } from 'lucide-react';

import OpenFMVVideo from '../video/OpenFMVVideo';
import { useProjectSessionStore } from '@/app/_features/project-session/store';
import { compileNodeTimeline } from '../../_features/node-timeline/runtime';
import { getTimelineClipLabel } from '../../_features/node-timeline/schema';
import { useResolvedMediaSrc } from '../../_hooks/useResolvedMediaSrc';
import { AppEdge, AppNode, InteractionRule, TimelineAction, TimelineInteractionClip, TimelineMediaClip } from '../../_types';
import { getTimelineClipOutputHandleId } from '../../_utils/timelineOutputEdges';
import { CustomHandle } from './CustomHandle';
import { useOpenNodeTimeline } from './OpenNodeTimelineButton';

type EditorNodeData = AppNode['data'];
type EditorTranslator = ReturnType<typeof useTranslations<'editor'>>;

interface EditorNodeCardBodyProps {
  nodeId: string;
  data: EditorNodeData;
}

interface EditorNodeOutputRow {
  key: string;
  label: string;
  targetLabel: string;
  handleId?: string | null;
  connectable: boolean;
  unlinked: boolean;
}

const formatSeconds = (value: number) => {
  const safeValue = Math.max(0, Number(value) || 0);
  return Number.isInteger(safeValue) ? String(safeValue) : safeValue.toFixed(1).replace(/\.0$/, '');
};

export const getEditorNodeDurationLabel = (data: EditorNodeData) => {
  const timelineDuration = Number(data.timeline?.duration);
  const timeLimit = 'timeLimit' in data ? Number(data.timeLimit) : 0;
  const duration = data.timeline && Number.isFinite(timelineDuration) && timelineDuration > 0 ? timelineDuration : timeLimit;
  return duration > 0 ? `${formatSeconds(duration)}s` : null;
};

const getNodeDisplayName = (node: AppNode | undefined, t: EditorTranslator) => {
  if (!node) return t('nodePreview.unlinked');
  if (node.data.type === 'start') return node.data.label || t('startNode');
  if (node.data.type === 'end') return node.data.label || t('endNode');
  if (node.data.type === 'interaction') return node.data.title || node.data.prompt || t('nodeTypes.story.name');
  return node.data.title || t('nodeTypes.story.name');
};

const getSourceTargetLabel = ({
  handleId,
  nodesById,
  sourceEdges,
  t,
}: {
  handleId: string | null;
  nodesById: Map<string, AppNode>;
  sourceEdges: AppEdge[];
  t: EditorTranslator;
}) => {
  const edge = sourceEdges.find((item) => (item.sourceHandle ?? null) === handleId);
  return edge ? getNodeDisplayName(nodesById.get(edge.target), t) : t('nodePreview.unlinked');
};

const getMediaSummary = (mediaClips: TimelineMediaClip[], t: EditorTranslator) => {
  const videoCount = mediaClips.filter((clip) => clip.type === 'video').length;
  const imageCount = mediaClips.filter((clip) => clip.type === 'image').length;
  const audioCount = mediaClips.filter((clip) => clip.type === 'audio').length;
  const parts = [
    videoCount > 0 ? t('nodePreview.videoCount', { count: videoCount }) : null,
    imageCount > 0 ? t('nodePreview.imageCount', { count: imageCount }) : null,
    audioCount > 0 ? t('nodePreview.audioCount', { count: audioCount }) : null,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(' · ');
  return t('nodePreview.noMedia');
};

const isGenericOptionLabel = (label: string) => /^option\s+\d+$/i.test(label.trim());

const getGenericOptionIndex = (label: string, fallbackIndex: number) => {
  const match = label.trim().match(/^option\s+(\d+)$/i);
  return match ? Number(match[1]) : fallbackIndex;
};

const getRuleOutputLabel = (rule: InteractionRule, index: number, data: EditorNodeData, t: EditorTranslator) => {
  const rawLabel = (rule.condition || rule.keyword || '').trim();
  if (!rawLabel || isGenericOptionLabel(rawLabel)) {
    return t('nodePreview.choiceResult', { index: getGenericOptionIndex(rawLabel, index + 1) });
  }

  if ((data.type === 'start' || data.type === 'interaction') && data.interactionMode === 'input') {
    return t('nodePreview.inputMatched', { label: rawLabel });
  }

  return t('nodePreview.clicked', { label: rawLabel });
};

const getFallbackOutputLabel = (data: EditorNodeData, t: EditorTranslator) => {
  if (data.type !== 'start' && data.type !== 'interaction') return t('nodePreview.fallback');
  if (Number(data.timeLimit) > 0) return t('nodePreview.noAction');
  if (data.interactionMode === 'input') return t('nodePreview.noMatch');

  const customLabel = (data.elseLabel || '').trim();
  if (customLabel && customLabel !== t('default') && customLabel !== t('defaultPath') && customLabel !== t('defaultPathShort')) return customLabel;
  return t('nodePreview.fallback');
};

const getInteractionClipAction = (clip: TimelineInteractionClip): TimelineAction | undefined => {
  return clip.action;
};

const getTimelineOutputLabel = (clip: TimelineInteractionClip, t: EditorTranslator) => t('nodePreview.clicked', { label: getTimelineClipLabel(clip) });

const buildOutputRows = ({
  data,
  interactionClips,
  nodesById,
  sourceEdges,
  t,
}: {
  data: EditorNodeData;
  interactionClips: TimelineInteractionClip[];
  nodesById: Map<string, AppNode>;
  sourceEdges: AppEdge[];
  t: EditorTranslator;
}) => {
  const rows: EditorNodeOutputRow[] = [];
  const usedHandles = new Set<string>();

  const addRow = (row: EditorNodeOutputRow) => {
    if (row.connectable) {
      const handleKey = `handle:${row.handleId ?? '__default__'}`;
      if (usedHandles.has(handleKey)) return;
      usedHandles.add(handleKey);
    }
    rows.push(row);
  };

  const addActionRow = (
    key: string,
    label: string,
    action?: TimelineAction,
    options: { includeUnlinked?: boolean; handleId?: string | null; connectable?: boolean } = {}
  ) => {
    const rowHandleId = options.handleId ?? null;
    const canConnectRow = Boolean(options.connectable && rowHandleId !== null);

    if (!action || action.type === 'continue') {
      if (options.includeUnlinked) {
        addRow({ key, label, targetLabel: t('nodePreview.unlinked'), handleId: rowHandleId, connectable: canConnectRow, unlinked: true });
      }
      return;
    }

    if (action.type === 'goToNode') {
      const targetLabel = action.nodeId ? getNodeDisplayName(nodesById.get(action.nodeId), t) : t('nodePreview.unlinked');
      addRow({ key, label, targetLabel, handleId: rowHandleId, connectable: canConnectRow, unlinked: !action.nodeId });
      return;
    }

    const targetHandleId = action.handleId ?? null;
    const targetLabel = getSourceTargetLabel({ handleId: targetHandleId, nodesById, sourceEdges, t });
    addRow({ key, label, targetLabel, handleId: rowHandleId ?? targetHandleId, connectable: true, unlinked: targetLabel === t('nodePreview.unlinked') });
  };

  interactionClips.forEach((clip) => {
    addActionRow(`clip:${clip.id}`, getTimelineOutputLabel(clip, t), getInteractionClipAction(clip), {
      includeUnlinked: true,
      handleId: getTimelineClipOutputHandleId(clip.id),
      connectable: true,
    });
    if (clip.timeoutAction) {
      addActionRow(`clip:${clip.id}:timeout`, t('nodePreview.noAction'), clip.timeoutAction, {
        includeUnlinked: true,
        handleId: getTimelineClipOutputHandleId(clip.id, 'timeout'),
        connectable: true,
      });
    }
  });

  if ((data.type === 'start' || data.type === 'interaction') && rows.length > 0) return rows;

  if (data.type === 'story') {
    const targetLabel = getSourceTargetLabel({ handleId: null, nodesById, sourceEdges, t });
    addRow({ key: 'story:continue', label: t('nodePreview.continue'), targetLabel, handleId: null, connectable: true, unlinked: targetLabel === t('nodePreview.unlinked') });
    return rows;
  }

  if (data.type !== 'start' && data.type !== 'interaction') return rows;

  (data.rules || [])
    .filter((rule) => rule.handleId !== 'else')
    .forEach((rule, index) => {
      const targetLabel = getSourceTargetLabel({ handleId: rule.handleId, nodesById, sourceEdges, t });
      addRow({
        key: `rule:${rule.id}`,
        label: getRuleOutputLabel(rule, index, data, t),
        targetLabel,
        handleId: rule.handleId,
        connectable: true,
        unlinked: targetLabel === t('nodePreview.unlinked'),
      });
    });

  if (data.interactionMode === 'slider') {
    const targetLabel = getSourceTargetLabel({ handleId: 'slider', nodesById, sourceEdges, t });
    addRow({ key: 'slider', label: t('nodePreview.sliderSucceeded', { label: data.sliderConfig?.label || t('sliderMode') }), targetLabel, handleId: 'slider', connectable: true, unlinked: targetLabel === t('nodePreview.unlinked') });
  }

  const targetLabel = getSourceTargetLabel({ handleId: 'else', nodesById, sourceEdges, t });
  addRow({ key: 'default', label: getFallbackOutputLabel(data, t), targetLabel, handleId: 'else', connectable: true, unlinked: targetLabel === t('nodePreview.unlinked') });
  return rows;
};

const MediaPreview = ({ clip }: { clip: TimelineMediaClip | null }) => {
  const t = useTranslations('editor');
  const resolvedImageSrc = useResolvedMediaSrc(clip?.type === 'image' ? clip.src : undefined);

  if (clip?.type === 'video') {
    return (
      <div className="relative h-full w-full bg-black">
        <OpenFMVVideo src={clip.src} poster={clip.poster} controls={false} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white/80">
          <Video size={11} />
          {t('nodePreview.video')}
        </div>
      </div>
    );
  }

  if (clip?.type === 'image') {
    return (
      <div className="relative h-full w-full bg-black">
        <img src={resolvedImageSrc} alt={clip.name || t('nodePreview.previewAlt')} className="h-full w-full object-cover" />
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white/80">
          <ImageIcon size={11} />
          {t('nodePreview.image')}
        </div>
      </div>
    );
  }

  if (clip?.type === 'audio') {
    return (
      <div className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_50%_35%,rgba(104,211,145,0.18),transparent_45%),linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))]">
        <div className="flex flex-col items-center gap-2 text-openfmv-sub">
          <Music2 size={24} />
          <span className="text-xs font-medium">{t('nodePreview.audioOnly')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full w-full place-items-center bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.015))]">
      <div className="flex flex-col items-center gap-2 text-openfmv-muted">
        <ImageIcon size={24} />
        <span className="text-xs font-medium">{t('nodePreview.noMedia')}</span>
      </div>
    </div>
  );
};

const OutputHandle = ({ row }: { row: EditorNodeOutputRow }) => {
  if (!row.connectable) {
    return <div className="h-3.5 w-3.5 rounded-full border-2 border-white/24 bg-[#1f1f1f] shadow-[0_0_0_3px_rgba(0,0,0,0.22)]" />;
  }

  return (
    <CustomHandle
      type="source"
      position={Position.Right}
      id={row.handleId ?? undefined}
      className="!border-white/40 !bg-[#2b2b2b]"
    />
  );
};

const EditorNodeCardBody = ({ nodeId, data }: EditorNodeCardBodyProps) => {
  const t = useTranslations('editor');
  const nodes = useProjectSessionStore((state) => state.nodes);
  const edges = useProjectSessionStore((state) => state.edges);
  const compiledTimeline = useMemo(() => compileNodeTimeline(data.timeline), [data.timeline]);
  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const sourceEdges = useMemo(() => edges.filter((edge) => edge.source === nodeId), [edges, nodeId]);
  const openNodeTimeline = useOpenNodeTimeline(nodeId);
  const outputRows = buildOutputRows({
    data,
    interactionClips: compiledTimeline.interactionClips,
    nodesById,
    sourceEdges,
    t,
  });
  const mediaSummary = getMediaSummary(compiledTimeline.mediaClips, t);
  const handlePreviewKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    openNodeTimeline(event);
  };

  return (
    <div className="space-y-3 p-3">
      <div className="overflow-hidden rounded-md border border-white/10 bg-black/25">
        <div
          role="button"
          tabIndex={0}
          title={t('nodePreview.openInNodes')}
          aria-label={t('nodePreview.openInNodes')}
          className="nodrag nopan aspect-video outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          onClick={openNodeTimeline}
          onKeyDown={handlePreviewKeyDown}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <MediaPreview clip={compiledTimeline.primaryMediaClip} />
        </div>
        <div className="flex h-8 items-center justify-between gap-2 border-t border-white/10 px-2.5">
          <span className="min-w-0 truncate text-[11px] font-medium text-openfmv-sub">{mediaSummary}</span>
          {compiledTimeline.interactionClips.length > 0 && (
            <span className="shrink-0 text-[10px] font-semibold text-openfmv-muted">
              {t('nodePreview.interactionCount', { count: compiledTimeline.interactionClips.length })}
            </span>
          )}
        </div>
      </div>

      <div className="border-t border-white/10 pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-openfmv-muted">
            <ListTree size={12} />
            {t('nodePreview.outputs')}
          </div>
          {outputRows.length > 0 && (
            <span className="rounded bg-white/[0.055] px-1.5 py-0.5 text-[10px] font-semibold text-openfmv-muted">{outputRows.length}</span>
          )}
        </div>

        {outputRows.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {outputRows.map((row) => (
              <div key={row.key} className="group/output relative flex h-8 items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.035] px-2.5 transition hover:border-white/20 hover:bg-white/[0.055]">
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-openfmv-text">{row.label}</span>
                <ArrowRight size={12} className="shrink-0 text-openfmv-muted" />
                <span className={`max-w-[105px] shrink-0 truncate text-right text-xs font-medium ${row.unlinked ? 'text-openfmv-muted' : 'text-openfmv-sub'}`}>
                  {row.targetLabel}
                </span>
                <div className="absolute right-[-30px] top-1/2 -translate-y-1/2">
                  <OutputHandle row={row} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-9 items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 text-xs text-openfmv-muted">
            <GitBranch size={13} />
            {data.type === 'end' ? t('nodePreview.endState') : t('nodePreview.noOutputs')}
          </div>
        )}
      </div>
    </div>
  );
};

export default EditorNodeCardBody;
