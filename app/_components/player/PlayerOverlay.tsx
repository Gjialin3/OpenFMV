'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, RotateCcw, X } from 'lucide-react';
import { useResolvedMediaSrc } from '../../_hooks/useResolvedMediaSrc';
import { usePlayerStore } from '../../_store/usePlayerStore';
import { useRuntimeGraphStore } from '../../_store/useRuntimeGraphStore';
import { AppNode, OverlayRect, TimelineAction, TimelineInteractionClip } from '../../_types';
import OpenFMVVideo from '../video/OpenFMVVideo';
import { SwipeUnlock } from './interactions';
import { getRuntimeMediaPlaybackRate, shouldResetRuntimeTimelineTriggerState, shouldUseRuntimeTimelineIntervalClock } from './timelineClock';
import { createRuntime, getActiveTimelineClips, getTimelineClipEndTime, RuntimeEffect, RuntimeEvent, RuntimeSnapshot } from '../../_utils/graphRuntime';

const Countdown = ({ seconds, countdownKey, onTimeout }: { seconds?: number; countdownKey: string; onTimeout: () => void }) => {
  const normalizedSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const [countdownState, setCountdownState] = useState({ key: countdownKey, timeLeft: normalizedSeconds });
  const timeoutKeyRef = useRef<string | null>(null);

  useEffect(() => {
    timeoutKeyRef.current = null;
    setCountdownState({ key: countdownKey, timeLeft: normalizedSeconds });
  }, [countdownKey, normalizedSeconds]);

  useEffect(() => {
    if (countdownState.key !== countdownKey || normalizedSeconds <= 0 || countdownState.timeLeft <= 0) return;
    const timer = window.setTimeout(() => setCountdownState((state) => (state.key === countdownKey ? { ...state, timeLeft: state.timeLeft - 1 } : state)), 1000);
    return () => window.clearTimeout(timer);
  }, [countdownKey, countdownState, normalizedSeconds]);

  useEffect(() => {
    if (countdownState.key !== countdownKey || normalizedSeconds <= 0 || countdownState.timeLeft !== 0) return;
    if (timeoutKeyRef.current === countdownKey) return;
    timeoutKeyRef.current = countdownKey;
    onTimeout();
  }, [countdownKey, countdownState, normalizedSeconds, onTimeout]);

  if (normalizedSeconds <= 0 || countdownState.key !== countdownKey || countdownState.timeLeft <= 0) return null;

  return (
    <div className="mx-auto mt-5 w-full max-w-xs">
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-openfmv-accent transition-all duration-1000" style={{ width: `${(countdownState.timeLeft / normalizedSeconds) * 100}%` }} />
      </div>
      <div className="mt-2 text-center font-mono text-xs font-semibold text-openfmv-accent">{countdownState.timeLeft}s</div>
    </div>
  );
};

const getEffect = <T extends RuntimeEffect['type']>(effects: RuntimeEffect[], type: T) => {
  return effects.find((effect): effect is Extract<RuntimeEffect, { type: T }> => effect.type === type);
};

type PlayMediaEffect = Extract<RuntimeEffect, { type: 'playMedia' }>;
type VisualMediaEffect = Extract<PlayMediaEffect, { mediaType: 'video' | 'image' }>;
type AudioMediaEffect = Extract<PlayMediaEffect, { mediaType: 'audio' }>;

const runtimeStageStyle: React.CSSProperties = {
  width: 'min(100vw, calc(100vh * 16 / 9))',
};

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
  const fit = effect?.mediaType === 'video' ? 'contain' : effect?.fit || 'contain';
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
  if (clip.type === 'text') return clip.text || clip.name || '';
  if (clip.type === 'hotspot') return clip.showHint ? clip.hint || clip.name || 'Hotspot' : '';
  return clip.label || clip.name || 'Continue';
};

const getTimelineClipAction = (clip: TimelineInteractionClip): TimelineAction => {
  if (clip.type === 'pauseGate') return clip.action || { type: 'continue' };
  if (clip.type === 'text') return { type: 'continue' };
  return clip.action;
};

const shouldResumeTimelineOnClick = (clip: TimelineInteractionClip) => {
  return clip.type !== 'pauseGate' || clip.resumeOnClick !== false;
};

