'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Info, RotateCcw, X } from 'lucide-react';

import { getButtonClipInlineStyle, getTimelineQteDisplayName } from '@/app/_features/node-timeline';
import { useRuntimeSessionStore } from '@/app/_features/runtime-session/store';
import { useResolvedMediaSrc } from '../../_hooks/useResolvedMediaSrc';
import { usePlayerStore } from '../../_store/usePlayerStore';
import { AppNode, ButtonQteConfig, OverlayRect, TimelineInteractionClip } from '../../_types';
import OpenFMVVideo from '../video/OpenFMVVideo';
import { getRuntimeMediaPlaybackRate, shouldResetRuntimeTimelineTriggerState, shouldUseRuntimeTimelineIntervalClock } from './timelineClock';
import { getActiveTimelineClips, getTimelineClipEndTime, RuntimeEffect, RuntimeEvent } from '../../_utils/graphRuntime';

const getEffect = <T extends RuntimeEffect['type']>(effects: RuntimeEffect[], type: T) => {
  return effects.find((effect): effect is Extract<RuntimeEffect, { type: T }> => effect.type === type);
};

type PlayMediaEffect = Extract<RuntimeEffect, { type: 'playMedia' }>;
type VisualMediaEffect = Extract<PlayMediaEffect, { mediaType: 'video' | 'image' }>;
type AudioMediaEffect = Extract<PlayMediaEffect, { mediaType: 'audio' }>;

const DEFAULT_RUNTIME_STAGE_ASPECT_RATIO = 16 / 9;
const MIN_RUNTIME_STAGE_ASPECT_RATIO = 1 / 4;
const MAX_RUNTIME_STAGE_ASPECT_RATIO = 4;
const RUNTIME_TIMELINE_UPDATE_EPSILON = 0.02;
const RUNTIME_INTERACTION_PAUSE_EPSILON = 0.001;

const shouldDispatchTimelineTimeUpdate = (currentTime: number, nextTime: number) => (
  Number.isFinite(nextTime) && Math.abs(nextTime - currentTime) > RUNTIME_TIMELINE_UPDATE_EPSILON
);

const getNaturalMediaAspectRatio = (width: number, height: number) => {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return null;
  return Math.max(MIN_RUNTIME_STAGE_ASPECT_RATIO, Math.min(MAX_RUNTIME_STAGE_ASPECT_RATIO, width / height));
};

const getRuntimeStageStyle = (aspectRatio: number): React.CSSProperties => ({
  aspectRatio,
  width: `min(100vw, calc(100vh * ${aspectRatio}))`,
});

const getPlayMediaEffects = (effects: RuntimeEffect[]) => {
  return effects.filter((effect): effect is PlayMediaEffect => effect.type === 'playMedia');
};

const getVisualMediaEffects = (effects: RuntimeEffect[]) => {
  return getPlayMediaEffects(effects).filter((effect): effect is VisualMediaEffect => effect.mediaType === 'video' || effect.mediaType === 'image');
};

const getVisualMediaEffect = (effects: RuntimeEffect[]) => {
  return getPlayMediaEffects(effects).find((effect): effect is VisualMediaEffect => effect.mediaType === 'video' || effect.mediaType === 'image');
};

const getAudioMediaEffects = (effects: RuntimeEffect[]) => {
  return getPlayMediaEffects(effects).filter((effect): effect is AudioMediaEffect => effect.mediaType === 'audio');
};

const getTimelineClipRect = (clip: TimelineInteractionClip): OverlayRect => {
  if ('rect' in clip && clip.rect) return clip.rect;
  return { x: 0.38, y: 0.76, width: 0.24, height: 0.1 };
};

const getVisualMediaRect = (effect?: VisualMediaEffect | null): OverlayRect => {
  return effect?.rect || { x: 0, y: 0, width: 1, height: 1 };
};

const getVisualMediaFitClassName = (effect?: VisualMediaEffect | null) => {
  const fit = effect?.fit || 'contain';
  return `h-full w-full ${fit === 'cover' ? 'object-cover' : 'object-contain'}`;
};

const getClipOpacity = (clip?: { opacity?: number } | null) => {
  const opacity = Number(clip?.opacity);
  return Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1;
};

const getClipRotation = (clip?: { rotation?: number } | null) => {
  const rotation = Number(clip?.rotation);
  return Number.isFinite(rotation) ? rotation : 0;
};

const getMediaPlaybackRate = (effect?: { playbackRate?: number } | null) => {
  return getRuntimeMediaPlaybackRate(effect);
};

