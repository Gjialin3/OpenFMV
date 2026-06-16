import { describe, expect, it } from 'vitest';

import { getRuntimeMediaPlaybackRate, getRuntimeVideoSourceTimelineEnd, shouldResetRuntimeTimelineTriggerState, shouldUseRuntimeTimelineIntervalClock } from '@/app/_components/player/timelineClock';
import { RuntimeEffect } from '@/app/_utils/graphRuntime';

type PlayMediaEffect = Extract<RuntimeEffect, { type: 'playMedia' }>;
type RuntimeVideoEffect = Extract<PlayMediaEffect, { mediaType: 'video' }>;

const videoEffect = (patch: Partial<RuntimeVideoEffect> = {}): RuntimeVideoEffect => ({
  type: 'playMedia',
  mediaType: 'video',
  src: 'assets/clip.mp4',
  timelineStartTime: 2,
  sourceStart: 4,
  sourceDuration: 3,
  duration: 8,
  playbackRate: 1.5,
  ...patch,
});

describe('player timeline clock helpers', () => {
  it('clamps runtime media playback rate', () => {
    expect(getRuntimeMediaPlaybackRate({ playbackRate: 0 })).toBe(1);
    expect(getRuntimeMediaPlaybackRate({ playbackRate: -1 })).toBe(1);
    expect(getRuntimeMediaPlaybackRate({ playbackRate: 12 })).toBe(5);
    expect(getRuntimeMediaPlaybackRate({ playbackRate: 0.001 })).toBe(0.01);
  });

  it('computes the timeline time where a source range ends', () => {
    expect(getRuntimeVideoSourceTimelineEnd(videoEffect())).toBe(4);
    expect(getRuntimeVideoSourceTimelineEnd(videoEffect({ sourceDuration: undefined }))).toBeNull();
  });

  it('uses the interval clock as the runtime timeline master', () => {
    expect(shouldUseRuntimeTimelineIntervalClock({ timelineSyncVideoEffect: null, timelineTime: 0 })).toBe(true);
    expect(shouldUseRuntimeTimelineIntervalClock({ timelineSyncVideoEffect: videoEffect({ freezeFrameTime: 5 }), timelineTime: 2.5 })).toBe(true);
    expect(shouldUseRuntimeTimelineIntervalClock({ timelineSyncVideoEffect: videoEffect(), timelineTime: 3.9 })).toBe(true);
    expect(shouldUseRuntimeTimelineIntervalClock({ timelineSyncVideoEffect: videoEffect(), timelineTime: 4 })).toBe(true);
    expect(shouldUseRuntimeTimelineIntervalClock({ timelineSyncVideoEffect: videoEffect({ sourceDuration: undefined }), timelineTime: 7 })).toBe(true);
  });

  it('resets timeline trigger state when nodes change or timeline time rewinds', () => {
    expect(shouldResetRuntimeTimelineTriggerState({
      previousNodeId: 'intro',
      nextNodeId: 'choice',
      previousTime: 3,
      nextTime: 0,
    })).toBe(true);
    expect(shouldResetRuntimeTimelineTriggerState({
      previousNodeId: 'intro',
      nextNodeId: 'intro',
      previousTime: 3,
      nextTime: 0,
    })).toBe(true);
    expect(shouldResetRuntimeTimelineTriggerState({
      previousNodeId: 'intro',
      nextNodeId: 'intro',
      previousTime: 3,
      nextTime: 3.0005,
    })).toBe(false);
    expect(shouldResetRuntimeTimelineTriggerState({
      previousNodeId: 'intro',
      nextNodeId: 'intro',
      previousTime: 3,
      nextTime: 2.9995,
    })).toBe(false);
    expect(shouldResetRuntimeTimelineTriggerState({
      previousNodeId: 'intro',
      nextNodeId: 'intro',
      previousTime: 3,
      nextTime: 3.5,
    })).toBe(false);
  });
});
