import { describe, expect, it, vi } from 'vitest';

import {
  createMediaClip,
  getTimelineMediaElementTime,
  getTimelineMediaPlaybackRate,
  getTimelineMediaSourceEnd,
  getTimelineMediaSourceTimelineEnd,
  hasTimelineMediaSourceEnded,
  shouldSyncTimelineToMediaElement,
} from '@/app/_features/node-timeline';

vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => `id-${Math.random().toString(36).slice(2)}`),
});

describe('node timeline media playback helpers', () => {
  it('clamps media element time to source out while the timeline can continue through the clip', () => {
    const clip = {
      ...createMediaClip({
        type: 'video',
        src: 'assets/short-source.mp4',
        startTime: 2,
        duration: 8,
        sourceDuration: 2,
      }),
      sourceStart: 1,
      playbackRate: 2,
    };

    expect(getTimelineMediaPlaybackRate(clip)).toBe(2);
    expect(getTimelineMediaSourceEnd(clip)).toBe(3);
    expect(getTimelineMediaSourceTimelineEnd(clip)).toBe(3);
    expect(getTimelineMediaElementTime(clip, 2.5)).toBe(2);
    expect(getTimelineMediaElementTime(clip, 4)).toBe(3);
    expect(hasTimelineMediaSourceEnded(clip, 2.99)).toBe(false);
    expect(hasTimelineMediaSourceEnded(clip, 3)).toBe(true);
    expect(shouldSyncTimelineToMediaElement(clip, 2.99)).toBe(true);
    expect(shouldSyncTimelineToMediaElement(clip, 3)).toBe(false);
    expect(shouldSyncTimelineToMediaElement(clip, 4)).toBe(false);
  });

  it('uses video element clock only while an unclamped non-freeze source is active', () => {
    const unclampedClip = createMediaClip({
      type: 'video',
      src: 'assets/full-source.mp4',
      startTime: 0,
      duration: 8,
    });
    const freezeClip = {
      ...unclampedClip,
      freezeFrameTime: 3,
    };
    const imageClip = createMediaClip({
      type: 'image',
      src: 'assets/card.png',
      startTime: 0,
      duration: 4,
    });

    expect(shouldSyncTimelineToMediaElement(unclampedClip, 4)).toBe(true);
    expect(getTimelineMediaElementTime(freezeClip, 6)).toBe(3);
    expect(shouldSyncTimelineToMediaElement(freezeClip, 1)).toBe(false);
    expect(shouldSyncTimelineToMediaElement(imageClip, 1)).toBe(false);
  });
});