const getMediaSourceEnd = (effect?: { sourceStart?: number; sourceDuration?: number } | null) => {
  const sourceDuration = Number(effect?.sourceDuration);
  if (!Number.isFinite(sourceDuration) || sourceDuration <= 0) return null;
  return Math.max(0, Number(effect?.sourceStart) || 0) + sourceDuration;
};

const applyMediaPlaybackOptions = (element: HTMLMediaElement, effect: { playbackRate?: number; preservePitch?: boolean }) => {
  element.playbackRate = getMediaPlaybackRate(effect);
  if ('preservesPitch' in element) element.preservesPitch = effect.preservePitch !== false;
};

const assignVideoRef = (ref: React.Ref<HTMLVideoElement> | undefined, value: HTMLVideoElement | null) => {
  if (!ref) return;
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  (ref as React.MutableRefObject<HTMLVideoElement | null>).current = value;
};

const getTimelineClipLabel = (clip: TimelineInteractionClip) => {
  return typeof clip.label === 'string' ? clip.label : clip.name || 'Continue';
};

const isQteButtonClip = (clip: TimelineInteractionClip) => {
  return clip.type === 'button' && clip.mode === 'qte';
};

const normalizeQteKeyToken = (value: string | undefined) => {
  if (value === ' ') return 'space';
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, '') || '';
  if (normalized === 'spacebar') return 'space';
  if (normalized === 'esc') return 'escape';
  return normalized;
};

const getQteClickCount = (config: ButtonQteConfig) => {
  const count = Number(config.clickCount);
  if (!Number.isFinite(count)) return 1;
  return Math.max(1, Math.min(20, Math.round(count)));
};

const getQteInputLabel = (config: ButtonQteConfig) => (
  config.input === 'space' ? config.keyLabel || 'Space' : getQteClickCount(config) > 1 ? `Click x${getQteClickCount(config)}` : 'Click'
);

const getQteCueLabel = (config: ButtonQteConfig, completedClicks = 0) => {
  if (config.input === 'space') return config.keyLabel || 'Space';
  const clickCount = getQteClickCount(config);
  if (clickCount <= 1) return null;
  return completedClicks > 0 ? `${Math.min(completedClicks, clickCount)}/${clickCount}` : `x${clickCount}`;
};

const doesKeyboardEventMatchQte = (event: KeyboardEvent, config: ButtonQteConfig) => {
  if (config.input !== 'space') return false;
  const expected = normalizeQteKeyToken(config.keyLabel || 'Space');
  const codeAlias = event.code.startsWith('Key')
    ? event.code.slice('Key'.length)
    : event.code.startsWith('Digit')
      ? event.code.slice('Digit'.length)
      : event.code;
  return [event.key, event.code, codeAlias, event.key === ' ' ? 'Space' : undefined]
    .some((candidate) => normalizeQteKeyToken(candidate) === expected);
};

const getQteConfig = (clip: TimelineInteractionClip): ButtonQteConfig => {
  const input = clip.qte?.input === 'space' ? 'space' : 'click';
  return {
    input,
    prompt: clip.qte?.prompt,
    clickCount: clip.qte?.clickCount,
    keyLabel: input === 'space' ? (clip.qte?.keyLabel && clip.qte.keyLabel !== 'Click' ? clip.qte.keyLabel : 'Space') : 'Click',
    showCountdown: clip.qte?.showCountdown !== false,
    showCueLabel: clip.qte?.showCueLabel !== false,
  };
};

const getTimelineClipClassName = (clip: TimelineInteractionClip) => {
  const base = 'pointer-events-auto absolute flex min-h-10 min-w-12 items-center justify-center overflow-hidden border px-3 text-xs font-bold backdrop-blur-xl transition hover:scale-[1.02]';
  return isQteButtonClip(clip) ? `${base} select-none` : base;
};

const isTextEditingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
};