const getTimelineClipClassName = (clip: TimelineInteractionClip) => {
  const base = 'pointer-events-auto absolute flex min-h-10 min-w-12 items-center justify-center overflow-hidden rounded-[12px] border px-4 text-sm font-bold text-white shadow-[0_18px_54px_rgba(0,0,0,0.38)] backdrop-blur-2xl transition hover:scale-[1.02]';
  if (clip.type === 'text') return 'pointer-events-none absolute flex min-h-8 min-w-12 items-center justify-center overflow-hidden px-3 text-center font-bold text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.72)]';
  if (clip.type === 'hotspot') return `${base} border-cyan-200/85 bg-cyan-400/16 text-cyan-50`;
  if (clip.type === 'pauseGate') return `${base} border-violet-200/85 bg-violet-500/88`;
  return `${base} border-orange-200/90 bg-orange-500/92`;
};

function RuntimeVisualMediaLayer({
  effect,
  sceneTitle,
  playerRef,
  timelineTime,
  paused,
}: {
  effect: VisualMediaEffect;
  sceneTitle?: string;
  playerRef?: React.Ref<HTMLVideoElement>;
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
        <img src={imageSrc} alt={sceneTitle || ''} className={getVisualMediaFitClassName(effect)} />
      ) : (
        <OpenFMVVideo src={effect.src} playbackId={effect.playbackId} poster={effect.poster} autoPlay muted={effect.muted} playsInline controls className={getVisualMediaFitClassName(effect)} playerRef={setVideoRef} />
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
  videoRef: React.RefObject<HTMLVideoElement>;
  onPauseTimeline: () => void;
  onResumeTimeline: () => void;
  dispatch: (event: RuntimeEvent) => void;
}) => {
  const shownClipIdsRef = useRef<Set<string>>(new Set());
  const timedOutClipIdsRef = useRef<Set<string>>(new Set());
  const triggerStateRef = useRef<{ nodeId?: string | null; time: number }>({ nodeId: null, time: 0 });

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
    }
    triggerStateRef.current = { nodeId: nextNodeId, time: currentTime };
  }, [currentNode?.id, currentTime, timelineEffect?.nodeId]);

  const activeClips = useMemo(() => (
    currentNode && timelineEffect ? getActiveTimelineClips(currentNode, currentTime) : []
  ), [currentNode, currentTime, timelineEffect]);

  useEffect(() => {
    const video = videoRef.current;

    activeClips.forEach((clip) => {
      if (shownClipIdsRef.current.has(clip.id)) return;
      if (clip.type === 'pauseGate' || ('pauseOnShow' in clip && clip.pauseOnShow)) {
        shownClipIdsRef.current.add(clip.id);
        video?.pause();
        onPauseTimeline();
      }
    });
  }, [activeClips, onPauseTimeline, videoRef]);

  useEffect(() => {
    if (!timelineEffect) return;
    timelineEffect.clips.forEach((clip) => {
      const endTime = getTimelineClipEndTime(clip);
      const action = clip.type === 'button' ? clip.timeoutAction : undefined;
      if (!action || currentTime < endTime || timedOutClipIdsRef.current.has(clip.id)) return;
      timedOutClipIdsRef.current.add(clip.id);
      dispatch({ type: 'timeline.clip.timeout', clipId: clip.id, action });
    });
  }, [currentTime, dispatch, timelineEffect]);

  if (!timelineEffect || !currentNode || activeClips.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20" data-openfmv-runtime-overlay>
      {activeClips.map((clip) => {
        const rect = getTimelineClipRect(clip);
        const label = getTimelineClipLabel(clip);
        const textStyle = clip.type === 'text'
          ? {
              fontSize: `${Math.max(8, Math.min(96, Number(clip.fontSize) || 28))}px`,
              color: clip.color || '#ffffff',
              backgroundColor: clip.backgroundColor || 'transparent',
              textAlign: clip.align || 'center',
            } satisfies React.CSSProperties
          : {};

        if (clip.type === 'text') {
          return (
            <div
              key={clip.id}
              className={getTimelineClipClassName(clip)}
              style={{
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.width * 100}%`,
                height: `${rect.height * 100}%`,
                opacity: getClipOpacity(clip),
                transform: `rotate(${getClipRotation(clip)}deg)`,
                transformOrigin: 'center',
                ...textStyle,
              }}
            >
              <span className="w-full whitespace-pre-wrap break-words leading-tight">{label}</span>
            </div>
          );
        }

        return (
          <button
            key={clip.id}
            type="button"
            onClick={() => {
              const action = getTimelineClipAction(clip);
              if (action.type === 'continue') {
                if (shouldResumeTimelineOnClick(clip)) {
                  onResumeTimeline();
                  void videoRef.current?.play();
                }
                return;
              }
              dispatch({ type: 'timeline.clip.triggered', clipId: clip.id, action });
            }}
            className={getTimelineClipClassName(clip)}
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.width * 100}%`,
              height: `${rect.height * 100}%`,
              opacity: getClipOpacity(clip),
              transform: `rotate(${getClipRotation(clip)}deg)`,
              transformOrigin: 'center',
              ...textStyle,
            }}
          >
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
};

const TimelineRuntimeTimedActions = ({
  timedActionEffect,
  currentTime,
  dispatch,
}: {
  timedActionEffect?: Extract<RuntimeEffect, { type: 'timelineTimedActions' }>;
  currentTime: number;
  dispatch: (event: RuntimeEvent) => void;
}) => {
  const triggeredClipIdsRef = useRef<Set<string>>(new Set());
  const triggerStateRef = useRef<{ nodeId?: string | null; time: number }>({ nodeId: null, time: 0 });

  useEffect(() => {
    const nextNodeId = timedActionEffect?.nodeId ?? null;
    if (shouldResetRuntimeTimelineTriggerState({
      previousNodeId: triggerStateRef.current.nodeId,
      nextNodeId,
      previousTime: triggerStateRef.current.time,
      nextTime: currentTime,
    })) {
      triggeredClipIdsRef.current = new Set();
    }
    triggerStateRef.current = { nodeId: nextNodeId, time: currentTime };
  }, [currentTime, timedActionEffect?.nodeId]);

  useEffect(() => {
    if (!timedActionEffect) return;
    timedActionEffect.clips.forEach((clip) => {
      if (triggeredClipIdsRef.current.has(clip.id) || currentTime < clip.startTime) return;
      triggeredClipIdsRef.current.add(clip.id);
      dispatch({ type: 'timeline.timedAction.triggered', clipId: clip.id, action: clip.action });
    });
  }, [currentTime, dispatch, timedActionEffect]);

  return null;
};

const InteractionControls = ({ effects, dispatch }: { effects: RuntimeEffect[]; dispatch: (event: RuntimeEvent) => void }) => {
  const t = useTranslations('player');
  const choiceEffect = getEffect(effects, 'showChoices');
  const inputEffect = getEffect(effects, 'showInput');
  const sliderEffect = getEffect(effects, 'showSlider');
  const continueEffect = getEffect(effects, 'showContinue');
  const timerEffect = getEffect(effects, 'startTimer');
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    setInputValue('');
  }, [choiceEffect?.prompt, inputEffect?.prompt, sliderEffect?.prompt]);

  const submitInput = () => {
    dispatch({ type: 'input.submitted', value: inputValue });
    setInputValue('');
  };

  const prompt = choiceEffect?.prompt || inputEffect?.prompt || sliderEffect?.prompt || '';
  const inputPlaceholder = inputEffect?.placeholder === '输入你的回答...' ? t('answerPlaceholder') : inputEffect?.placeholder;
  const sliderLabel = sliderEffect?.label === '滑动解锁' ? t('swipeUnlock') : sliderEffect?.label;
  const continueLabel = continueEffect?.label === '继续' ? t('continue') : continueEffect?.label;

  return (
    <div className="w-full max-w-4xl">
      {prompt && <h2 className="mb-5 text-center text-2xl font-semibold text-white drop-shadow-lg md:text-3xl">{prompt}</h2>}

      {sliderEffect ? (
        <div className="flex justify-center"><SwipeUnlock label={sliderLabel} onUnlock={() => dispatch({ type: 'slider.unlocked', input: 'unlocked', handleId: sliderEffect.handleId })} /></div>
      ) : inputEffect ? (
        <div className="mx-auto flex max-w-xl items-center gap-2 rounded-full border border-white/15 bg-white/[0.12] p-2 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-3xl">
          <input value={inputValue} onChange={(event) => setInputValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitInput(); }} placeholder={inputPlaceholder} className="min-w-0 flex-1 bg-transparent px-4 py-3 text-white outline-none placeholder-white/35" />
          <button onClick={submitInput} className="flex h-11 w-11 items-center justify-center rounded-full bg-openfmv-accent text-white transition hover:bg-openfmv-accent-hover"><ArrowRight size={18} /></button>
        </div>
      ) : choiceEffect ? (
        <div className={`grid gap-3 ${choiceEffect.choices.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1 place-items-center'}`}>
          {choiceEffect.choices.map((choice) => (
            <button key={choice.id} onClick={() => dispatch({ type: 'choice.selected', input: choice.input, handleId: choice.handleId })} className="group flex min-h-16 w-full max-w-xl items-center justify-between gap-3 rounded-[22px] border border-white/15 bg-white/10 px-5 py-4 text-left text-white shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-3xl transition hover:-translate-y-0.5 hover:border-openfmv-accent/70 hover:bg-white/16">
              <span className="min-w-0 break-words text-lg">{choice.label}</span>
              <ArrowRight size={18} className="shrink-0 opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      ) : continueEffect ? (
        <button onClick={() => dispatch({ type: 'continue' })} className="inline-flex items-center gap-2 rounded-full bg-openfmv-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-openfmv-accent-hover">{continueLabel}<ArrowRight size={16} /></button>
      ) : null}

      {timerEffect && (
        <Countdown seconds={timerEffect.seconds} countdownKey={timerEffect.key} onTimeout={() => dispatch({ type: 'timer.timeout' })} />
      )}
    </div>
  );
};

export default function PlayerOverlay() {
  const t = useTranslations('player');
  const { isPlaying, setIsPlaying, reset } = usePlayerStore();
  const runtimeGraph = useRuntimeGraphStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineTimeRef = useRef(0);
  const nodes = runtimeGraph.nodes;
  const edges = runtimeGraph.edges;
  const runtime = useMemo(() => createRuntime({ nodes, edges }, { entryNodeId: runtimeGraph.entryNodeId }), [edges, nodes, runtimeGraph.entryNodeId]);
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null);
  const [isTimelineClockPaused, setIsTimelineClockPaused] = useState(false);
  const effects = snapshot?.effects || [];
  const currentNode = snapshot?.currentNode ?? null;
  const sceneEffect = getEffect(effects, 'scene');
  const visualMediaEffects = getVisualMediaEffects(effects);
  const visualMediaEffect = visualMediaEffects.at(-1) ?? getVisualMediaEffect(effects);
  const timelineSyncVideoEffect = visualMediaEffects.filter((effect) => effect.mediaType === 'video').at(-1) ?? null;
  const audioMediaEffects = getAudioMediaEffects(effects);
  const audioMediaEffect = audioMediaEffects.at(-1) ?? null;
  const timelinePlaybackEffect = getEffect(effects, 'timelinePlayback');
  const timelineEffect = getEffect(effects, 'timelineOverlay');
  const timelineTimedActionsEffect = getEffect(effects, 'timelineTimedActions');
  const timelineTime = snapshot?.timelineTime ?? 0;
  const snapshotStatus = snapshot?.status;
  const timelineDuration = timelinePlaybackEffect?.duration ?? timelineEffect?.duration ?? visualMediaEffect?.timelineDuration ?? audioMediaEffect?.timelineDuration ?? 0;
  const activeVideoTimelineStart = timelineSyncVideoEffect?.timelineStartTime || 0;
  const activeVideoSourceStart = timelineSyncVideoEffect?.sourceStart || 0;
  const activeVideoPlaybackRate = timelineSyncVideoEffect ? getMediaPlaybackRate(timelineSyncVideoEffect) : 1;
  const activeVideoFreezeFrameTime = timelineSyncVideoEffect && Number.isFinite(Number(timelineSyncVideoEffect.freezeFrameTime)) ? Math.max(0, Number(timelineSyncVideoEffect.freezeFrameTime)) : null;
  const activeVideoSrc = timelineSyncVideoEffect?.src;
  const shouldUseTimelineIntervalClock = shouldUseRuntimeTimelineIntervalClock({ timelineSyncVideoEffect, timelineTime });

  useEffect(() => {
    if (!isPlaying || nodes.length === 0) {
      setSnapshot(null);
      return;
    }

    setSnapshot(runtime.start());
  }, [isPlaying, nodes.length, runtime]);

  const closePlayer = () => {
    runtimeGraph.resetGraph();
    reset();
    setIsPlaying(false);
  };

  const dispatch = useCallback((event: RuntimeEvent) => {
    setSnapshot(runtime.dispatch(event));
  }, [runtime]);

  useEffect(() => {
    timelineTimeRef.current = timelineTime;
  }, [timelineTime]);

  useEffect(() => {
    setIsTimelineClockPaused(false);
  }, [currentNode?.id]);

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
    if (!video || !timelinePlaybackEffect || !timelineSyncVideoEffect || shouldUseTimelineIntervalClock) return;
    const syncTimelineTime = () => {
      dispatch({ type: 'timeline.time.update', time: activeVideoTimelineStart + Math.max(0, (video.currentTime || 0) - activeVideoSourceStart) / activeVideoPlaybackRate });
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
  }, [activeVideoPlaybackRate, activeVideoSourceStart, activeVideoTimelineStart, activeVideoSrc, dispatch, shouldUseTimelineIntervalClock, timelinePlaybackEffect, timelineSyncVideoEffect]);

  useEffect(() => {
    if (!timelinePlaybackEffect || snapshotStatus !== 'running' || isTimelineClockPaused || !shouldUseTimelineIntervalClock) return;
    const timer = window.setInterval(() => {
      const nextTime = timelineDuration > 0
        ? Math.min(timelineDuration, timelineTimeRef.current + 0.1)
        : timelineTimeRef.current + 0.1;
      if (Math.abs(nextTime - timelineTimeRef.current) > 0.001) {
        dispatch({ type: 'timeline.time.update', time: nextTime });
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [dispatch, isTimelineClockPaused, shouldUseTimelineIntervalClock, snapshotStatus, timelineDuration, timelinePlaybackEffect]);

  if (!isPlaying || !snapshot) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[linear-gradient(135deg,#090b10,#15110d)] text-white">
      <div className="absolute left-4 top-4 z-50 flex items-center gap-2">
        <button onClick={closePlayer} className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.11] px-4 py-2 text-sm font-medium text-white/85 backdrop-blur-3xl transition hover:border-openfmv-accent/70 hover:text-white"><X size={16} />{t('exit')}</button>
        <button onClick={() => dispatch({ type: 'restart' })} className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.11] px-4 py-2 text-sm font-medium text-white/85 backdrop-blur-3xl transition hover:border-openfmv-accent/70 hover:text-white"><RotateCcw size={16} />{t('replay')}</button>
      </div>

      <div className="absolute inset-0 grid place-items-center bg-black">
        <div
          className="relative aspect-video max-h-screen max-w-screen overflow-hidden bg-black"
          data-openfmv-runtime-stage
          style={runtimeStageStyle}
        >
          {visualMediaEffects.length > 0 ? (
            visualMediaEffects.map((effect, index) => (
              <RuntimeVisualMediaLayer
                key={`${effect.src}-${effect.timelineStartTime ?? 0}-${index}`}
                effect={effect}
                sceneTitle={sceneEffect?.title}
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
            key={`${effect.src}-${effect.timelineStartTime ?? 0}-${effect.sourceStart ?? 0}-${index}`}
            effect={effect}
            timelineTime={timelineTime}
            paused={snapshotStatus !== 'running' || isTimelineClockPaused}
          />
        ))}
        <TimelineRuntimeTimedActions timedActionEffect={timelineTimedActionsEffect} currentTime={timelineTime} dispatch={dispatch} />
      </div>

      <div className="relative z-10 flex min-h-full flex-col justify-end px-5 py-8 md:px-12 md:py-12">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-8 max-w-3xl">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-openfmv-accent">{sceneEffect?.nodeType || snapshot.status}</div>
            <h1 className="text-4xl font-semibold tracking-tight drop-shadow-2xl md:text-6xl">{sceneEffect?.title || t('playEnded')}</h1>
            {sceneEffect?.text && <p className="mt-5 whitespace-pre-wrap text-base leading-8 text-white/86 drop-shadow-lg md:text-xl md:leading-9">{sceneEffect.text}</p>}
          </div>

          {snapshot.status === 'ended' || currentNode?.type === 'end' ? (
            <button onClick={() => dispatch({ type: 'restart' })} className="inline-flex items-center gap-2 rounded-full bg-openfmv-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-openfmv-accent-hover"><RotateCcw size={16} />{t('restart')}</button>
          ) : timelineEffect ? (
            null
          ) : (
            <InteractionControls effects={effects} dispatch={dispatch} />
          )}
        </div>
      </div>
    </div>
  );
}



