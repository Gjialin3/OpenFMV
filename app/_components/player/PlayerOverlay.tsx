'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, RotateCcw, X } from 'lucide-react';
import { useResolvedMediaSrc } from '../../_hooks/useResolvedMediaSrc';
import { usePlayerStore } from '../../_store/usePlayerStore';
import { useRuntimeGraphStore } from '../../_store/useRuntimeGraphStore';
import { AppNode, TimelineAction, TimelineClip } from '../../_types';
import OpenFMVVideo from '../video/OpenFMVVideo';
import { SwipeUnlock } from './interactions';
import { createRuntime, getActiveTimelineClips, RuntimeEffect, RuntimeEvent, RuntimeSnapshot } from '../../_utils/graphRuntime';

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

const getTimelineClipLabel = (clip: TimelineClip) => {
  if (clip.type === 'hotspot') return clip.showHint ? clip.hint || clip.name || '' : '';
  return clip.label || clip.name || '';
};

const getTimelineClipRect = (clip: TimelineClip) => {
  if ('rect' in clip && clip.rect) return clip.rect;
  return { x: 0.38, y: 0.76, width: 0.24, height: 0.1 };
};

const getTimelineClipAction = (clip: TimelineClip): TimelineAction => {
  if (clip.type === 'pauseGate') return clip.action || { type: 'continue' };
  return clip.action;
};

