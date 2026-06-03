'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';

import { Clock, Crosshair, Film, GitBranch, Layers, MousePointerClick, PauseCircle, Play, Plus, Trash2, Upload } from 'lucide-react';

import { AppEdge, AppNode, InteractionRule, OverlayRect, TimelineAction, TimelineClip, TimelineClipType } from '@/app/_types';
import { useResolvedMediaSrc } from '@/app/_hooks/useResolvedMediaSrc';
import { useEditorStore } from '@/app/_store/useEditorStore';
import { getLocalizedPath } from '@/app/_utils/localePaths';
import {
  DEFAULT_TIMELINE_DURATION,
  clampOverlayRect,
  clampTimelineTime,
  createTimelineClip,
  createTimelineId,
  ensureNodeTimeline,
  getDefaultOverlayRect,
  getTimelineClipLabel,
  getTimelineClips,
  getTimelineDuration,
  isTimelineClipActive,
  roundTimelineTime,
  writeTimelineClips,
} from '@/app/_utils/timeline';
import OpenFMVVideo from '@/app/_components/video/OpenFMVVideo';
import { createEditorNode, getAvailableNodePosition } from '../canvas/nodeFactory';

interface SourceHandleOption {
  id: string | null;
  label: string;
  connected: boolean;
}

type OverlayDragState = {
  kind: 'overlay';
  mode: 'move' | 'resize';
  clipId: string;
  rect: OverlayRect;
  clientX: number;
  clientY: number;
  frameWidth: number;
  frameHeight: number;
};

type TimelineDragState = {
  kind: 'timeline';
  mode: 'move' | 'start' | 'end';
  clipId: string;
  clientX: number;
  startTime: number;
  endTime: number;
  trackWidth: number;
};

type DragState = OverlayDragState | TimelineDragState | null;

const CLIP_LIBRARY: Array<{ type: TimelineClipType; label: string; description: string; icon: React.ElementType; colorClass: string }> = [
  { type: 'button', label: '选择按钮', description: '出现时暂停并等待点击', icon: MousePointerClick, colorClass: 'bg-orange-500/90' },
  { type: 'hotspot', label: '热点区域', description: '画面区域点击跳转', icon: Crosshair, colorClass: 'bg-cyan-500/75' },
  { type: 'pauseGate', label: '暂停等待', description: '停住视频并继续播放', icon: PauseCircle, colorClass: 'bg-violet-500/75' },
];

const formatTime = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const minute = Math.floor(safe / 60).toString().padStart(2, '0');
  const second = Math.floor(safe % 60).toString().padStart(2, '0');
  const cent = Math.floor((safe % 1) * 100).toString().padStart(2, '0');
  return `${minute}:${second}.${cent}`;
};

const getNodeTitle = (node: AppNode) => {
  const data = node.data;
  if (data.type === 'start') return data.label || 'Start';
  if (data.type === 'end') return data.label || '结束';
  if (data.type === 'interaction') return data.title || data.prompt || node.type;
  return data.title || node.type;
};

const getClipClassName = (type: TimelineClipType) => {
  if (type === 'hotspot') return 'border-cyan-300/90 bg-cyan-400/14 text-cyan-50';
  if (type === 'pauseGate') return 'border-violet-300/80 bg-violet-400/82 text-white';
  return 'border-orange-300/90 bg-orange-500/90 text-white';
};

const getTimelineClipClassName = (type: TimelineClipType) => {
  if (type === 'hotspot') return 'border-cyan-200/60 bg-cyan-400/70 text-cyan-950';
  if (type === 'pauseGate') return 'border-violet-200/55 bg-violet-400/70 text-violet-950';
  return 'border-orange-200/60 bg-orange-400/85 text-orange-950';
};

const getClipTypeLabel = (type: TimelineClipType) => {
  if (type === 'hotspot') return 'hotspot';
  if (type === 'pauseGate') return 'pause gate';
  return 'button';
};

const getClipRect = (clip: TimelineClip): OverlayRect => {
  if ('rect' in clip && clip.rect) return clip.rect;
  return getDefaultOverlayRect(clip.type);
};

const getClipAction = (clip: TimelineClip): TimelineAction => {
  if (clip.type === 'pauseGate') return clip.action || { type: 'continue' };
  return clip.action;
};

