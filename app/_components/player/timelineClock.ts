import { RuntimeEffect } from '../../_utils/graphRuntime';

type PlayMediaEffect = Extract<RuntimeEffect, { type: 'playMedia' }>;
type RuntimeVideoEffect = Extract<PlayMediaEffect, { mediaType: 'video' }>;

const RUNTIME_TIMELINE_EPSILON = 0.001;

export const getRuntimeMediaPlaybackRate = (effect?: { playbackRate?: number } | null) => {
  const playbackRate = Number(effect?.playbackRate);
  if (!Number.isFinite(playbackRate) || playbackRate <= 0) return 1;
  return Math.max(0.01, Math.min(5, playbackRate));
};

export const getRuntimeVideoSourceTimelineEnd = (effect?: RuntimeVideoEffect | null) => {
  const sourceDuration = Number(effect?.sourceDuration);
  if (!effect || !Number.isFinite(sourceDuration) || sourceDuration <= 0) return null;
  return (Number(effect.timelineStartTime) || 0) + sourceDuration / getRuntimeMediaPlaybackRate(effect);
};

export const shouldUseRuntimeTimelineIntervalClock = ({
  timelineSyncVideoEffect: _timelineSyncVideoEffect,
  timelineTime: _timelineTime,
}: {
  timelineSyncVideoEffect?: RuntimeVideoEffect | null;
  timelineTime: number;
}) => true;

export const shouldResetRuntimeTimelineTriggerState = ({
  previousNodeId,
  nextNodeId,
  previousTime,
  nextTime,
}: {
  previousNodeId?: string | null;
  nextNodeId?: string | null;
  previousTime: number;
  nextTime: number;
}) => {
  if (previousNodeId !== nextNodeId) return true;
  if (!Number.isFinite(previousTime) || !Number.isFinite(nextTime)) return false;
  return nextTime < previousTime - RUNTIME_TIMELINE_EPSILON;
};