const TimelineRuntimeOverlay = ({
  currentNode,
  timelineEffect,
  videoRef,
  dispatch,
}: {
  currentNode: AppNode | null;
  timelineEffect?: Extract<RuntimeEffect, { type: 'timelineOverlay' }>;
  videoRef: React.RefObject<HTMLVideoElement>;
  dispatch: (event: RuntimeEvent) => void;
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const shownClipIds = useRef<Set<string>>(new Set());
  const timedOutClipIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    shownClipIds.current = new Set();
    timedOutClipIds.current = new Set();
    setCurrentTime(0);
  }, [timelineEffect?.nodeId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const syncTime = () => setCurrentTime(video.currentTime || 0);
    syncTime();
    video.addEventListener('timeupdate', syncTime);
    video.addEventListener('seeked', syncTime);
    video.addEventListener('loadedmetadata', syncTime);
    return () => {
      video.removeEventListener('timeupdate', syncTime);
      video.removeEventListener('seeked', syncTime);
      video.removeEventListener('loadedmetadata', syncTime);
    };
  }, [timelineEffect?.nodeId, videoRef]);

  const activeClips = useMemo(() => (
    currentNode && timelineEffect ? getActiveTimelineClips(currentNode, currentTime) : []
  ), [currentNode, currentTime, timelineEffect]);

  useEffect(() => {
    if (!currentNode || !timelineEffect) return;
    for (const clip of activeClips) {
      const shouldPause = clip.type === 'pauseGate' || ('pauseOnShow' in clip && clip.pauseOnShow);
      if (!shouldPause || shownClipIds.current.has(clip.id)) continue;
      shownClipIds.current.add(clip.id);
      videoRef.current?.pause();
    }

    for (const clip of timelineEffect.clips) {
      const endTime = clip.endTime ?? clip.startTime + 0.1;
      const timeoutAction = 'timeoutAction' in clip ? clip.timeoutAction : undefined;
      if (!timeoutAction || timedOutClipIds.current.has(clip.id) || currentTime <= endTime) continue;
      timedOutClipIds.current.add(clip.id);
      dispatch({ type: 'timeline.clip.timeout', clipId: clip.id, action: timeoutAction });
    }
  }, [activeClips, currentNode, currentTime, dispatch, timelineEffect, videoRef]);

  const triggerClip = (clip: TimelineClip) => {
    const action = getTimelineClipAction(clip);
    if (action.type === 'continue') {
      void videoRef.current?.play();
      return;
    }
    dispatch({ type: 'timeline.clip.triggered', clipId: clip.id, action });
  };

  if (!timelineEffect || activeClips.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
      <div className="relative aspect-video h-full max-h-full w-full max-w-full">
        {activeClips.map((clip) => {
          const rect = getTimelineClipRect(clip);
          const label = getTimelineClipLabel(clip);
          const clipClassName = clip.type === 'hotspot'
            ? 'border-cyan-300/90 bg-cyan-400/12 text-cyan-50'
            : clip.type === 'pauseGate'
              ? 'border-violet-300/85 bg-violet-500/86 text-white'
              : 'border-orange-300/90 bg-orange-500/92 text-white';
          return (
            <button
              key={clip.id}
              type="button"
              onClick={() => triggerClip(clip)}
              className={`pointer-events-auto absolute flex min-h-9 min-w-12 items-center justify-center rounded-[12px] border px-3 text-sm font-semibold shadow-[0_18px_54px_rgba(0,0,0,0.32)] backdrop-blur-md transition hover:scale-[1.02] ${clipClassName}`}
              style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%` }}
              aria-label={label || clip.type}
            >
              <span className="min-w-0 truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default function PlayerOverlay() {
  const t = useTranslations('player');
  const { isPlaying, setIsPlaying, reset } = usePlayerStore();
  const runtimeGraph = useRuntimeGraphStore();
  const nodes = runtimeGraph.nodes;
  const edges = runtimeGraph.edges;
  const runtime = useMemo(() => createRuntime({ nodes, edges }, { entryNodeId: runtimeGraph.entryNodeId }), [edges, nodes, runtimeGraph.entryNodeId]);
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null);
  const effects = snapshot?.effects || [];
  const currentNode = snapshot?.currentNode ?? null;
  const sceneEffect = getEffect(effects, 'scene');
  const mediaEffect = getEffect(effects, 'playMedia');
  const timelineEffect = getEffect(effects, 'timelineOverlay');
  const imageSrc = useResolvedMediaSrc(mediaEffect?.mediaType === 'image' ? mediaEffect.src : undefined);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  if (!isPlaying || !snapshot) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[linear-gradient(135deg,#090b10,#15110d)] text-white">
      <div className="absolute left-4 top-4 z-50 flex items-center gap-2">
        <button onClick={closePlayer} className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.11] px-4 py-2 text-sm font-medium text-white/85 backdrop-blur-3xl transition hover:border-openfmv-accent/70 hover:text-white"><X size={16} />{t('exit')}</button>
        <button onClick={() => dispatch({ type: 'restart' })} className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.11] px-4 py-2 text-sm font-medium text-white/85 backdrop-blur-3xl transition hover:border-openfmv-accent/70 hover:text-white"><RotateCcw size={16} />{t('replay')}</button>
      </div>

      <div className="absolute inset-0 bg-black">
        {mediaEffect?.mediaType === 'image' ? <img src={imageSrc} alt={sceneEffect?.title || ''} className="h-full w-full object-contain" /> : mediaEffect?.mediaType === 'video' ? <OpenFMVVideo src={mediaEffect.src} playbackId={mediaEffect.playbackId} poster={mediaEffect.poster} autoPlay playsInline controls className="h-full w-full object-contain" playerRef={videoRef} /> : <div className="h-full w-full bg-[radial-gradient(circle_at_50%_24%,rgba(249,115,22,0.22),transparent_34%),radial-gradient(circle_at_78%_12%,rgba(255,255,255,0.09),transparent_30%),linear-gradient(135deg,#151821,#070a10_62%,#17120f)]" />}
        <TimelineRuntimeOverlay currentNode={currentNode} timelineEffect={timelineEffect} videoRef={videoRef} dispatch={dispatch} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/62 via-black/18 to-black/88" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(circle_at_50%_100%,rgba(249,115,22,0.15),transparent_45%)]" />
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
          ) : timelineEffect && mediaEffect?.mediaType === 'video' ? null : (
            <InteractionControls effects={effects} dispatch={dispatch} />
          )}
        </div>
      </div>
    </div>
  );
}