const getSourceHandleOptions = (node: AppNode, edges: AppEdge[]): SourceHandleOption[] => {
  const outgoingEdges = edges.filter((edge) => edge.source === node.id);
  const options = new Map<string, SourceHandleOption>();
  const addOption = (id: string | null, label: string) => {
    const key = id ?? '__default__';
    options.set(key, {
      id,
      label,
      connected: outgoingEdges.some((edge) => (edge.sourceHandle ?? null) === id),
    });
  };

  if (node.type === 'story') addOption(null, '默认出口');
  if (node.type === 'start' || node.type === 'interaction') {
    const rules = ((node.data as { rules?: InteractionRule[] }).rules || []).filter((rule) => rule.handleId);
    rules.forEach((rule) => addOption(rule.handleId, rule.condition || rule.keyword || rule.handleId));
    if (node.data.type === 'interaction' && node.data.interactionMode === 'slider') addOption('slider', '滑动成功');
    addOption('else', '默认路径');
  }

  outgoingEdges.forEach((edge) => addOption(edge.sourceHandle ?? null, edge.sourceHandle || '默认出口'));
  return Array.from(options.values());
};

export default function NodeTimelinePanel() {
  const locale = useLocale();
  const searchParams = useSearchParams();
  const selectedNode = useEditorStore((state) => state.selectedNode);
  const selectedNodeIdFromStore = useEditorStore((state) => state.selectedNodeId);
  const nodes = useEditorStore((state) => state.nodes);
  const edges = useEditorStore((state) => state.edges);
  const updateNodeData = useEditorStore((state) => state.updateNodeData);
  const setSelectedNodeId = useEditorStore((state) => state.setSelectedNodeId);
  const addNodeAndConnect = useEditorStore((state) => state.addNodeAndConnect);
  const setAssetPickerOpen = useEditorStore((state) => state.setAssetPickerOpen);
  const setTargetNodeIdForAsset = useEditorStore((state) => state.setTargetNodeIdForAsset);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [playhead, setPlayheadState] = useState(0);
  const [duration, setDuration] = useState(DEFAULT_TIMELINE_DURATION);
  const [isPlaying, setIsPlaying] = useState(false);
  const [dragState, setDragState] = useState<DragState>(null);

  const selectedNodeId = selectedNode?.id;
  const video = selectedNode?.data.video;
  const hasVideo = Boolean(video);
  const projectId = searchParams.get('id');
  const blueprintHref = getLocalizedPath(locale, `/editor${projectId ? `?id=${encodeURIComponent(projectId)}` : ''}`);
  const videoSrc = useResolvedMediaSrc(video);
  const timeline = useMemo(
    () => ensureNodeTimeline(selectedNode?.data.timeline, duration),
    [duration, selectedNode?.data.timeline]
  );
  const timelineDuration = getTimelineDuration(timeline, duration);
  const clips = useMemo(() => getTimelineClips(timeline), [timeline]);
  const selectedClip = clips.find((clip) => clip.id === selectedClipId) || clips[0] || null;
  const sourceHandles = useMemo(() => selectedNode ? getSourceHandleOptions(selectedNode, edges) : [], [edges, selectedNode]);
  const timelineNodes = useMemo(() => nodes, [nodes]);

  useEffect(() => {
    if (selectedNodeIdFromStore && nodes.some((node) => node.id === selectedNodeIdFromStore)) return;
    const firstVideoNode = nodes.find((node) => node.data.video);
    const firstNode = firstVideoNode || nodes[0];
    if (firstNode) setSelectedNodeId(firstNode.id);
  }, [nodes, selectedNodeIdFromStore, setSelectedNodeId]);

  useEffect(() => {
    const currentNode = useEditorStore.getState().selectedNode;
    if (!currentNode) return;
    setSelectedClipId(null);
    setPlayheadState(0);
    setIsPlaying(false);
    setDuration(getTimelineDuration(currentNode.data.timeline, DEFAULT_TIMELINE_DURATION));
  }, [selectedNodeId]);

  useEffect(() => {
    if (!selectedClipId || clips.some((clip) => clip.id === selectedClipId)) return;
    setSelectedClipId(clips[0]?.id ?? null);
  }, [clips, selectedClipId]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    const handleTimeUpdate = () => {
      setPlayheadState(clampTimelineTime(videoElement.currentTime || 0, timelineDuration));
    };
    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('loadedmetadata', handleTimeUpdate);
    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('loadedmetadata', handleTimeUpdate);
    };
  }, [video, timelineDuration]);

  const writeClips = useCallback(
    (nextClips: TimelineClip[], nextDuration = timelineDuration) => {
      if (!selectedNode) return;
      const nextTimeline = writeTimelineClips(selectedNode.data.timeline, nextClips, nextDuration);
      updateNodeData(selectedNode.id, { timeline: nextTimeline } as Partial<AppNode['data']>);
    },
    [selectedNode, timelineDuration, updateNodeData]
  );

  const updateClip = useCallback(
    (clipId: string, updater: (clip: TimelineClip) => TimelineClip) => {
      writeClips(clips.map((clip) => (clip.id === clipId ? updater(clip) : clip)));
    },
    [clips, writeClips]
  );

  const setPlayhead = useCallback(
    (value: number) => {
      const nextTime = clampTimelineTime(value, timelineDuration);
      setPlayheadState(nextTime);
      if (videoRef.current && Number.isFinite(videoRef.current.duration)) {
        videoRef.current.currentTime = Math.min(nextTime, videoRef.current.duration);
      }
    },
    [timelineDuration]
  );

  const addClip = useCallback(
    (type: TimelineClipType, startTime = playhead, rect?: OverlayRect) => {
      if (!hasVideo) return;
      const clip = createTimelineClip(type, startTime, timelineDuration, rect);
      writeClips([...clips, clip]);
      setSelectedClipId(clip.id);
    },
    [clips, hasVideo, playhead, timelineDuration, writeClips]
  );

  const deleteSelectedClip = () => {
    if (!selectedClip) return;
    const nextClips = clips.filter((clip) => clip.id !== selectedClip.id);
    writeClips(nextClips);
    setSelectedClipId(nextClips[0]?.id ?? null);
  };

  const openAssetPickerForSelectedNode = () => {
    if (!selectedNode) return;
    setTargetNodeIdForAsset(selectedNode.id);
    setAssetPickerOpen(true);
  };

  const onLibraryDragStart = (event: React.DragEvent, type: TimelineClipType) => {
    if (!hasVideo) return;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/openfmv-timeline-clip', type);
  };

  const onPreviewDrop = (event: React.DragEvent<HTMLDivElement>) => {
    const type = event.dataTransfer.getData('application/openfmv-timeline-clip') as TimelineClipType;
    if (!type || !frameRef.current) return;
    event.preventDefault();
    const frame = frameRef.current.getBoundingClientRect();
    const defaultRect = getDefaultOverlayRect(type);
    const rect = clampOverlayRect({
      ...defaultRect,
      x: (event.clientX - frame.left) / frame.width - defaultRect.width / 2,
      y: (event.clientY - frame.top) / frame.height - defaultRect.height / 2,
    });
    addClip(type, playhead, rect);
  };

  const onTrackDrop = (event: React.DragEvent<HTMLDivElement>) => {
    const type = event.dataTransfer.getData('application/openfmv-timeline-clip') as TimelineClipType;
    if (!type || !trackRef.current) return;
    event.preventDefault();
    const rect = trackRef.current.getBoundingClientRect();
    const startTime = ((event.clientX - rect.left) / rect.width) * timelineDuration;
    addClip(type, roundTimelineTime(startTime, event.altKey ? 0.01 : 0.1));
  };

  const startOverlayDrag = (event: React.MouseEvent, clip: TimelineClip, mode: 'move' | 'resize') => {
    if (!frameRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const frame = frameRef.current.getBoundingClientRect();
    setSelectedClipId(clip.id);
    setDragState({
      kind: 'overlay',
      mode,
      clipId: clip.id,
      rect: getClipRect(clip),
      clientX: event.clientX,
      clientY: event.clientY,
      frameWidth: frame.width,
      frameHeight: frame.height,
    });
  };

  const startTimelineDrag = (event: React.MouseEvent, clip: TimelineClip, mode: 'move' | 'start' | 'end') => {
    if (!trackRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedClipId(clip.id);
    setDragState({
      kind: 'timeline',
      mode,
      clipId: clip.id,
      clientX: event.clientX,
      startTime: clip.startTime,
      endTime: clip.endTime ?? clip.startTime + 0.1,
      trackWidth: trackRef.current.getBoundingClientRect().width,
    });
  };

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (event: MouseEvent) => {
      if (dragState.kind === 'overlay') {
        const dx = (event.clientX - dragState.clientX) / dragState.frameWidth;
        const dy = (event.clientY - dragState.clientY) / dragState.frameHeight;
        updateClip(dragState.clipId, (clip) => {
          const rect = dragState.mode === 'move'
            ? { ...dragState.rect, x: dragState.rect.x + dx, y: dragState.rect.y + dy }
            : { ...dragState.rect, width: dragState.rect.width + dx, height: dragState.rect.height + dy };
          return { ...clip, rect: clampOverlayRect(rect) } as TimelineClip;
        });
        return;
      }

      const delta = ((event.clientX - dragState.clientX) / Math.max(1, dragState.trackWidth)) * timelineDuration;
      const snap = event.altKey ? 0.01 : 0.1;
      updateClip(dragState.clipId, (clip) => {
        const length = Math.max(0.1, dragState.endTime - dragState.startTime);
        if (dragState.mode === 'move') {
          const nextStart = roundTimelineTime(Math.max(0, Math.min(timelineDuration - length, dragState.startTime + delta)), snap);
          return { ...clip, startTime: nextStart, endTime: roundTimelineTime(nextStart + length, snap) } as TimelineClip;
        }
        if (dragState.mode === 'start') {
          const nextStart = roundTimelineTime(Math.max(0, Math.min(dragState.endTime - 0.1, dragState.startTime + delta)), snap);
          return { ...clip, startTime: nextStart } as TimelineClip;
        }
        const nextEnd = roundTimelineTime(Math.max(dragState.startTime + 0.1, Math.min(timelineDuration, dragState.endTime + delta)), snap);
        return { ...clip, endTime: nextEnd } as TimelineClip;
      });
    };

    const handleMouseUp = () => setDragState(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, timelineDuration, updateClip]);

  const updateClipLabel = (value: string) => {
    if (!selectedClip) return;
    updateClip(selectedClip.id, (clip) => {
      if (clip.type === 'hotspot') return { ...clip, hint: value, name: value || clip.name };
      return { ...clip, label: value, name: value || clip.name } as TimelineClip;
    });
  };

  const updateClipAction = (value: string) => {
    if (!selectedClip) return;
    const action: TimelineAction = value === '__continue__'
      ? { type: 'continue' }
      : { type: 'goToHandle', handleId: value === '__default__' ? null : value };
    updateClip(selectedClip.id, (clip) => ({ ...clip, action } as TimelineClip));
  };

  const updateClipTime = (key: 'startTime' | 'endTime', value: number) => {
    if (!selectedClip) return;
    updateClip(selectedClip.id, (clip) => {
      if (key === 'startTime') {
        const nextStart = clampTimelineTime(Math.min(value, (clip.endTime ?? value + 0.1) - 0.1), timelineDuration);
        return { ...clip, startTime: nextStart } as TimelineClip;
      }
      const nextEnd = clampTimelineTime(Math.max(value, clip.startTime + 0.1), timelineDuration);
      return { ...clip, endTime: nextEnd } as TimelineClip;
    });
  };

  const updateClipRect = (key: keyof OverlayRect, value: number) => {
    if (!selectedClip) return;
    updateClip(selectedClip.id, (clip) => ({ ...clip, rect: clampOverlayRect({ ...getClipRect(clip), [key]: value }) } as TimelineClip));
  };

  const createBoundBranch = () => {
    if (!selectedNode || !selectedClip) return;
    const outgoingDefaultEdge = edges.some((edge) => edge.source === selectedNode.id && !edge.sourceHandle);
    const canAddCustomHandle = selectedNode.type === 'start' || selectedNode.type === 'interaction';
    if (!canAddCustomHandle && outgoingDefaultEdge) {
      alert('当前节点的默认出口已经连接。请先在右侧面板绑定现有出口。');
      return;
    }

    const handleId = canAddCustomHandle ? createTimelineId() : null;
    const label = getTimelineClipLabel(selectedClip);
    const branchNode = createEditorNode(
      'story',
      getAvailableNodePosition({ x: selectedNode.position.x + 430, y: selectedNode.position.y + 120 }, nodes),
      nodes,
      { startLabel: '开始', endLabel: '结束', storyTitlePrefix: '剧情节点' }
    );
    const branchWithTitle: AppNode = {
      ...branchNode,
      data: { ...branchNode.data, title: label || '剧情节点' } as AppNode['data'],
    };
    const nextClips = clips.map((clip) => (
      clip.id === selectedClip.id
        ? { ...clip, action: { type: 'goToHandle', handleId } } as TimelineClip
        : clip
    ));
    const nextTimeline = writeTimelineClips(selectedNode.data.timeline, nextClips, timelineDuration);
    const dataPatch = { timeline: nextTimeline } as Partial<AppNode['data']> & { rules?: InteractionRule[] };

    if (canAddCustomHandle) {
      const rules = ((selectedNode.data as { rules?: InteractionRule[] }).rules || []) as InteractionRule[];
      dataPatch.rules = [
        ...rules,
        {
          id: createTimelineId(),
          keyword: label,
          condition: label,
          handleId: handleId || createTimelineId(),
        },
      ] as any;
    }

    updateNodeData(selectedNode.id, dataPatch);
    addNodeAndConnect(branchWithTitle, {
      source: selectedNode.id,
      sourceHandle: handleId,
      target: branchWithTitle.id,
      targetHandle: null,
    });
    setSelectedClipId(selectedClip.id);
  };

  if (!selectedNode) {
    return (
      <section className="grid h-full place-items-center p-4 text-white">
        <div className="rounded-[18px] border border-dashed border-white/14 bg-white/[0.055] px-8 py-7 text-center shadow-[0_24px_90px_rgba(0,0,0,0.34)] backdrop-blur-3xl">
          <Layers className="mx-auto mb-3 text-openfmv-sub" size={28} />
          <div className="text-base font-semibold text-white">暂无可编辑节点</div>
          <p className="mt-2 text-sm leading-6 text-openfmv-muted">先在蓝图页创建节点，再回到节点页编辑视频内交互。</p>
          <Link href={blueprintHref} className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-white/10 bg-white/[0.08] px-4 text-sm font-semibold text-openfmv-sub transition hover:border-white/20 hover:bg-white/[0.12] hover:text-white">
            <GitBranch size={15} />
            打开蓝图页
          </Link>
        </div>
      </section>
    );
  }

  const action: TimelineAction = selectedClip ? getClipAction(selectedClip) : { type: 'continue' };
  const actionValue = action.type === 'goToHandle' ? (action.handleId ?? '__default__') : '__continue__';
  const actionConnected = action.type !== 'goToHandle' || sourceHandles.some((handle) => handle.id === (action.handleId ?? null) && handle.connected);
  const ticks = Array.from({ length: 6 }, (_, index) => (timelineDuration / 5) * index);

  return (
    <section className="grid h-full min-h-0 grid-cols-[282px_minmax(520px,1fr)_342px] grid-rows-[minmax(360px,1fr)_224px] gap-3 p-4 text-white">
      <aside className="row-span-2 grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.055]">
        <div className="border-b border-white/10 p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-openfmv-muted">Node Mode</div>
          <div className="mt-1 truncate text-sm font-semibold text-white">{getNodeTitle(selectedNode)}</div>
          <div className="mt-1 font-mono text-[11px] text-openfmv-muted">{hasVideo ? `${clips.length} clips · ${formatTime(timelineDuration)}` : '需要先绑定视频'}</div>
        </div>

        <div className="min-h-0 overflow-y-auto p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-openfmv-muted">Nodes</div>
          <div className="space-y-2">
            {timelineNodes.map((node, index) => (
              <button key={node.id} type="button" onClick={() => setSelectedNodeId(node.id)} className={`grid w-full grid-cols-[28px_1fr_auto] items-center gap-2 rounded-[12px] border px-2.5 py-2 text-left transition ${node.id === selectedNode.id ? 'border-orange-300/45 bg-orange-400/12' : 'border-white/8 bg-white/[0.035] hover:bg-white/[0.07]'}`}>
                <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-white/[0.08] text-xs font-bold text-openfmv-sub">{index + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-white">{getNodeTitle(node)}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-openfmv-muted">{node.data.video ? `${node.type} · video` : `${node.type} · no video`}</span>
                </span>
                <span className="font-mono text-[10px] text-openfmv-muted">{getTimelineClips(ensureNodeTimeline(node.data.timeline)).length}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-openfmv-muted">Interaction Kit</div>
          <div className="space-y-2">
            {CLIP_LIBRARY.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.type} type="button" draggable={hasVideo} disabled={!hasVideo} onDragStart={(event) => onLibraryDragStart(event, item.type)} onClick={() => addClip(item.type)} className="grid w-full grid-cols-[30px_1fr] items-center gap-2 rounded-[12px] border border-white/10 bg-white/[0.045] p-2 text-left transition hover:border-white/20 hover:bg-white/[0.075] disabled:cursor-not-allowed disabled:opacity-45">
                  <span className={`grid h-8 w-8 place-items-center rounded-[10px] text-white ${item.colorClass}`}><Icon size={15} /></span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-white">{item.label}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-openfmv-muted">{item.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <section className="grid min-h-0 grid-rows-[46px_minmax(0,1fr)_36px] overflow-hidden rounded-[18px] border border-white/10 bg-black/32">
        <header className="flex items-center justify-between border-b border-white/10 px-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{getNodeTitle(selectedNode)}</div>
            <div className="font-mono text-[11px] text-orange-200">{formatTime(playhead)} / {formatTime(timelineDuration)}</div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" disabled={!hasVideo} onClick={() => { if (!videoRef.current) return; if (videoRef.current.paused) { void videoRef.current.play(); setIsPlaying(true); } else { videoRef.current.pause(); setIsPlaying(false); } }} className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.09] text-openfmv-sub transition hover:bg-white/[0.14] hover:text-white disabled:cursor-not-allowed disabled:opacity-45">
              {isPlaying ? <PauseCircle size={16} /> : <Play size={15} fill="currentColor" />}
            </button>
            {CLIP_LIBRARY.map((item) => (
              (() => {
                const Icon = item.icon;
                return (
                  <button key={item.type} type="button" disabled={!hasVideo} onClick={() => addClip(item.type)} className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.08] text-openfmv-sub transition hover:border-white/20 hover:bg-white/[0.14] hover:text-white disabled:cursor-not-allowed disabled:opacity-45" title={item.label}>
                    <Icon size={15} />
                  </button>
                );
              })()
            ))}
          </div>
        </header>

        <div className="grid min-h-0 place-items-center p-4">
          {hasVideo ? (
            <div ref={frameRef} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }} onDrop={onPreviewDrop} className="relative aspect-video h-full max-h-full w-full max-w-[920px] overflow-hidden rounded-[14px] border border-white/15 bg-black shadow-[0_22px_70px_rgba(0,0,0,0.4)]">
              <OpenFMVVideo
                src={videoSrc}
                playerRef={videoRef}
                controls={false}
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-contain"
                onLoadedData={() => {
                  const nextDuration = videoRef.current?.duration;
                  if (Number.isFinite(nextDuration) && nextDuration && nextDuration > 0) {
                    setDuration(Number(nextDuration.toFixed(2)));
                    writeClips(clips, Number(nextDuration.toFixed(2)));
                  }
                }}
                onPlaying={() => setIsPlaying(true)}
                onEnded={() => setIsPlaying(false)}
              />
              <div className="pointer-events-none absolute inset-[7%] rounded-[8px] border border-dashed border-white/24" />
              {clips.map((clip) => {
                const rect = getClipRect(clip);
                const active = isTimelineClipActive(clip, playhead);
                const selected = selectedClip?.id === clip.id;
                return (
                  <button
                    key={clip.id}
                    type="button"
                    onMouseDown={(event) => startOverlayDrag(event, clip, 'move')}
                    onClick={() => setSelectedClipId(clip.id)}
                    className={`absolute flex min-h-8 min-w-12 items-center justify-center rounded-[10px] border px-2 text-xs font-bold shadow-[0_16px_42px_rgba(0,0,0,0.26)] transition ${getClipClassName(clip.type)} ${selected ? 'outline outline-2 outline-offset-2 outline-white/85' : ''} ${active || selected ? 'opacity-100' : 'opacity-45'}`}
                    style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%` }}
                  >
                    <span className="min-w-0 truncate">{getTimelineClipLabel(clip)}</span>
                    <span onMouseDown={(event) => startOverlayDrag(event, clip, 'resize')} className="absolute -bottom-1.5 -right-1.5 h-3 w-3 rounded-full border-2 border-white bg-current" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid aspect-video h-full max-h-full w-full max-w-[920px] place-items-center rounded-[14px] border border-dashed border-white/16 bg-black/36 text-center shadow-[0_22px_70px_rgba(0,0,0,0.32)]">
              <div className="max-w-sm px-6">
                <Film className="mx-auto mb-3 text-openfmv-sub" size={30} />
                <div className="text-base font-semibold text-white">当前节点还没有视频</div>
                <p className="mt-2 text-sm leading-6 text-openfmv-muted">节点内 Timeline 只编辑当前视频片段里的按钮、热点和暂停等待。</p>
                <button type="button" onClick={openAssetPickerForSelectedNode} className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-[12px] bg-orange-500 px-4 text-sm font-semibold text-white transition hover:bg-orange-400">
                  <Upload size={15} />
                  绑定视频素材
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-white/10 px-4 text-[11px] text-openfmv-muted">
          <span>{hasVideo ? '拖到画面：按当前播放头创建 clip' : '先绑定视频素材后启用画面拖放'}</span>
          <span>{hasVideo ? '拖到轨道：按落点时间创建 clip' : '节点页交互不会改变蓝图画布结构'}</span>
        </footer>
      </section>

      <aside className="row-span-2 grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.055]">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-openfmv-muted">Clip Inspector</div>
            <div className="mt-1 truncate text-sm font-semibold text-white">{selectedClip ? getTimelineClipLabel(selectedClip) : '未选择 clip'}</div>
            <div className="mt-1 font-mono text-[11px] text-openfmv-muted">{selectedClip ? `${selectedClip.startTime.toFixed(2)}s - ${(selectedClip.endTime ?? selectedClip.startTime).toFixed(2)}s` : '0 clips'}</div>
          </div>
          {selectedClip && <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-openfmv-sub">{getClipTypeLabel(selectedClip.type)}</span>}
        </header>

        <div className="min-h-0 overflow-y-auto p-4">
          {!hasVideo ? (
            <div className="grid h-full place-items-center rounded-[14px] border border-dashed border-white/12 text-center text-xs leading-5 text-openfmv-muted">
              <div className="max-w-[220px]">
                <Film className="mx-auto mb-2 text-openfmv-sub" size={18} />
                <div className="font-semibold text-white">没有可检查的 clip</div>
                <p className="mt-1">绑定视频后，可以在这里编辑文案、时间、位置和跳转出口。</p>
                <button type="button" onClick={openAssetPickerForSelectedNode} className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-[12px] border border-white/10 bg-white/[0.08] px-3 text-xs font-semibold text-white transition hover:bg-white/[0.12]">
                  <Upload size={13} />
                  绑定视频
                </button>
              </div>
            </div>
          ) : selectedClip ? (
            <div className="space-y-3">
              <div className={`rounded-[14px] border px-3 py-2 text-[11px] leading-5 ${actionConnected ? 'border-emerald-300/25 bg-emerald-400/8 text-emerald-100' : 'border-yellow-300/35 bg-yellow-300/8 text-yellow-100'}`}>
                {actionConnected ? '已绑定可用出口。' : '未找到对应出口，导出前需要绑定或创建分支。'}
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-openfmv-muted">文案</span>
                <input value={getTimelineClipLabel(selectedClip)} onChange={(event) => updateClipLabel(event.target.value)} className="nodrag h-10 w-full rounded-[14px] border border-white/12 bg-white/[0.06] px-3 text-xs text-white outline-none focus:border-orange-300/50" />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-openfmv-muted">开始</span>
                  <input type="number" step="0.1" min="0" value={selectedClip.startTime} onChange={(event) => updateClipTime('startTime', Number(event.target.value))} className="nodrag nowheel h-10 w-full rounded-[14px] border border-white/12 bg-white/[0.06] px-3 font-mono text-xs text-white outline-none focus:border-orange-300/50" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-openfmv-muted">结束</span>
                  <input type="number" step="0.1" min="0" value={selectedClip.endTime ?? selectedClip.startTime + 0.1} onChange={(event) => updateClipTime('endTime', Number(event.target.value))} className="nodrag nowheel h-10 w-full rounded-[14px] border border-white/12 bg-white/[0.06] px-3 font-mono text-xs text-white outline-none focus:border-orange-300/50" />
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-openfmv-muted">跳转</span>
                <select value={actionValue} onChange={(event) => updateClipAction(event.target.value)} className="nodrag h-10 w-full rounded-[14px] border border-white/12 bg-[#1c2230] px-3 text-xs text-white outline-none focus:border-orange-300/50">
                  <option value="__continue__">继续当前视频</option>
                  {sourceHandles.map((handle) => (
                    <option key={handle.id ?? '__default__'} value={handle.id ?? '__default__'}>{handle.label}{handle.connected ? '' : ' · 未连线'}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-4 gap-2">
                {(['x', 'y', 'width', 'height'] as const).map((key) => (
                  <label key={key} className="block">
                    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-openfmv-muted">{key}</span>
                    <input type="number" step="0.01" min="0" max="1" value={Number(getClipRect(selectedClip)[key].toFixed(2))} onChange={(event) => updateClipRect(key, Number(event.target.value))} className="nodrag nowheel h-10 w-full rounded-[14px] border border-white/12 bg-white/[0.06] px-2 font-mono text-[11px] text-white outline-none focus:border-orange-300/50" />
                  </label>
                ))}
              </div>

              {selectedClip.type !== 'pauseGate' && (
                <label className="flex h-10 items-center justify-between rounded-[14px] border border-white/10 bg-white/[0.045] px-3 text-xs font-semibold text-openfmv-sub">
                  <span>出现时暂停视频</span>
                  <input type="checkbox" checked={selectedClip.pauseOnShow} onChange={(event) => updateClip(selectedClip.id, (clip) => ({ ...clip, pauseOnShow: event.target.checked } as TimelineClip))} className="nodrag h-4 w-4 accent-orange-500" />
                </label>
              )}

              {selectedClip.type === 'hotspot' && (
                <label className="flex h-10 items-center justify-between rounded-[14px] border border-white/10 bg-white/[0.045] px-3 text-xs font-semibold text-openfmv-sub">
                  <span>显示提示</span>
                  <input type="checkbox" checked={selectedClip.showHint} onChange={(event) => updateClip(selectedClip.id, (clip) => ({ ...clip, showHint: event.target.checked } as TimelineClip))} className="nodrag h-4 w-4 accent-cyan-400" />
                </label>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button type="button" onClick={createBoundBranch} className="inline-flex h-10 items-center justify-center gap-2 rounded-[14px] bg-orange-500 px-3 text-xs font-semibold text-white transition hover:bg-orange-400">
                  <Plus size={14} />
                  创建分支
                </button>
                <button type="button" onClick={deleteSelectedClip} className="inline-flex h-10 items-center justify-center gap-2 rounded-[14px] border border-red-300/25 bg-red-500/8 px-3 text-xs font-semibold text-red-200 transition hover:bg-red-500/14">
                  <Trash2 size={14} />
                  删除
                </button>
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center rounded-[14px] border border-dashed border-white/12 text-center text-xs leading-5 text-openfmv-muted">
              <div>
                <Clock className="mx-auto mb-2 text-openfmv-sub" size={18} />
                从左侧交互库添加 clip。
              </div>
            </div>
          )}
        </div>
      </aside>

      <section className="col-span-1 grid min-h-0 grid-rows-[32px_1fr] overflow-hidden rounded-[18px] border border-white/10 bg-[#0b1019]">
        <header className="flex items-center justify-between border-b border-white/10 px-3">
          <div className="text-xs font-semibold text-white">节点内 Timeline</div>
          <div className="text-[10px] text-openfmv-muted">吸附 0.1s · Alt 精确到 0.01s</div>
        </header>
        <div className="grid min-h-0 grid-rows-[28px_32px_44px]">
          <div className="grid grid-cols-[132px_1fr] border-b border-white/8">
            <div className="flex items-center border-r border-white/8 px-3 text-[11px] font-semibold text-openfmv-muted">{formatTime(timelineDuration)}</div>
            <div className="relative">
              {ticks.map((tick) => (
                <span key={tick} className="absolute top-1 font-mono text-[10px] text-openfmv-muted" style={{ left: `${(tick / timelineDuration) * 100}%` }}>{formatTime(tick).slice(3, 8)}</span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[132px_1fr] border-b border-white/8">
            <div className="flex items-center gap-2 border-r border-white/8 px-3 text-[11px] font-semibold text-openfmv-sub"><Play size={12} />Video</div>
            <div className="flex items-center px-2">
              <div className="h-5 w-full truncate rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 font-mono text-[10px] text-openfmv-muted">{video || '未绑定视频'}</div>
            </div>
          </div>
          <div className="grid grid-cols-[132px_1fr]">
            <div className="flex items-center gap-2 border-r border-white/8 px-3 text-[11px] font-semibold text-openfmv-sub"><MousePointerClick size={12} />Interaction</div>
            <div
              ref={trackRef}
              onDragOver={(event) => { if (!hasVideo) return; event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
              onDrop={onTrackDrop}
              onMouseDown={(event) => {
                if (!hasVideo) return;
                if (event.target !== event.currentTarget || !trackRef.current) return;
                const rect = trackRef.current.getBoundingClientRect();
                setPlayhead(((event.clientX - rect.left) / rect.width) * timelineDuration);
              }}
              className={`relative bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:20%_100%] ${hasVideo ? '' : 'opacity-55'}`}
            >
              {hasVideo ? clips.map((clip) => {
                const endTime = clip.endTime ?? clip.startTime + 0.1;
                const left = (clip.startTime / timelineDuration) * 100;
                const width = Math.max(((endTime - clip.startTime) / timelineDuration) * 100, 2.2);
                const selected = selectedClip?.id === clip.id;
                const hasRoute = getClipAction(clip).type !== 'goToHandle' || sourceHandles.some((handle) => handle.id === (getClipAction(clip).handleId ?? null) && handle.connected);
                return (
                  <button
                    key={clip.id}
                    type="button"
                    onMouseDown={(event) => startTimelineDrag(event, clip, 'move')}
                    onClick={() => setSelectedClipId(clip.id)}
                    className={`absolute top-2 flex h-7 items-center justify-center overflow-hidden rounded-[10px] border px-2 text-[11px] font-bold shadow-[0_10px_28px_rgba(0,0,0,0.25)] ${getTimelineClipClassName(clip.type)} ${selected ? 'outline outline-2 outline-white/80' : ''} ${hasRoute ? '' : 'ring-2 ring-yellow-300/70'}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${getTimelineClipLabel(clip)} · ${formatTime(clip.startTime)}-${formatTime(endTime)}`}
                  >
                    <span onMouseDown={(event) => startTimelineDrag(event, clip, 'start')} className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-black/12" />
                    <span className="truncate">{getTimelineClipLabel(clip)}</span>
                    <span onMouseDown={(event) => startTimelineDrag(event, clip, 'end')} className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-black/12" />
                  </button>
                );
              }) : (
                <div className="absolute inset-0 grid place-items-center text-[11px] font-semibold text-openfmv-muted">绑定视频后启用交互轨道</div>
              )}
              <div className="pointer-events-none absolute bottom-0 top-0 w-px bg-orange-300 shadow-[0_0_16px_rgba(251,146,60,0.75)]" style={{ left: `${(playhead / timelineDuration) * 100}%` }} />
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