function RuntimeVisualMediaLayer({
  effect,
  sceneTitle,
  playerRef,
  onAspectRatioReady,
  timelineTime,
  paused,
}: {
  effect: VisualMediaEffect;
  sceneTitle?: string;
  playerRef?: React.Ref<HTMLVideoElement>;
  onAspectRatioReady?: (aspectRatio: number) => void;
  timelineTime: number;
  paused: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageSrc = useResolvedMediaSrc(effect.mediaType === 'image' ? effect.src : undefined);
  const rect = getVisualMediaRect(effect);
  const freezeFrameTime = effect.mediaType === 'video' && Number.isFinite(Number(effect.freezeFrameTime)) ? Math.max(0, Number(effect.freezeFrameTime)) : null;
  const playbackRate = effect.mediaType === 'video' ? getMediaPlaybackRate(effect) : 1;
  const sourceStart = effect.mediaType === 'video' ? effect.sourceStart || 0 : 0;
  const timelineStart = effect.timelineStartTime || 0;
  const sourceEnd = effect.mediaType === 'video' ? getMediaSourceEnd(effect) : null;
  const unclampedTargetTime = Math.max(0, sourceStart + Math.max(0, timelineTime - timelineStart) * playbackRate);
  const targetTime = freezeFrameTime ?? (sourceEnd === null ? unclampedTargetTime : Math.min(unclampedTargetTime, sourceEnd));
  const sourceEnded = sourceEnd !== null && targetTime >= sourceEnd;
  const reportNaturalSize = useCallback((width: number, height: number) => {
    const aspectRatio = getNaturalMediaAspectRatio(width, height);
    if (aspectRatio) onAspectRatioReady?.(aspectRatio);
  }, [onAspectRatioReady]);

  const setVideoRef = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    assignVideoRef(playerRef, element);
  }, [playerRef]);

  useEffect(() => {
    if (effect.mediaType !== 'video') return;
    const video = videoRef.current;
    if (!video) return;
    applyMediaPlaybackOptions(video, effect);

    const syncTargetTime = () => {
      if (Number.isFinite(targetTime) && Math.abs(video.currentTime - targetTime) > 0.25) {
        video.currentTime = targetTime;
      }
    };

    if (video.readyState >= 1) syncTargetTime();

    if (paused || freezeFrameTime !== null || sourceEnded) {
      video.pause();
    } else {
      void video.play().catch(() => undefined);
    }

    video.addEventListener('loadedmetadata', syncTargetTime, { once: true });
    return () => video.removeEventListener('loadedmetadata', syncTargetTime);
  }, [effect, freezeFrameTime, paused, sourceEnded, targetTime]);

  useEffect(() => {
    if (effect.mediaType !== 'video' || !onAspectRatioReady) return;
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
  }, [effect.mediaType, effect.src, onAspectRatioReady, reportNaturalSize]);

  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: `${rect.width * 100}%`,
        height: `${rect.height * 100}%`,
        opacity: getClipOpacity(effect),
        transform: `rotate(${getClipRotation(effect)}deg)`,
        transformOrigin: 'center',
      }}
    >
      {effect.mediaType === 'image' ? (
        <img src={imageSrc} alt={sceneTitle || ''} className={getVisualMediaFitClassName(effect)} onLoad={(event) => reportNaturalSize(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)} />
      ) : (
        <OpenFMVVideo src={effect.src} playbackId={effect.playbackId} poster={effect.poster} autoPlay muted={effect.muted} playsInline controls={false} className={getVisualMediaFitClassName(effect)} playerRef={setVideoRef} />
      )}
    </div>
  );
}

function RuntimeAudioMediaLayer({
  effect,
  timelineTime,
  paused,
}: {
  effect: AudioMediaEffect;
  timelineTime: number;
  paused: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioSrc = useResolvedMediaSrc(effect.src);
  const playbackRate = getMediaPlaybackRate(effect);
  const sourceStart = effect.sourceStart || 0;
  const timelineStart = effect.timelineStartTime || 0;
  const sourceEnd = getMediaSourceEnd(effect);
  const unclampedTargetTime = Math.max(0, sourceStart + Math.max(0, timelineTime - timelineStart) * playbackRate);
  const targetTime = sourceEnd === null ? unclampedTargetTime : Math.min(unclampedTargetTime, sourceEnd);
  const sourceEnded = sourceEnd !== null && targetTime >= sourceEnd;
  const volume = Math.max(0, Math.min(1, effect.volume ?? 1));

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;
    audio.volume = volume;
    applyMediaPlaybackOptions(audio, effect);

    const syncTargetTime = () => {
      if (Number.isFinite(targetTime) && Math.abs(audio.currentTime - targetTime) > 0.25) {
        audio.currentTime = targetTime;
      }
    };

    if (audio.readyState >= 1) syncTargetTime();

    if (paused || sourceEnded) {
      audio.pause();
    } else {
      void audio.play().catch(() => undefined);
    }

    audio.addEventListener('loadedmetadata', syncTargetTime, { once: true });
    return () => audio.removeEventListener('loadedmetadata', syncTargetTime);
  }, [audioSrc, effect, paused, sourceEnded, targetTime, volume]);

  if (effect.muted) return null;

  return <audio ref={audioRef} src={audioSrc} autoPlay className="hidden" />;
}

