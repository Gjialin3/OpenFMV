import { describe, expect, it, vi } from 'vitest';

import { createMediaClipFromTimelineAsset, getMediaFilesFromClipboardData } from '@/app/_features/node-timeline';

vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => `id-${Math.random().toString(36).slice(2)}`),
});

describe('node timeline media asset clips', () => {
  it('creates video clips with asset duration, poster, playback id, and source range metadata', () => {
    const clip = createMediaClipFromTimelineAsset({
      type: 'video',
      src: 'assets/intro.mp4',
      name: 'Intro',
      assetId: 'asset-video',
      startTime: 3,
      metadata: {
        duration: 12.345,
        playbackId: 'mux-playback',
        thumbnail: 'assets/intro-poster.jpg',
      },
    });

    expect(clip).toMatchObject({
      type: 'video',
      src: 'assets/intro.mp4',
      name: 'Intro',
      assetId: 'asset-video',
      startTime: 3,
      duration: 12.35,
      sourceStart: 0,
      sourceDuration: 12.35,
      playbackId: 'mux-playback',
      poster: 'assets/intro-poster.jpg',
    });
  });

  it('preserves image duration for timeline placement without creating a source range', () => {
    const clip = createMediaClipFromTimelineAsset({
      type: 'image',
      src: 'assets/card.png',
      startTime: 1,
      metadata: {
        duration: 5,
      },
    });

    expect(clip).toMatchObject({
      type: 'image',
      duration: 5,
      sourceStart: 0,
    });
    expect(clip.sourceDuration).toBeUndefined();
  });

  it('creates audio clips with asset duration and source range metadata', () => {
    const clip = createMediaClipFromTimelineAsset({
      type: 'audio',
      src: 'assets/music.mp3',
      startTime: 0,
      metadata: {
        duration: 8,
      },
    });

    expect(clip).toMatchObject({
      type: 'audio',
      duration: 8,
      sourceDuration: 8,
      volume: 1,
    });
  });

  it('extracts only media files from clipboard data for OpenCut-style paste import', () => {
    const imageFile = new File(['image'], 'frame.png', { type: 'image/png' });
    const audioFile = new File(['audio'], 'voice.mp3', { type: 'audio/mpeg' });
    const textFile = new File(['text'], 'notes.txt', { type: 'text/plain' });

    const files = getMediaFilesFromClipboardData({
      items: [
        { kind: 'file', type: 'image/png', getAsFile: () => imageFile },
        { kind: 'file', type: 'audio/mpeg', getAsFile: () => audioFile },
        { kind: 'file', type: 'text/plain', getAsFile: () => textFile },
        { kind: 'string', type: 'text/plain', getAsFile: () => null },
      ],
    });

    expect(files).toEqual([imageFile, audioFile]);
  });
});