const TimelineRuntimeOverlay = ({
  currentNode,
  timelineEffect,
  currentTime,
  videoRef,
  onPauseTimeline,
  onResumeTimeline,
  dispatch,
}: {
  currentNode: AppNode | null;
  timelineEffect?: Extract<RuntimeEffect, { type: 'timelineOverlay' }>;
  currentTime: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onPauseTimeline: () => void;
  onResumeTimeline: () => void;
  dispatch: (event: RuntimeEvent) => void;
}) => {
  const shownClipIdsRef = useRef<Set<string>>(new Set());
  const timedOutClipIdsRef = useRef<Set<string>>(new Set());
  const resolvedQteClipIdsRef = useRef<Set<string>>(new Set());
  const qteStartedAtRef = useRef<Map<string, number>>(new Map());
  const qteClickCountsRef = useRef<Map<string, number>>(new Map());
  const triggerStateRef = useRef<{ nodeId?: string | null; time: number }>({ nodeId: null, time: 0 });
  const [qteClockTick, setQteClockTick] = useState(0);
  const runtimeNodeId = timelineEffect?.nodeId ?? currentNode?.id ?? null;

  useEffect(() => {
    const nextNodeId = timelineEffect?.nodeId ?? currentNode?.id ?? null;
    if (shouldResetRuntimeTimelineTriggerState({
      previousNodeId: triggerStateRef.current.nodeId,
      nextNodeId,
      previousTime: triggerStateRef.current.time,
      nextTime: currentTime,
    })) {
      shownClipIdsRef.current = new Set();
      timedOutClipIdsRef.current = new Set();
      resolvedQteClipIdsRef.current = new Set();
      qteStartedAtRef.current = new Map();
      qteClickCountsRef.current = new Map();
    }
    triggerStateRef.current = { nodeId: nextNodeId, time: currentTime };
  }, [currentNode?.id, currentTime, timelineEffect?.nodeId]);

  const activeClips = useMemo(() => (
    currentNode && timelineEffect ? getActiveTimelineClips(currentNode, currentTime) : []
  ), [currentNode, currentTime, timelineEffect]);

  const visibleActiveClips = activeClips.filter((clip) => !isQteButtonClip(clip) || !resolvedQteClipIdsRef.current.has(clip.id));
  const activeQteClips = activeClips.filter((clip) => isQteButtonClip(clip) && !resolvedQteClipIdsRef.current.has(clip.id));

  const completeQteClip = useCallback((clip: TimelineInteractionClip, reason: 'success' | 'timeout') => {
    if (!isQteButtonClip(clip) || resolvedQteClipIdsRef.current.has(clip.id)) return;
    resolvedQteClipIdsRef.current.add(clip.id);
    qteClickCountsRef.current.delete(clip.id);
    setQteClockTick(window.performance.now());

    if (reason === 'timeout') timedOutClipIdsRef.current.add(clip.id);
    dispatch({ type: reason === 'timeout' ? 'timeline.clip.timeout' : 'timeline.clip.triggered', clipId: clip.id, nodeId: runtimeNodeId });
  }, [dispatch, runtimeNodeId]);

  useEffect(() => {
    const video = videoRef.current;

    activeClips.forEach((clip) => {
      if (shownClipIdsRef.current.has(clip.id)) return;
      if (clip.pauseOnShow && isQteButtonClip(clip)) {
        shownClipIdsRef.current.add(clip.id);
        video?.pause();
        onPauseTimeline();
      }
    });
  }, [activeClips, onPauseTimeline, videoRef]);

  useEffect(() => {
    if (!timelineEffect) return;
    const video = videoRef.current;
    timelineEffect.clips.forEach((clip) => {
      if (isQteButtonClip(clip) || clip.type !== 'button' || !clip.pauseOnShow || shownClipIdsRef.current.has(clip.id)) return;
      const endTime = getTimelineClipEndTime(clip);
      if (currentTime < endTime - RUNTIME_INTERACTION_PAUSE_EPSILON) return;
      shownClipIdsRef.current.add(clip.id);
      dispatch({ type: 'timeline.time.update', time: Math.max(clip.startTime, endTime - RUNTIME_INTERACTION_PAUSE_EPSILON), nodeId: runtimeNodeId });
      video?.pause();
      onPauseTimeline();
    });
  }, [currentTime, dispatch, onPauseTimeline, runtimeNodeId, timelineEffect, videoRef]);

  useEffect(() => {
    if (activeQteClips.length === 0) return;
    const now = window.performance.now();
    const activeQteClipIds = new Set(activeQteClips.map((clip) => clip.id));
    activeQteClips.forEach((clip) => {
      if (!qteStartedAtRef.current.has(clip.id)) qteStartedAtRef.current.set(clip.id, now);
    });
    qteStartedAtRef.current.forEach((_startedAt, clipId) => {
      if (!activeQteClipIds.has(clipId)) qteStartedAtRef.current.delete(clipId);
    });
    qteClickCountsRef.current.forEach((_count, clipId) => {
      if (!activeQteClipIds.has(clipId)) qteClickCountsRef.current.delete(clipId);
    });
  }, [activeQteClips]);

  const clickQteClip = useCallback((clip: TimelineInteractionClip) => {
    const qteConfig = getQteConfig(clip);
    const clickCount = getQteClickCount(qteConfig);
    const nextCount = (qteClickCountsRef.current.get(clip.id) ?? 0) + 1;
    qteClickCountsRef.current.set(clip.id, nextCount);
    setQteClockTick(window.performance.now());
    if (nextCount >= clickCount) completeQteClip(clip, 'success');
  }, [completeQteClip]);

  useEffect(() => {
    if (activeQteClips.length === 0) return;
    const timers = activeQteClips.map((clip) => {
      const startedAt = qteStartedAtRef.current.get(clip.id) ?? window.performance.now();
      const durationMs = Math.max(0, clip.duration * 1000);
      const remainingMs = Math.max(0, startedAt + durationMs - window.performance.now());
      return window.setTimeout(() => completeQteClip(clip, 'timeout'), remainingMs);
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [activeQteClips, completeQteClip]);

  useEffect(() => {
    if (!activeQteClips.some((clip) => getQteConfig(clip).showCountdown !== false)) return;
    const timer = window.setInterval(() => setQteClockTick(window.performance.now()), 100);
    return () => window.clearInterval(timer);
  }, [activeQteClips]);

  const activeKeyboardQteClips = useMemo(() => (
    activeQteClips.filter((clip) => getQteConfig(clip).input === 'space')
  ), [activeQteClips]);

  useEffect(() => {
    if (activeKeyboardQteClips.length === 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextEditingTarget(event.target)) return;
      const clip = activeKeyboardQteClips.find((item) => doesKeyboardEventMatchQte(event, getQteConfig(item)));
      if (!clip) return;
      event.preventDefault();
      completeQteClip(clip, 'success');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeKeyboardQteClips, completeQteClip]);

  useEffect(() => {
    if (!timelineEffect) return;
    timelineEffect.clips.forEach((clip) => {
      const endTime = getTimelineClipEndTime(clip);
      if (isQteButtonClip(clip) || currentTime < endTime || timedOutClipIdsRef.current.has(clip.id)) return;
      timedOutClipIdsRef.current.add(clip.id);
      dispatch({ type: 'timeline.clip.timeout', clipId: clip.id, nodeId: runtimeNodeId });
    });
  }, [currentTime, dispatch, runtimeNodeId, timelineEffect]);

  if (!timelineEffect || !currentNode || visibleActiveClips.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20" data-openfmv-runtime-overlay>
      {visibleActiveClips.map((clip) => {
        const rect = getTimelineClipRect(clip);
        const isQte = isQteButtonClip(clip);
        const qteConfig = getQteConfig(clip);
        const label = getTimelineClipLabel(clip);
        const qteStartedAt = qteStartedAtRef.current.get(clip.id);
        const qteCompletedClicks = qteClickCountsRef.current.get(clip.id) ?? 0;
        const qteCueLabel = isQte && qteConfig.showCueLabel !== false ? getQteCueLabel(qteConfig, qteCompletedClicks) : null;
        const qteDurationMs = Math.max(1, clip.duration * 1000);
        const qteNow = qteClockTick || (typeof window !== 'undefined' ? window.performance.now() : qteStartedAt || 0);
        const qteRemainingRatio = qteStartedAt
          ? Math.max(0, Math.min(1, 1 - (qteNow - qteStartedAt) / qteDurationMs))
          : 1;

        return (
          <button
            key={clip.id}
            type="button"
            onClick={() => {
              if (isQte) {
                if (qteConfig.input !== 'click') return;
                clickQteClip(clip);
                return;
              }
              dispatch({ type: 'timeline.clip.triggered', clipId: clip.id, nodeId: runtimeNodeId });
            }}
            className={getTimelineClipClassName(clip)}
            data-qte-input={isQte ? qteConfig.input : undefined}
            style={{
              ...getButtonClipInlineStyle(clip),
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.width * 100}%`,
              height: `${rect.height * 100}%`,
              opacity: getClipOpacity(clip),
              transform: `rotate(${getClipRotation(clip)}deg)`,
              transformOrigin: 'center',
            }}
          >
            {isQte ? (
              <>
                <span className="flex min-w-0 max-w-full flex-col items-center justify-center gap-0.5 text-center leading-tight">
                  {qteCueLabel && (
                    <span className="block max-w-full truncate font-mono text-[10px] font-semibold leading-none text-white/75">
                      {qteCueLabel}
                    </span>
                  )}
                  <span className="block max-w-full truncate">{getTimelineQteDisplayName(clip)}</span>
                </span>
                {qteConfig.showCountdown !== false && (
                  <span className="absolute bottom-1 left-2 right-2 h-1 overflow-hidden rounded-full bg-white/18">
                    <span className="block h-full rounded-full bg-white" style={{ width: `${qteRemainingRatio * 100}%` }} />
                  </span>
                )}
              </>
            ) : (
              <span className="truncate">{label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

const ContinueControl = ({ effects, dispatch }: { effects: RuntimeEffect[]; dispatch: (event: RuntimeEvent) => void }) => {
  const t = useTranslations('player');
  const continueEffect = getEffect(effects, 'showContinue');

  if (!continueEffect) return null;

  return (
    <button onClick={() => dispatch({ type: 'navigate', nodeId: continueEffect.targetNodeId })} className="inline-flex items-center gap-2 rounded-full bg-openfmv-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-openfmv-accent-hover">
      {t('continue')}
      <ArrowRight size={16} />
    </button>
  );
};

export default function PlayerOverlay() {
  const t = useTranslations('player');
  const { isPlaying, setIsPlaying, reset } = usePlayerStore();
  const snapshot = useRuntimeSessionStore((state) => state.snapshot);
  const dispatchRuntimeEvent = useRuntimeSessionStore((state) => state.dispatch);
  const stopRuntimeSession = useRuntimeSessionStore((state) => state.stop);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timelineTimeRef = useRef(0);
  const [isTimelineClockPaused, setIsTimelineClockPaused] = useState(false);
  const [isSceneInfoOpen, setIsSceneInfoOpen] = useState(false);
  const effects = snapshot?.effects || [];
  const currentNode = snapshot?.currentNode ?? null;
  const currentNodeId = currentNode?.id ?? null;
  const sceneEffect = getEffect(effects, 'scene');
  const sceneInfoType = sceneEffect?.nodeType || snapshot?.status || '';
  const sceneInfoTitle = sceneEffect?.title || t('playEnded');
  const sceneInfoText = sceneEffect?.text || '';
  const hasSceneInfo = Boolean(sceneInfoType || sceneInfoTitle || sceneInfoText);
  const visualMediaEffects = getVisualMediaEffects(effects);
  const visualMediaEffect = visualMediaEffects.at(-1) ?? getVisualMediaEffect(effects);
  const stageReferenceVisualMediaEffect = visualMediaEffects[0] ?? null;
  const timelineSyncVideoEffect = visualMediaEffects.filter((effect) => effect.mediaType === 'video').at(-1) ?? null;
  const audioMediaEffects = getAudioMediaEffects(effects);
  const audioMediaEffect = audioMediaEffects.at(-1) ?? null;
  const autoNavigateEffect = getEffect(effects, 'autoNavigate');
  const timelinePlaybackEffect = getEffect(effects, 'timelinePlayback');
  const timelineEffect = getEffect(effects, 'timelineOverlay');
  const hasTimelinePlaybackEffect = Boolean(timelinePlaybackEffect);
  const hasTimelineSyncVideoEffect = Boolean(timelineSyncVideoEffect);
  const autoNavigateTargetNodeId = autoNavigateEffect?.targetNodeId ?? null;
  const timelineTime = snapshot?.timelineTime ?? 0;
  const snapshotStatus = snapshot?.status;
  const timelineDuration = timelinePlaybackEffect?.duration ?? timelineEffect?.duration ?? visualMediaEffect?.timelineDuration ?? audioMediaEffect?.timelineDuration ?? 0;
  const activeVideoTimelineStart = timelineSyncVideoEffect?.timelineStartTime || 0;
  const activeVideoSourceStart = timelineSyncVideoEffect?.sourceStart || 0;
  const activeVideoPlaybackRate = timelineSyncVideoEffect ? getMediaPlaybackRate(timelineSyncVideoEffect) : 1;
  const activeVideoFreezeFrameTime = timelineSyncVideoEffect && Number.isFinite(Number(timelineSyncVideoEffect.freezeFrameTime)) ? Math.max(0, Number(timelineSyncVideoEffect.freezeFrameTime)) : null;
  const activeVideoSrc = timelineSyncVideoEffect?.src;
  const shouldUseTimelineIntervalClock = shouldUseRuntimeTimelineIntervalClock({ timelineSyncVideoEffect, timelineTime });
  const [runtimeStageAspectRatio, setRuntimeStageAspectRatio] = useState(DEFAULT_RUNTIME_STAGE_ASPECT_RATIO);
  const runtimeStageStyle = useMemo(() => getRuntimeStageStyle(runtimeStageAspectRatio), [runtimeStageAspectRatio]);
  const handleRuntimeStageAspectRatioReady = useCallback((nextAspectRatio: number) => {
    setRuntimeStageAspectRatio((currentAspectRatio) => (
      Math.abs(currentAspectRatio - nextAspectRatio) <= 0.001 ? currentAspectRatio : nextAspectRatio
    ));
  }, []);

  useEffect(() => {
    if (!isPlaying) stopRuntimeSession();
  }, [isPlaying, stopRuntimeSession]);

  const closePlayer = () => {
    stopRuntimeSession();
    reset();
    setIsPlaying(false);
  };

  const dispatch = useCallback((event: RuntimeEvent) => {
    if (event.type === 'timeline.time.update' && !shouldDispatchTimelineTimeUpdate(timelineTimeRef.current, event.time)) return;
    const nextSnapshot = dispatchRuntimeEvent(event);
    if (nextSnapshot) {
      timelineTimeRef.current = nextSnapshot.timelineTime;
    }
  }, [dispatchRuntimeEvent]);

  useEffect(() => {
    timelineTimeRef.current = timelineTime;
  }, [timelineTime]);

  useLayoutEffect(() => {
    if (!autoNavigateTargetNodeId || snapshotStatus !== 'running') return;
    dispatch({ type: 'navigate', nodeId: autoNavigateTargetNodeId });
  }, [autoNavigateTargetNodeId, dispatch, snapshotStatus]);

  useEffect(() => {
    setIsTimelineClockPaused(false);
    setIsSceneInfoOpen(false);
  }, [currentNodeId]);

  useEffect(() => {
    if (stageReferenceVisualMediaEffect) return;
    setRuntimeStageAspectRatio(DEFAULT_RUNTIME_STAGE_ASPECT_RATIO);
  }, [stageReferenceVisualMediaEffect]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !timelineSyncVideoEffect) return;
    applyMediaPlaybackOptions(video, timelineSyncVideoEffect);
    const sourceTime = activeVideoFreezeFrameTime ?? activeVideoSourceStart;
    if (sourceTime > 0) {
      const syncSourceStart = () => {
        if (Math.abs(video.currentTime - sourceTime) > 0.25) video.currentTime = sourceTime;
      };
      if (video.readyState >= 1) syncSourceStart();
      video.addEventListener('loadedmetadata', syncSourceStart, { once: true });
      return () => video.removeEventListener('loadedmetadata', syncSourceStart);
    }
  }, [activeVideoFreezeFrameTime, activeVideoPlaybackRate, activeVideoSourceStart, activeVideoSrc, timelineSyncVideoEffect]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasTimelinePlaybackEffect || !hasTimelineSyncVideoEffect || shouldUseTimelineIntervalClock) return;
    const syncTimelineTime = () => {
      const nextTime = activeVideoTimelineStart + Math.max(0, (video.currentTime || 0) - activeVideoSourceStart) / activeVideoPlaybackRate;
      if (shouldDispatchTimelineTimeUpdate(timelineTimeRef.current, nextTime)) {
        dispatch({ type: 'timeline.time.update', time: nextTime, nodeId: currentNodeId });
      }
    };
    syncTimelineTime();
    video.addEventListener('timeupdate', syncTimelineTime);
    video.addEventListener('seeked', syncTimelineTime);
    video.addEventListener('loadedmetadata', syncTimelineTime);
    return () => {
      video.removeEventListener('timeupdate', syncTimelineTime);
      video.removeEventListener('seeked', syncTimelineTime);
      video.removeEventListener('loadedmetadata', syncTimelineTime);
    };
  }, [activeVideoPlaybackRate, activeVideoSourceStart, activeVideoTimelineStart, activeVideoSrc, currentNodeId, dispatch, hasTimelinePlaybackEffect, hasTimelineSyncVideoEffect, shouldUseTimelineIntervalClock]);

  useEffect(() => {
    if (!hasTimelinePlaybackEffect || snapshotStatus !== 'running' || isTimelineClockPaused || !shouldUseTimelineIntervalClock) return;
    const timer = window.setInterval(() => {
      const nextTime = timelineDuration > 0
        ? Math.min(timelineDuration, timelineTimeRef.current + 0.1)
        : timelineTimeRef.current + 0.1;
      if (shouldDispatchTimelineTimeUpdate(timelineTimeRef.current, nextTime)) {
        dispatch({ type: 'timeline.time.update', time: nextTime, nodeId: currentNodeId });
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [currentNodeId, dispatch, hasTimelinePlaybackEffect, isTimelineClockPaused, shouldUseTimelineIntervalClock, snapshotStatus, timelineDuration]);

  if (!isPlaying || !snapshot) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[linear-gradient(135deg,#090b10,#15110d)] text-white">
      <div className="absolute left-4 top-4 z-50 flex items-center gap-2">
        <button type="button" onClick={closePlayer} className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.11] px-4 py-2 text-sm font-medium text-white/85 backdrop-blur-3xl transition hover:border-openfmv-accent/70 hover:text-white"><X size={16} />{t('exit')}</button>
        <button type="button" onClick={() => dispatch({ type: 'restart' })} className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.11] px-4 py-2 text-sm font-medium text-white/85 backdrop-blur-3xl transition hover:border-openfmv-accent/70 hover:text-white"><RotateCcw size={16} />{t('replay')}</button>
        {hasSceneInfo && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSceneInfoOpen((value) => !value)}
              aria-expanded={isSceneInfoOpen}
              aria-label="Info"
              title="Info"
              className={`grid h-10 w-10 place-items-center rounded-full border text-white/85 backdrop-blur-3xl transition hover:border-openfmv-accent/70 hover:text-white ${isSceneInfoOpen ? 'border-openfmv-accent/70 bg-white/[0.16]' : 'border-white/15 bg-white/[0.11]'}`}
            >
              <Info size={17} />
            </button>
            {isSceneInfoOpen && (
              <div className="absolute left-0 top-12 w-80 max-w-[calc(100vw-2rem)] rounded-openfmv-card border border-white/15 bg-black/[0.78] p-4 text-white shadow-[0_18px_56px_rgba(0,0,0,0.48)] backdrop-blur-3xl">
                {sceneInfoType && <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-openfmv-accent">{sceneInfoType}</div>}
                <h1 className="text-xl font-semibold leading-tight tracking-tight">{sceneInfoTitle}</h1>
                {sceneInfoText && <p className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-white/[0.78]">{sceneInfoText}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="absolute inset-0 grid place-items-center bg-black">
        <div
          className="relative max-h-screen max-w-screen overflow-hidden bg-black"
          data-openfmv-runtime-stage
          style={runtimeStageStyle}
        >
          {visualMediaEffects.length > 0 ? (
            visualMediaEffects.map((effect, index) => (
              <RuntimeVisualMediaLayer
                key={`${currentNodeId ?? 'node'}-${effect.src}-${effect.timelineStartTime ?? 0}-${index}`}
                effect={effect}
                sceneTitle={sceneEffect?.title}
                onAspectRatioReady={effect === stageReferenceVisualMediaEffect ? handleRuntimeStageAspectRatioReady : undefined}
                playerRef={effect === timelineSyncVideoEffect ? videoRef : undefined}
                timelineTime={timelineTime}
                paused={snapshotStatus !== 'running' || isTimelineClockPaused}
              />
            ))
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_50%_24%,rgba(249,115,22,0.22),transparent_34%),radial-gradient(circle_at_78%_12%,rgba(255,255,255,0.09),transparent_30%),linear-gradient(135deg,#151821,#070a10_62%,#17120f)]" />
          )}
          <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-black/62 via-black/18 to-black/88" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/2 bg-[radial-gradient(circle_at_50%_100%,rgba(249,115,22,0.15),transparent_45%)]" />
          {timelineEffect && (
            <TimelineRuntimeOverlay
              currentNode={currentNode}
              timelineEffect={timelineEffect}
              currentTime={timelineTime}
              videoRef={videoRef}
              onPauseTimeline={() => setIsTimelineClockPaused(true)}
              onResumeTimeline={() => setIsTimelineClockPaused(false)}
              dispatch={dispatch}
            />
          )}
        </div>
        {audioMediaEffects.map((effect, index) => (
          <RuntimeAudioMediaLayer
            key={`${currentNodeId ?? 'node'}-${effect.src}-${effect.timelineStartTime ?? 0}-${effect.sourceStart ?? 0}-${index}`}
            effect={effect}
            timelineTime={timelineTime}
            paused={snapshotStatus !== 'running' || isTimelineClockPaused}
          />
        ))}
      </div>

      <div className="relative z-10 flex min-h-full flex-col justify-end px-5 py-8 md:px-12 md:py-12">
        <div className="mx-auto w-full max-w-5xl">
          {snapshot.status === 'ended' || currentNode?.type === 'end' ? (
            <button type="button" onClick={() => dispatch({ type: 'restart' })} className="inline-flex items-center gap-2 rounded-full bg-openfmv-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-openfmv-accent-hover"><RotateCcw size={16} />{t('restart')}</button>
          ) : (
            <ContinueControl effects={effects} dispatch={dispatch} />
          )}
        </div>
      </div>
    </div>
  );
}



