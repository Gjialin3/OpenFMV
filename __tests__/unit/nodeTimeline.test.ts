import { describe, expect, it, vi } from 'vitest';

import { AppEdge, AppNode, NodeTimeline, OpenFMVGraph } from '@/app/_types';
import {
  addTimelineTrack,
  buildAudioWaveformPeaks,
  buildPreviewSnapTargets,
  buildTimelineSnapPoints,
  clampTimelineZoom,
  createInteractionClip,
  createTimelineKeyframeClipboardItems,
  createMediaClip,
  deleteTimelineClips,
  deleteTimelineClipsWithRipple,
  deleteTimelineTrack,
  duplicateTimelineClip,
  duplicateTimelineClips,
  ensureNodeTimeline,
  findTimelineClip,
  findTimelineBookmarkAtTime,
  formatTimelineRulerLabel,
  freezeTimelineVideoClipAtTime,
  getAdjacentTimelineEditPoint,
  getLinkedTimelineClipIds,
  getInteractionTimelineClips,
  getFitTimelineZoom,
  getMediaTimelineClips,
  getNodeTimelineTrackHeight,
  getTimelineClipLabel,
  getTimelineEdgeScroll,
  getTimelineQteDisplayName,
  getTimelineRulerTicks,
  getTimelineSplitTargetClipIds,
  insertTimelineClip,
  linkTimelineClips,
  moveTimelineClip,
  moveTimelineClipGroup,
  moveTimelineClipKeyframes,
  moveTimelineClipsByDelta,
  moveLinkedTimelineClipsByDelta,
  pasteTimelineClip,
  pasteTimelineClips,
  pasteTimelineClipKeyframes,
  reorderTimelineTrack,
  removeTimelineClipKeyframes,
  resolveTimelineClipKeyframes,
  selectTimelineClipIdsInRange,
  setTimelineClipsEnabled,
  setTimelineClipsHidden,
  setTimelineClipsMuted,
  setTimelineClipKeyframesInterpolation,
  setTimelinePlayhead,
  setTimelineZoom,
  snapOverlayRect,
  splitTimelineClip,
  splitTimelineClips,
  TIMELINE_FRAME_STEP_SECONDS,
  timelineSliderToZoom,
  timelineZoomToSlider,
  toggleTimelineBookmark,
  toggleTimelineSourceAudioSeparation,
  trimTimelineClip,
  trimTimelineClipGroup,
  trimTimelineClipWithRipple,
  unlinkTimelineClips,
  upsertTimelineClipKeyframe,
  updateTimelineBookmark,
  updateTimelineClipRect,
  updateTimelineTrack,
} from '@/app/_features/node-timeline';
import { buildNodeEffects, compileNodeTimeline, createRuntime, getActiveTimelineClips, getActiveTimelineMediaClips, getTimelineClipRuntimeEndTime, getTimelineDuration } from '@/app/_utils/graphRuntime';
import { getTimelineClipOutputHandleId } from '@/app/_utils/timelineOutputEdges';

vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => `id-${Math.random().toString(36).slice(2)}`),
});

const node = (id: string, type: AppNode['type'], data: AppNode['data']): AppNode => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data,
});

describe('NodeTimeline v2', () => {
  it('normalizes empty node timelines to media and interaction tracks', () => {
    const timeline = ensureNodeTimeline();

    expect(timeline.version).toBe(2);
    expect(timeline.tracks.map((track) => track.type)).toEqual(['media', 'interaction']);
    expect(timeline.duration).toBeGreaterThan(0);
    expect(timeline.bookmarks).toEqual([]);
  });

  it('creates normal button clips without QTE config by default', () => {
    const buttonClip = createInteractionClip('button', 1, 8);

    expect(buttonClip.mode).toBeUndefined();
    expect(buttonClip.qte).toBeUndefined();
    expect(buttonClip.label).toBe('New choice');
    expect(buttonClip).not.toHaveProperty('action');
  });

  it('preserves intentionally empty button labels for display', () => {
    const buttonClip = { ...createInteractionClip('button', 1, 8), label: '', name: '' };

    expect(getTimelineClipLabel(buttonClip)).toBe('');
  });

  it('preserves intentionally empty QTE display names', () => {
    const qteClip = { ...createInteractionClip('button', 1, 8), mode: 'qte' as const, label: '', name: '' };

    expect(getTimelineQteDisplayName(qteClip)).toBe('');
    expect(getTimelineClipLabel(qteClip)).not.toContain('QTE');
  });

  it('preserves hidden QTE cue label settings', () => {
    const timeline = ensureNodeTimeline({
      version: 2,
      duration: 8,
      bookmarks: [],
      tracks: [
        {
          id: 'interaction-track',
          type: 'interaction',
          name: 'Interaction',
          clips: [
            {
              id: 'space-qte',
              type: 'button',
              mode: 'qte',
              startTime: 1,
              duration: 2,
              enabled: true,
              label: '',
              rect: { x: 0.2, y: 0.3, width: 0.2, height: 0.1 },
              qte: { input: 'space', keyLabel: 'Space', showCueLabel: false },
            },
          ],
        },
      ],
    } as NodeTimeline);

    const clip = getInteractionTimelineClips(timeline)[0];
    expect(clip?.qte?.showCueLabel).toBe(false);
  });

  it('normalizes QTE button clips while keeping old buttons compatible', () => {
    const timeline = ensureNodeTimeline({
      version: 2,
      duration: 8,
      bookmarks: [],
      tracks: [
        {
          id: 'interaction-track',
          type: 'interaction',
          name: 'Interaction',
          clips: [
            {
              id: 'old-button',
              type: 'button',
              startTime: 0,
              duration: 2,
              enabled: true,
              label: 'Old button',
              rect: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
              pauseOnShow: false,
            },
            {
              id: 'space-qte',
              type: 'button',
              mode: 'qte',
              startTime: 2,
              duration: 2.5,
              enabled: true,
              label: 'Dodge',
              rect: { x: 0.2, y: 0.3, width: 0.2, height: 0.1 },
              pauseOnShow: true,
              qte: { input: 'space' },
            },
          ],
        },
      ],
    } as NodeTimeline);

    const clips = getInteractionTimelineClips(timeline);
    expect(clips[0]?.id).toBe('old-button');
    expect(clips[0]?.mode).toBeUndefined();
    expect(clips[0]?.qte).toBeUndefined();
    expect(clips[1]).toMatchObject({
      id: 'space-qte',
      mode: 'qte',
      pauseOnShow: true,
      qte: { input: 'space', keyLabel: 'Space', showCountdown: true },
    });
  });

  it('normalizes button style fields without requiring legacy clips to define style', () => {
    const timeline = ensureNodeTimeline({
      version: 2,
      duration: 8,
      bookmarks: [],
      tracks: [
        {
          id: 'interaction-track',
          type: 'interaction',
          name: 'Interaction',
          clips: [
            {
              id: 'styled-button',
              type: 'button',
              startTime: 0,
              duration: 2,
              enabled: true,
              label: 'Styled',
              rect: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
              pauseOnShow: false,
              style: {
                preset: 'glass',
                shape: 'hexagon',
                fillColor: '22c55e',
                textColor: '#fff',
                borderColor: 'not-a-color',
                fillOpacity: 2,
                borderOpacity: -1,
                borderWidth: 9,
                shadow: 'strong',
                backgroundImageAssetId: 'background-asset',
                backgroundImageSrc: 'assets/button-background.png',
                backgroundImageFit: 'contain',
              },
            },
            {
              id: 'old-button',
              type: 'button',
              startTime: 2,
              duration: 2,
              enabled: true,
              label: 'Old',
              rect: { x: 0.2, y: 0.3, width: 0.2, height: 0.1 },
              pauseOnShow: false,
            },
          ],
        },
      ],
    } as NodeTimeline);

    const [styledButton, oldButton] = getInteractionTimelineClips(timeline);
    expect(styledButton?.style).toEqual({
      preset: 'glass',
      shape: 'hexagon',
      fillColor: '#22c55e',
      textColor: '#ffffff',
      borderColor: '#fed7aa',
      fillOpacity: 1,
      borderOpacity: 0,
      borderWidth: 4,
      shadow: 'strong',
      backgroundImageAssetId: 'background-asset',
      backgroundImageSrc: 'assets/button-background.png',
      backgroundImageFit: 'contain',
    });
    expect(oldButton?.style).toBeUndefined();
  });

  it('creates optional-click buttons by default and preserves explicit pause waits', () => {
    const buttonClip = createInteractionClip('button', 1, 8);
    const pauseButtonClip = { ...buttonClip, id: 'pause-button', pauseOnShow: true };
    const timeline = ensureNodeTimeline({
      version: 2,
      duration: 8,
      bookmarks: [],
      tracks: [
        {
          id: 'interaction-track',
          type: 'interaction',
          name: 'Interaction',
          clips: [buttonClip, pauseButtonClip],
        },
      ],
    } as NodeTimeline);

    const [optionalButton, pauseButton] = timeline.tracks.flatMap((track) => track.clips);
    expect(buttonClip.pauseOnShow).toBe(false);
    expect(optionalButton?.type === 'button' ? optionalButton.pauseOnShow : null).toBe(false);
    expect(pauseButton?.type === 'button' ? pauseButton.pauseOnShow : null).toBe(true);
  });

  it('drops legacy hidden interaction and timed action clip types', () => {
    const buttonClip = createInteractionClip('button', 1, 8);
    const timeline = {
      version: 2,
      duration: 8,
      bookmarks: [],
      tracks: [
        {
          id: 'raw-interaction-track',
          type: 'interaction',
          name: 'Interaction',
          clips: [
            buttonClip,
            { id: 'legacy-hotspot', type: 'hotspot', startTime: 1, duration: 1, enabled: true, rect: { x: 0, y: 0, width: 0.2, height: 0.2 } },
            { id: 'legacy-pause', type: 'pauseGate', startTime: 2, duration: 1, enabled: true, label: 'Continue' },
            { id: 'legacy-text', type: 'text', startTime: 3, duration: 1, enabled: true, text: 'Title' },
            { id: 'legacy-branch', type: 'branch', startTime: 4, duration: 1, enabled: true },
            { id: 'legacy-variable', type: 'variable', startTime: 5, duration: 1, enabled: true },
          ],
        },
      ],
    } as unknown as NodeTimeline;
    const normalized = ensureNodeTimeline(timeline);
    const story = node('story', 'scene', { type: 'scene', title: 'Story', bodyText: '', timeline: normalized });

    expect(normalized.tracks.flatMap((track) => track.clips.map((clip) => clip.id))).toEqual([buttonClip.id]);
    expect(compileNodeTimeline(story).interactionClips.map((clip) => clip.id)).toEqual([buttonClip.id]);
  });

  it('treats clip end times as exclusive so adjacent clips do not overlap at cuts', () => {
    const firstMedia = createMediaClip({ type: 'image', src: 'assets/first.png', startTime: 0, duration: 2 });
    const secondMedia = createMediaClip({ type: 'image', src: 'assets/second.png', startTime: 2, duration: 3 });
    const firstButton = createInteractionClip('button', 1, 5);
    const secondButton = createInteractionClip('button', 3, 5);
    firstButton.duration = 2;
    secondButton.duration = 2;
    let timeline = insertTimelineClip({ timeline: ensureNodeTimeline({ duration: 5 }), clip: firstMedia });
    timeline = insertTimelineClip({ timeline, clip: secondMedia });
    timeline = insertTimelineClip({ timeline, clip: firstButton });
    timeline = insertTimelineClip({ timeline, clip: secondButton });
    const story = node('story', 'scene', { type: 'scene', title: 'Story', bodyText: '', timeline });

    expect(getActiveTimelineMediaClips(story, 2).map((clip) => clip.id)).toEqual([secondMedia.id]);
    expect(getActiveTimelineClips(story, 3).map((clip) => clip.id)).toEqual([secondButton.id]);
    expect(buildNodeEffects(story, [], 2)).toContainEqual(expect.objectContaining({ type: 'playMedia', mediaType: 'image', src: 'assets/second.png' }));
    expect(buildNodeEffects(story, [], 2)).not.toContainEqual(expect.objectContaining({ type: 'playMedia', mediaType: 'image', src: 'assets/first.png' }));
  });

  it('uses type-aware timeline track heights for OpenCut-style layout', () => {
    const timeline = ensureNodeTimeline();
    const heights = Object.fromEntries(timeline.tracks.map((track) => [track.type, getNodeTimelineTrackHeight(track)]));

    expect(heights.media).toBeGreaterThan(heights.interaction);
    expect(getNodeTimelineTrackHeight({ ...timeline.tracks[0]!, collapsed: true })).toBeLessThan(heights.interaction);
  });

  it('formats timeline ruler labels with OpenCut-style seconds and frames', () => {
    const labels = getTimelineRulerTicks({ duration: 1, zoom: 180 })
      .filter((tick) => tick.label)
      .map((tick) => tick.label);

    expect(labels.slice(0, 4)).toEqual(['00:00', '10f', '20f', '00:01']);
    expect(formatTimelineRulerLabel(61)).toBe('01:01');
    expect(formatTimelineRulerLabel(3661)).toBe('1:01:01');
  });

  it('maps OpenCut-style zoom slider values and clamps saved timeline zoom', () => {
    const minZoom = timelineSliderToZoom(0);
    const maxZoom = timelineSliderToZoom(1);
    const midpointZoom = timelineSliderToZoom(0.5);

    expect(minZoom).toBe(clampTimelineZoom(-100));
    expect(maxZoom).toBe(clampTimelineZoom(10_000));
    expect(midpointZoom).toBeGreaterThan(minZoom);
    expect(midpointZoom).toBeLessThan(maxZoom);
    expect(timelineZoomToSlider(midpointZoom)).toBeCloseTo(0.5, 5);
    expect(timelineZoomToSlider(-100)).toBe(0);
    expect(timelineZoomToSlider(10_000)).toBe(1);
    expect(setTimelineZoom(ensureNodeTimeline(), 10_000).zoom).toBe(maxZoom);
  });

  it('computes fit-to-view timeline zoom with clamping', () => {
    expect(getFitTimelineZoom({ duration: 20, viewportWidth: 960, padding: 160 })).toBe(40);
    expect(getFitTimelineZoom({ duration: 240, viewportWidth: 600 })).toBe(clampTimelineZoom(0));
    expect(getFitTimelineZoom({ duration: 0, viewportWidth: 5000 })).toBe(clampTimelineZoom(50_000));
  });

  it('computes bidirectional timeline edge auto-scroll deltas', () => {
    const leftTop = getTimelineEdgeScroll({
      pointerClientX: 10,
      pointerClientY: 15,
      viewportLeft: 0,
      viewportTop: 0,
      viewportWidth: 500,
      viewportHeight: 300,
      scrollLeft: 120,
      scrollTop: 80,
      scrollWidth: 1000,
      scrollHeight: 900,
      contentWidth: 1200,
      edgeThreshold: 100,
      maxScrollSpeed: 20,
    });
    const rightBottom = getTimelineEdgeScroll({
      pointerClientX: 490,
      pointerClientY: 295,
      viewportLeft: 0,
      viewportTop: 0,
      viewportWidth: 500,
      viewportHeight: 300,
      scrollLeft: 120,
      scrollTop: 80,
      scrollWidth: 1000,
      scrollHeight: 900,
      contentWidth: 1200,
      edgeThreshold: 100,
      maxScrollSpeed: 20,
    });
    const atLimits = getTimelineEdgeScroll({
      pointerClientX: 490,
      pointerClientY: 295,
      viewportLeft: 0,
      viewportTop: 0,
      viewportWidth: 500,
      viewportHeight: 300,
      scrollLeft: 700,
      scrollTop: 600,
      scrollWidth: 1000,
      scrollHeight: 900,
      contentWidth: 1200,
      edgeThreshold: 100,
      maxScrollSpeed: 20,
    });

    expect(leftTop.maxScrollLeft).toBe(700);
    expect(leftTop.maxScrollTop).toBe(600);
    expect(leftTop.scrollLeftDelta).toBeLessThan(0);
    expect(leftTop.scrollTopDelta).toBeLessThan(0);
    expect(rightBottom.scrollLeftDelta).toBeGreaterThan(0);
    expect(rightBottom.scrollTopDelta).toBeGreaterThan(0);
    expect(atLimits.scrollLeftDelta).toBe(0);
    expect(atLimits.scrollTopDelta).toBe(0);
  });

  it('builds display-ready audio waveform peaks from decoded samples', () => {
    const peaks = buildAudioWaveformPeaks({
      channels: [new Float32Array([0, 0.04, 0.1, 0.04, 0.8, 0.6, -1, 0.5])],
      sampleRate: 4,
      durationSec: 2,
      barCount: 2,
    });

    expect(peaks).toHaveLength(2);
    expect(peaks[0]).toBeGreaterThan(0);
    expect(peaks[0]).toBeLessThan(1);
    expect(peaks[1]).toBe(1);
  });

  it('samples waveform peaks from the clip source offset and duration', () => {
    const peaks = buildAudioWaveformPeaks({
      channels: [new Float32Array([0, 0, 1, 1])],
      sampleRate: 2,
      sourceStartSec: 1,
      durationSec: 1,
      barCount: 1,
    });

    expect(peaks).toEqual([1]);
  });

  it('snaps preview overlays to canvas guides', () => {
    const result = snapOverlayRect({
      rect: { x: 0.392, y: 0.17, width: 0.2, height: 0.1 },
    });

    expect(result.rect.x).toBeCloseTo(0.4, 3);
    expect(result.lines).toContainEqual({ orientation: 'vertical', position: 0.5 });
  });

  it('builds preview overlay snap targets from other overlays', () => {
    const targets = buildPreviewSnapTargets([{ x: 0.1, y: 0.2, width: 0.2, height: 0.12 }]);
    const result = snapOverlayRect({
      rect: { x: 0.295, y: 0.44, width: 0.18, height: 0.1 },
      targets,
    });

    expect(result.rect.x).toBeCloseTo(0.3, 3);
    expect(result.lines).toContainEqual({ orientation: 'vertical', position: 0.3 });
  });

  it('snaps overlay resize handles by changing size instead of moving the overlay', () => {
    const result = snapOverlayRect({
      rect: { x: 0.1, y: 0.2, width: 0.392, height: 0.21 },
      resizeHandle: 'se',
    });

    expect(result.rect.x).toBeCloseTo(0.1, 3);
    expect(result.rect.width).toBeCloseTo(0.4, 3);
    expect(result.lines).toContainEqual({ orientation: 'vertical', position: 0.5 });
  });

  it('stores and resolves local clip property keyframes', () => {
    const clip = {
      ...createMediaClip({ type: 'video', src: 'assets/keyframed.mp4', startTime: 2, duration: 6 }),
      rect: { x: 0, y: 0, width: 1, height: 1 },
      opacity: 1,
    };
    let timeline = insertTimelineClip({ timeline: ensureNodeTimeline(), clip });

    timeline = upsertTimelineClipKeyframe({ timeline, clipId: clip.id, property: 'opacity', time: 2, value: 0.2 });
    timeline = upsertTimelineClipKeyframe({ timeline, clipId: clip.id, property: 'opacity', time: 8, value: 0.8 });
    timeline = upsertTimelineClipKeyframe({ timeline, clipId: clip.id, property: 'x', time: 2, value: 0 });
    timeline = upsertTimelineClipKeyframe({ timeline, clipId: clip.id, property: 'x', time: 8, value: 0.4 });
    timeline = upsertTimelineClipKeyframe({ timeline, clipId: clip.id, property: 'width', time: 2, value: 1 });
    timeline = upsertTimelineClipKeyframe({ timeline, clipId: clip.id, property: 'width', time: 8, value: 0.5 });

    const storedClip = findTimelineClip(timeline, clip.id)?.clip;
    if (!storedClip) throw new Error('Expected keyframed clip');

    expect(storedClip.keyframes).toHaveLength(6);
    expect(storedClip.keyframes?.filter((keyframe) => keyframe.property === 'opacity').map((keyframe) => keyframe.time)).toEqual([0, 6]);

    const resolved = resolveTimelineClipKeyframes(storedClip, 5);
    expect(resolved.opacity).toBeCloseTo(0.5, 5);
    expect((resolved as typeof clip).rect).toMatchObject({ x: 0.2, width: 0.75 });
  });

  it('updates an existing property keyframe at the current playhead time', () => {
    const clip = {
      ...createInteractionClip('button', 2, 8),
      opacity: 1,
    };
    let timeline = insertTimelineClip({ timeline: ensureNodeTimeline({ duration: 8 }), clip });

    timeline = upsertTimelineClipKeyframe({ timeline, clipId: clip.id, property: 'opacity', time: 4, value: 0.25 });
    timeline = upsertTimelineClipKeyframe({ timeline, clipId: clip.id, property: 'opacity', time: 4, value: 0.65 });
    const storedClip = findTimelineClip(timeline, clip.id)?.clip;
    if (!storedClip) throw new Error('Expected keyframed clip');

    expect(storedClip.keyframes).toHaveLength(1);
    expect(storedClip.keyframes?.[0]).toMatchObject({ property: 'opacity', time: 2, value: 0.65 });
    expect(resolveTimelineClipKeyframes(storedClip, 4).opacity).toBe(0.65);
  });

  it('resolves hold interpolation for keyframes and can switch back to linear', () => {
    const clip = createMediaClip({ type: 'video', src: 'assets/hold.mp4', startTime: 0, duration: 4 });
    let timeline = insertTimelineClip({ timeline: ensureNodeTimeline(), clip });
    timeline = upsertTimelineClipKeyframe({ timeline, clipId: clip.id, property: 'opacity', time: 0, value: 0.2 });
    timeline = upsertTimelineClipKeyframe({ timeline, clipId: clip.id, property: 'opacity', time: 4, value: 0.8 });

    const firstKeyframe = findTimelineClip(timeline, clip.id)?.clip.keyframes?.[0];
    if (!firstKeyframe) throw new Error('Expected keyframe');

    timeline = setTimelineClipKeyframesInterpolation({
      timeline,
      clipId: clip.id,
      keyframeIds: [firstKeyframe.id],
      interpolation: 'hold',
    });
    const heldClip = findTimelineClip(timeline, clip.id)?.clip;
    if (!heldClip) throw new Error('Expected held clip');

    expect(heldClip.keyframes?.[0]).toMatchObject({ interpolation: 'hold' });
    expect(resolveTimelineClipKeyframes(heldClip, 2).opacity).toBe(0.2);

    timeline = setTimelineClipKeyframesInterpolation({
      timeline,
      clipId: clip.id,
      keyframeIds: [firstKeyframe.id],
      interpolation: 'linear',
    });
    const linearClip = findTimelineClip(timeline, clip.id)?.clip;
    if (!linearClip) throw new Error('Expected linear clip');

    expect(linearClip.keyframes?.[0].interpolation).toBeUndefined();
    expect(resolveTimelineClipKeyframes(linearClip, 2).opacity).toBeCloseTo(0.5);
  });

  it('normalizes OpenCut-style keyframe segment interpolation fields', () => {
    const clip = createMediaClip({ type: 'video', src: 'assets/segment.mp4', startTime: 0, duration: 4 });
    const timeline = ensureNodeTimeline({
      version: 2,
      duration: 4,
      bookmarks: [],
      tracks: [
        {
          id: 'media-track-main',
          type: 'media',
          name: 'Media',
          clips: [
            {
              ...clip,
              keyframes: [
                { id: 'first', property: 'opacity', time: 0, value: 0.1, segmentToNext: 'hold' },
                { id: 'second', property: 'opacity', time: 4, value: 0.9 },
              ],
            },
          ],
        },
      ],
    } as unknown as NodeTimeline);
    const normalizedClip = findTimelineClip(timeline, clip.id)?.clip;
    if (!normalizedClip) throw new Error('Expected normalized clip');

    expect(normalizedClip.keyframes?.[0]).toMatchObject({ interpolation: 'hold' });
    expect(resolveTimelineClipKeyframes(normalizedClip, 2).opacity).toBe(0.1);
  });

  it('moves clip keyframes inside clip-local bounds', () => {
    const clip = {
      ...createMediaClip({ type: 'video', src: 'assets/keyframed.mp4', startTime: 2, duration: 6 }),
      rect: { x: 0, y: 0, width: 1, height: 1 },
    };
    let timeline = insertTimelineClip({ timeline: ensureNodeTimeline(), clip });
    timeline = upsertTimelineClipKeyframe({ timeline, clipId: clip.id, property: 'opacity', time: 3, value: 0.2 });
    timeline = upsertTimelineClipKeyframe({ timeline, clipId: clip.id, property: 'opacity', time: 6, value: 0.8 });
    const storedClip = findTimelineClip(timeline, clip.id)?.clip;
    const firstKeyframe = storedClip?.keyframes?.find((keyframe) => keyframe.value === 0.2);
    const secondKeyframe = storedClip?.keyframes?.find((keyframe) => keyframe.value === 0.8);
    if (!firstKeyframe || !secondKeyframe) throw new Error('Expected keyframes');

    timeline = moveTimelineClipKeyframes({ timeline, clipId: clip.id, keyframeIds: [firstKeyframe.id, secondKeyframe.id], deltaTime: 10 });
    const movedClip = findTimelineClip(timeline, clip.id)?.clip;

    expect(movedClip?.keyframes?.map((keyframe) => keyframe.time)).toEqual([3, 6]);
  });

  it('removes keyframes and persists the resolved channel value when the channel becomes static', () => {
    const clip = {
      ...createMediaClip({ type: 'video', src: 'assets/keyframed.mp4', startTime: 2, duration: 6 }),
      opacity: 1,
    };
    let timeline = insertTimelineClip({ timeline: ensureNodeTimeline(), clip });
    timeline = upsertTimelineClipKeyframe({ timeline, clipId: clip.id, property: 'opacity', time: 2, value: 0.2 });
    timeline = upsertTimelineClipKeyframe({ timeline, clipId: clip.id, property: 'opacity', time: 8, value: 0.8 });
    const storedClip = findTimelineClip(timeline, clip.id)?.clip;
    const keyframeIds = storedClip?.keyframes?.map((keyframe) => keyframe.id) ?? [];

    timeline = removeTimelineClipKeyframes({ timeline, clipId: clip.id, keyframeIds, valueAtTime: 5 });
    const staticClip = findTimelineClip(timeline, clip.id)?.clip;

    expect(staticClip?.keyframes).toBeUndefined();
    expect(staticClip?.opacity).toBeCloseTo(0.5);
  });

  it('copies and pastes keyframes with OpenCut-style local time offsets', () => {
    const sourceClip = {
      ...createMediaClip({ type: 'video', src: 'assets/source.mp4', startTime: 0, duration: 6 }),
      rect: { x: 0, y: 0, width: 1, height: 1 },
    };
    const targetClip = {
      ...createMediaClip({ type: 'image', src: 'assets/target.png', startTime: 10, duration: 8 }),
      rect: { x: 0, y: 0, width: 1, height: 1 },
    };
    let timeline = insertTimelineClip({ timeline: ensureNodeTimeline(), clip: sourceClip });
    timeline = insertTimelineClip({ timeline, clip: targetClip });
    timeline = upsertTimelineClipKeyframe({ timeline, clipId: sourceClip.id, property: 'opacity', time: 1, value: 0.2 });
    timeline = upsertTimelineClipKeyframe({ timeline, clipId: sourceClip.id, property: 'x', time: 3, value: 0.45 });
    const sourceKeyframeId = findTimelineClip(timeline, sourceClip.id)?.clip.keyframes?.[0]?.id;
    if (!sourceKeyframeId) throw new Error('Expected source keyframe');
    timeline = setTimelineClipKeyframesInterpolation({ timeline, clipId: sourceClip.id, keyframeIds: [sourceKeyframeId], interpolation: 'hold' });
    const sourceKeyframes = findTimelineClip(timeline, sourceClip.id)?.clip.keyframes ?? [];
    const clipboardItems = [
      ...createTimelineKeyframeClipboardItems(sourceKeyframes),
      { property: 'volume' as const, timeOffset: 1, value: 0.5 },
    ];

    const pasted = pasteTimelineClipKeyframes({
      timeline,
      clipId: targetClip.id,
      items: clipboardItems,
      time: 12,
    });
    const pastedClip = findTimelineClip(pasted.timeline, targetClip.id)?.clip;

    expect(clipboardItems.slice(0, 2)).toEqual([
      { property: 'opacity', timeOffset: 0, value: 0.2, interpolation: 'hold' },
      { property: 'x', timeOffset: 2, value: 0.45 },
    ]);
    expect(pasted.keyframeIds).toHaveLength(2);
    expect(pastedClip?.keyframes).toMatchObject([
      { property: 'opacity', time: 2, value: 0.2, interpolation: 'hold' },
      { property: 'x', time: 4, value: 0.45 },
    ]);

    const locked = updateTimelineTrack({ timeline: pasted.timeline, trackId: findTimelineClip(pasted.timeline, targetClip.id)?.track.id as string, patch: { locked: true } });
    const blocked = pasteTimelineClipKeyframes({ timeline: locked, clipId: targetClip.id, items: clipboardItems, time: 13 });
    expect(blocked.keyframeIds).toEqual([]);
    expect(findTimelineClip(blocked.timeline, targetClip.id)?.clip.keyframes).toEqual(pastedClip?.keyframes);
  });

  it('updates preview transform rects for visual media and interaction clips while respecting locked tracks', () => {
    const videoClip = createMediaClip({ type: 'video', src: 'assets/visual.mp4', startTime: 0, duration: 4 });
    const buttonClip = createInteractionClip('button', 0, 8);
    let timeline = insertTimelineClip({ timeline: ensureNodeTimeline(), clip: videoClip });
    timeline = insertTimelineClip({ timeline, clip: buttonClip });

    timeline = updateTimelineClipRect({
      timeline,
      clipId: videoClip.id,
      rect: { x: -0.2, y: 0.25, width: 2, height: 0.5 },
    });
    timeline = updateTimelineClipRect({
      timeline,
      clipId: buttonClip.id,
      rect: { x: 0.4, y: 0.35, width: 0.2, height: 0.12 },
    });

    expect(findTimelineClip(timeline, videoClip.id)?.clip).toMatchObject({ rect: { x: 0, y: 0.25, width: 1, height: 0.5 } });
    expect(findTimelineClip(timeline, buttonClip.id)?.clip).toMatchObject({ rect: { x: 0.4, y: 0.35, width: 0.2, height: 0.12 } });

    const locked = updateTimelineTrack({ timeline, trackId: 'media-track-main', patch: { locked: true } });
    const afterLockedUpdate = updateTimelineClipRect({
      timeline: locked,
      clipId: videoClip.id,
      rect: { x: 0.3, y: 0.3, width: 0.3, height: 0.3 },
    });

    expect(findTimelineClip(afterLockedUpdate, videoClip.id)?.clip).toMatchObject({ rect: { x: 0, y: 0.25, width: 1, height: 0.5 } });
  });

  it('returns the same timeline for no-op move, trim, and rect commands', () => {
    const videoClip = { ...createMediaClip({ type: 'video', src: 'assets/noop.mp4', startTime: 2, duration: 4 }), sourceStart: 1 };
    let timeline = insertTimelineClip({ timeline: ensureNodeTimeline(), clip: videoClip });

    const withRect = updateTimelineClipRect({
      timeline,
      clipId: videoClip.id,
      rect: { x: 0.1, y: 0.2, width: 0.5, height: 0.4 },
    });
    expect(updateTimelineClipRect({
      timeline: withRect,
      clipId: videoClip.id,
      rect: { x: 0.1, y: 0.2, width: 0.5, height: 0.4 },
    })).toBe(withRect);

    timeline = withRect;
    expect(moveTimelineClip({
      timeline,
      clipId: videoClip.id,
      trackId: 'media-track-main',
      startTime: videoClip.startTime,
    })).toBe(timeline);
    expect(moveTimelineClipGroup({
      timeline,
      clipIds: [videoClip.id],
      anchorClipId: videoClip.id,
      trackId: 'media-track-main',
      startTime: videoClip.startTime,
    })).toBe(timeline);
    expect(trimTimelineClip({ timeline, clipId: videoClip.id, side: 'left', time: videoClip.startTime })).toBe(timeline);
    expect(trimTimelineClip({ timeline, clipId: videoClip.id, side: 'right', time: videoClip.startTime + videoClip.duration })).toBe(timeline);
    expect(trimTimelineClipWithRipple({ timeline, clipId: videoClip.id, side: 'right', time: videoClip.startTime + videoClip.duration })).toBe(timeline);
  });

  it('inserts media and interaction clips into their v2 tracks', () => {
    const mediaClip = createMediaClip({
      type: 'video',
      src: 'assets/intro.mp4',
      startTime: 0,
      duration: 8,
    });
    const buttonClip = createInteractionClip('button', 2, 12);

    const withMedia = insertTimelineClip({ timeline: ensureNodeTimeline(), clip: mediaClip });
    const timeline = insertTimelineClip({ timeline: withMedia, clip: buttonClip });

    expect(getMediaTimelineClips(timeline)).toMatchObject([{ type: 'video', src: 'assets/intro.mp4', duration: 8 }]);
    expect(getInteractionTimelineClips(timeline)).toMatchObject([{ type: 'button', startTime: 2 }]);
  });

  it('seeds media source duration when imported asset duration is known', () => {
    const audioClip = createMediaClip({
      type: 'audio',
      src: 'assets/dialogue.mp3',
      startTime: 0,
      duration: 12.345,
      sourceDuration: 12.345,
    });
    const imageClip = createMediaClip({
      type: 'image',
      src: 'assets/card.png',
      startTime: 0,
      duration: 4,
      sourceDuration: 4,
    });

    expect(audioClip).toMatchObject({ duration: 12.35, sourceStart: 0, sourceDuration: 12.35 });
    expect(imageClip).toMatchObject({ duration: 4, sourceStart: 0 });
    expect(imageClip.sourceDuration).toBeUndefined();
  });

  it('falls back to compatible tracks when a dropped clip prefers the wrong track type', () => {
    const mediaClip = createMediaClip({ type: 'video', src: 'assets/intro.mp4', startTime: 0, duration: 8 });
    const buttonClip = createInteractionClip('button', 2, 12);

    let timeline = insertTimelineClip({
      timeline: ensureNodeTimeline(),
      clip: mediaClip,
      trackId: 'interaction-track-main',
    });
    timeline = insertTimelineClip({
      timeline,
      clip: buttonClip,
      trackId: 'media-track-main',
    });

    expect(findTimelineClip(timeline, mediaClip.id)?.track).toMatchObject({ id: 'media-track-main', type: 'media' });
    expect(findTimelineClip(timeline, buttonClip.id)?.track).toMatchObject({ id: 'interaction-track-main', type: 'interaction' });
  });

  it('places overlapping clips on a free compatible track or creates a new one', () => {
    const firstClip = createMediaClip({ type: 'video', src: 'assets/first.mp4', startTime: 0, duration: 8 });
    const secondClip = createMediaClip({ type: 'video', src: 'assets/second.mp4', startTime: 2, duration: 4 });
    const laterClip = createMediaClip({ type: 'video', src: 'assets/later.mp4', startTime: 10, duration: 2 });

    let timeline = insertTimelineClip({ timeline: ensureNodeTimeline(), clip: firstClip });
    timeline = insertTimelineClip({ timeline, clip: secondClip });

    expect(timeline.tracks.filter((track) => track.type === 'media')).toHaveLength(2);
    expect(findTimelineClip(timeline, firstClip.id)?.track.id).toBe('media-track-main');
    expect(findTimelineClip(timeline, secondClip.id)?.track.id).not.toBe('media-track-main');

    timeline = insertTimelineClip({ timeline, clip: laterClip });
    expect(timeline.tracks.filter((track) => track.type === 'media')).toHaveLength(2);
    expect(findTimelineClip(timeline, laterClip.id)?.track.id).toBe('media-track-main');
  });

  it('can insert a clip into a newly created compatible track', () => {
    const clip = createMediaClip({ type: 'video', src: 'assets/overlay.mp4', startTime: 0, duration: 4 });

    const timeline = insertTimelineClip({ timeline: ensureNodeTimeline(), clip, forceNewTrack: true });
    const clipRef = findTimelineClip(timeline, clip.id);
    const mediaTracks = timeline.tracks.filter((track) => track.type === 'media');

    expect(mediaTracks).toHaveLength(2);
    expect(clipRef?.track.id).not.toBe('media-track-main');
    expect(clipRef?.track).toMatchObject({ type: 'media', mediaRole: 'overlay' });
  });

  it('can insert a forced new track at a preferred timeline index', () => {
    const clip = createMediaClip({ type: 'video', src: 'assets/overlay.mp4', startTime: 0, duration: 4 });
    let timeline = addTimelineTrack({ timeline: ensureNodeTimeline(), type: 'media' });
    const originalTrackIds = timeline.tracks.map((track) => track.id);

    timeline = insertTimelineClip({
      timeline,
      clip,
      forceNewTrack: true,
      newTrackInsertIndex: 1,
    });
    const clipRef = findTimelineClip(timeline, clip.id);

    expect(timeline.tracks[0].id).toBe(originalTrackIds[0]);
    expect(timeline.tracks[1].id).toBe(clipRef?.track.id);
    expect(timeline.tracks[2].id).toBe(originalTrackIds[1]);
  });

  it('adds a generated track directly after the requested track', () => {
    const timeline = addTimelineTrack({
      timeline: ensureNodeTimeline(),
      type: 'interaction',
      afterTrackId: 'interaction-track-main',
    });
    const mainTrackIndex = timeline.tracks.findIndex((track) => track.id === 'interaction-track-main');
    const generatedTrack = timeline.tracks[mainTrackIndex + 1];

    expect(generatedTrack).toMatchObject({
      id: 'interaction-track-main-2',
      type: 'interaction',
      name: 'Interaction 2',
      clips: [],
    });
  });

  it('routes audio clips to OpenCut-style audio media tracks', () => {
    const videoClip = createMediaClip({ type: 'video', src: 'assets/main.mp4', startTime: 0, duration: 8 });
    const audioClip = createMediaClip({ type: 'audio', src: 'assets/bed.mp3', startTime: 0, duration: 8 });
    const imageClip = createMediaClip({ type: 'image', src: 'assets/card.png', startTime: 1, duration: 2 });

    let timeline = insertTimelineClip({ timeline: ensureNodeTimeline(), clip: videoClip });
    timeline = insertTimelineClip({ timeline, clip: audioClip, trackId: 'media-track-main' });
    timeline = insertTimelineClip({ timeline, clip: imageClip });

    const audioTrack = findTimelineClip(timeline, audioClip.id)?.track;
    const imageTrack = findTimelineClip(timeline, imageClip.id)?.track;

    expect(findTimelineClip(timeline, videoClip.id)?.track).toMatchObject({ id: 'media-track-main', mediaRole: 'main' });
    expect(audioTrack).toMatchObject({ type: 'media', mediaRole: 'audio', name: 'Audio' });
    expect(audioTrack?.id).not.toBe('media-track-main');
    expect(imageTrack?.mediaRole).not.toBe('audio');
  });

  it('prunes empty generated tracks after clips are deleted or moved away', () => {
    const firstClip = createMediaClip({ type: 'video', src: 'assets/first.mp4', startTime: 0, duration: 4 });
    const secondClip = createMediaClip({ type: 'video', src: 'assets/second.mp4', startTime: 1, duration: 2 });
    let timeline = insertTimelineClip({ timeline: ensureNodeTimeline(), clip: firstClip });
    timeline = insertTimelineClip({ timeline, clip: secondClip });
    const generatedTrackId = findTimelineClip(timeline, secondClip.id)?.track.id;

    expect(generatedTrackId).not.toBe('media-track-main');
    expect(timeline.tracks.filter((track) => track.type === 'media')).toHaveLength(2);

    const afterDelete = deleteTimelineClips({ timeline, clipIds: [secondClip.id] });
    expect(afterDelete.tracks.some((track) => track.id === generatedTrackId)).toBe(false);
    expect(afterDelete.tracks.filter((track) => track.type === 'media')).toHaveLength(1);

    timeline = insertTimelineClip({ timeline: afterDelete, clip: secondClip });
    const afterMove = moveTimelineClip({ timeline, clipId: secondClip.id, trackId: 'media-track-main', startTime: 5 });
    expect(findTimelineClip(afterMove, secondClip.id)?.track.id).toBe('media-track-main');
    expect(afterMove.tracks.filter((track) => track.type === 'media')).toHaveLength(1);
  });

  it('reuses an existing free same-type track before adding another track', () => {
    let timeline = addTimelineTrack({ timeline: ensureNodeTimeline(), type: 'media' });
    const extraMediaTrack = timeline.tracks.find((track) => track.type === 'media' && track.id !== 'media-track-main');
    const firstClip = createMediaClip({ type: 'video', src: 'assets/main.mp4', startTime: 0, duration: 8 });
    const secondClip = createMediaClip({ type: 'video', src: 'assets/free-track.mp4', startTime: 2, duration: 4 });

    timeline = insertTimelineClip({ timeline, clip: firstClip, trackId: 'media-track-main' });
    timeline = insertTimelineClip({ timeline, clip: secondClip });

    expect(timeline.tracks.filter((track) => track.type === 'media')).toHaveLength(2);
    expect(findTimelineClip(timeline, secondClip.id)?.track.id).toBe(extraMediaTrack?.id);
  });

  it('adds explicit tracks and moves clips between compatible tracks', () => {
    let timeline = addTimelineTrack({ timeline: ensureNodeTimeline(), type: 'media' });
    const mediaTracks = timeline.tracks.filter((track) => track.type === 'media');
    const clip = createMediaClip({ type: 'video', src: 'assets/upper.mp4', startTime: 0, duration: 4 });

    timeline = insertTimelineClip({ timeline, clip, trackId: mediaTracks[1].id });
    timeline = moveTimelineClip({ timeline, clipId: clip.id, trackId: mediaTracks[0].id, startTime: 8 });

    const clipRef = findTimelineClip(timeline, clip.id);
    expect(timeline.tracks.filter((track) => track.type === 'media')).toHaveLength(1);
    expect(clipRef?.track.id).toBe(mediaTracks[0].id);
    expect(clipRef?.clip.startTime).toBe(8);
  });

  it('can move a clip into a newly created compatible track', () => {
    const clip = createMediaClip({ type: 'video', src: 'assets/main.mp4', startTime: 0, duration: 4 });
    let timeline = insertTimelineClip({ timeline: ensureNodeTimeline(), clip });

    timeline = moveTimelineClip({ timeline, clipId: clip.id, startTime: 2, forceNewTrack: true });
    const clipRef = findTimelineClip(timeline, clip.id);
    const mediaTracks = timeline.tracks.filter((track) => track.type === 'media');

    expect(mediaTracks).toHaveLength(2);
    expect(clipRef?.track.id).not.toBe('media-track-main');
    expect(clipRef?.track).toMatchObject({ type: 'media', mediaRole: 'overlay' });
    expect(clipRef?.clip.startTime).toBe(2);
  });

  it('can move a clip into a newly created track at a preferred timeline index', () => {
    const clip = createMediaClip({ type: 'video', src: 'assets/main.mp4', startTime: 0, duration: 4 });
    const existingClip = createMediaClip({ type: 'video', src: 'assets/existing.mp4', startTime: 5, duration: 2 });
    let timeline = addTimelineTrack({ timeline: ensureNodeTimeline(), type: 'media' });
    const secondTrackId = timeline.tracks[1].id;
    timeline = insertTimelineClip({ timeline, clip, trackId: 'media-track-main' });
    timeline = insertTimelineClip({ timeline, clip: existingClip, trackId: secondTrackId });

    timeline = moveTimelineClip({
      timeline,
      clipId: clip.id,
      startTime: 2,
      forceNewTrack: true,
      newTrackInsertIndex: 1,
    });
    const clipRef = findTimelineClip(timeline, clip.id);

    expect(timeline.tracks[1].id).toBe(clipRef?.track.id);
    expect(timeline.tracks[2].id).toBe(secondTrackId);
    expect(clipRef?.clip.startTime).toBe(2);
  });

  it('reorders tracks without detaching their clips', () => {
    let timeline = addTimelineTrack({ timeline: ensureNodeTimeline(), type: 'media' });
    const extraMediaTrack = timeline.tracks.find((track) => track.type === 'media' && track.id !== 'media-track-main');
    const clip = createMediaClip({ type: 'video', src: 'assets/layer.mp4', startTime: 0, duration: 4 });
    timeline = insertTimelineClip({ timeline, clip, trackId: extraMediaTrack?.id });

    const reordered = reorderTimelineTrack({
      timeline,
      trackId: extraMediaTrack?.id as string,
      targetIndex: 0,
    });

    expect(reordered.tracks[0].id).toBe(extraMediaTrack?.id);
    expect(findTimelineClip(reordered, clip.id)?.track.id).toBe(extraMediaTrack?.id);
    expect(reorderTimelineTrack({ timeline: reordered, trackId: 'missing', targetIndex: 0 }).tracks.map((track) => track.id)).toEqual(reordered.tracks.map((track) => track.id));
  });

  it('deletes generated tracks while protecting the default node tracks', () => {
    let timeline = addTimelineTrack({ timeline: ensureNodeTimeline(), type: 'media' });
    timeline = addTimelineTrack({ timeline, type: 'interaction' });
    const extraMediaTrack = timeline.tracks.find((track) => track.type === 'media' && track.id !== 'media-track-main');
    const extraInteractionTrack = timeline.tracks.find((track) => track.type === 'interaction' && track.id !== 'interaction-track-main');
    const clip = createMediaClip({ type: 'video', src: 'assets/layer.mp4', startTime: 0, duration: 4 });
    const interactionClip = createInteractionClip('button', 1, timeline.duration);
    timeline = insertTimelineClip({ timeline, clip, trackId: extraMediaTrack?.id });
    timeline = insertTimelineClip({ timeline, clip: interactionClip, trackId: extraInteractionTrack?.id });

    for (const trackId of ['media-track-main', 'interaction-track-main']) {
      const afterDefaultTrackDelete = deleteTimelineTrack({ timeline, trackId });
      expect(afterDefaultTrackDelete.tracks.map((track) => track.id)).toEqual(timeline.tracks.map((track) => track.id));
    }

    timeline = deleteTimelineTrack({ timeline, trackId: extraMediaTrack?.id as string });
    expect(timeline.tracks.some((track) => track.id === extraMediaTrack?.id)).toBe(false);
    expect(findTimelineClip(timeline, clip.id)).toBeNull();

    timeline = deleteTimelineTrack({ timeline, trackId: extraInteractionTrack?.id as string });
    expect(timeline.tracks.some((track) => track.id === extraInteractionTrack?.id)).toBe(false);
    expect(findTimelineClip(timeline, interactionClip.id)).toBeNull();

    const baseTimeline = ensureNodeTimeline();
    const singleTrack = baseTimeline.tracks[0]!;
    const singleTrackTimeline = { ...baseTimeline, tracks: [singleTrack] };
    expect(deleteTimelineTrack({ timeline: singleTrackTimeline, trackId: singleTrack.id }).tracks).toHaveLength(1);
  });

  it('persists track control flags used by the context menu', () => {
    const timeline = ensureNodeTimeline();
    const updated = updateTimelineTrack({
      timeline,
      trackId: 'media-track-main',
      patch: { hidden: true, muted: true, locked: true, collapsed: true },
    });

    expect(updated.tracks.find((track) => track.id === 'media-track-main')).toMatchObject({
      hidden: true,
      muted: true,
      locked: true,
      collapsed: true,
    });
    expect(ensureNodeTimeline(updated).tracks.find((track) => track.id === 'media-track-main')).toMatchObject({
      collapsed: true,
    });
    expect(updateTimelineTrack({
      timeline: updated,
      trackId: 'interaction-track-main',
      patch: { muted: true },
    }).tracks.find((track) => track.id === 'interaction-track-main')).toMatchObject({
      muted: false,
    });
    expect(updateTimelineTrack({ timeline: updated, trackId: 'missing', patch: { hidden: false } })).toEqual(updated);
  });

  it('copies, pastes, and duplicates clips without reusing clip ids', () => {
    const clip = createMediaClip({ type: 'video', src: 'assets/source.mp4', name: 'Source', startTime: 0, duration: 4 });
    let timeline = insertTimelineClip({ timeline: ensureNodeTimeline(), clip });

    const pasted = pasteTimelineClip({ timeline, clip, startTime: 6 });
    timeline = pasted.timeline;
    expect(pasted.clip.id).not.toBe(clip.id);
    expect(pasted.clip).toMatchObject({ type: 'video', src: 'assets/source.mp4', name: 'Source', startTime: 6 });

    const duplicated = duplicateTimelineClip({ timeline, clipId: clip.id });
    expect(duplicated.clip?.id).not.toBe(clip.id);
    expect(duplicated.clip).toMatchObject({ name: 'Source copy', startTime: 4 });
    expect(getMediaTimelineClips(duplicated.timeline)).toHaveLength(3);
  });

  it('pastes and duplicates clip groups while preserving relative offsets', () => {
    const first = createMediaClip({ type: 'video', src: 'assets/first.mp4', name: 'First', startTime: 1, duration: 2 });
    const second = createMediaClip({ type: 'audio', src: 'assets/second.mp3', name: 'Second', startTime: 4, duration: 3 });
    let timeline = insertTimelineClip({ timeline: ensureNodeTimeline(), clip: first });
    timeline = insertTimelineClip({ timeline, clip: second });
    const firstTrackId = findTimelineClip(timeline, first.id)?.track.id;
    const secondTrackId = findTimelineClip(timeline, second.id)?.track.id;

    const pasted = pasteTimelineClips({
      timeline,
      startTime: 10,
      items: [
        { clip: first, trackId: firstTrackId },
        { clip: second, trackId: secondTrackId },
      ],
    });

    expect(pasted.clips.map((clip) => clip.startTime)).toEqual([10, 13]);
    expect(pasted.clips.map((clip) => clip.id)).not.toContain(first.id);

    const duplicated = duplicateTimelineClips({ timeline: pasted.timeline, clipIds: [first.id, second.id] });
    expect(duplicated.clips.map((clip) => clip.startTime)).toEqual([7, 10]);
    expect(duplicated.clips.map((clip) => clip.name)).toEqual(['First copy', 'Second copy']);
  });

  it('pastes clip groups onto the compatible track above their source track first', () => {
    const first = createMediaClip({ type: 'video', src: 'assets/first.mp4', startTime: 0, duration: 2 });
    const second = createMediaClip({ type: 'image', src: 'assets/second.png', startTime: 3, duration: 2 });
    let timeline = addTimelineTrack({ timeline: ensureNodeTimeline(), type: 'media' });
    const mediaTracks = timeline.tracks.filter((track) => track.type === 'media');
    const sourceTrackId = mediaTracks[1].id;

    timeline = insertTimelineClip({ timeline, clip: first, trackId: sourceTrackId });
    timeline = insertTimelineClip({ timeline, clip: second, trackId: sourceTrackId });

    const pasted = pasteTimelineClips({
      timeline,
      startTime: 8,
      items: [
        { clip: first, trackId: sourceTrackId },
        { clip: second, trackId: sourceTrackId },
      ],
    });

    expect(pasted.clips.map((clip) => clip.startTime)).toEqual([8, 11]);
    expect(pasted.clips.map((clip) => findTimelineClip(pasted.timeline, clip.id)?.track.id)).toEqual([
      mediaTracks[0].id,
      mediaTracks[0].id,
    ]);
  });

  it('moves and deletes selected clip groups while skipping locked tracks', () => {
    const first = createMediaClip({ type: 'video', src: 'assets/first.mp4', startTime: 1, duration: 2 });
    const second = createMediaClip({ type: 'audio', src: 'assets/second.mp3', startTime: 4, duration: 3 });
    let timeline = addTimelineTrack({ timeline: ensureNodeTimeline(), type: 'media' });
    const unlockedTrackId = timeline.tracks.find((track) => track.type === 'media' && track.id !== 'media-track-main')?.id as string;
    timeline = insertTimelineClip({ timeline, clip: first, trackId: unlockedTrackId });
    timeline = insertTimelineClip({ timeline, clip: second, trackId: 'media-track-main' });
    const lockedTrackId = findTimelineClip(timeline, second.id)?.track.id as string;
    timeline = updateTimelineTrack({ timeline, trackId: lockedTrackId, patch: { locked: true } });

    const moved = moveTimelineClipsByDelta({ timeline, clipIds: [first.id, second.id], deltaTime: 3 });
    expect(findTimelineClip(moved, first.id)?.clip.startTime).toBe(4);
    expect(findTimelineClip(moved, second.id)?.clip.startTime).toBe(4);

    const deleted = deleteTimelineClips({ timeline: moved, clipIds: [first.id, second.id] });
    expect(findTimelineClip(deleted, first.id)).toBeNull();
    expect(findTimelineClip(deleted, second.id)?.clip.id).toBe(second.id);
  });

  it('clamps grouped clip movement at the timeline start', () => {
    const first = createMediaClip({ type: 'video', src: 'assets/first.mp4', startTime: 1, duration: 2 });
    const second = createMediaClip({ type: 'audio', src: 'assets/second.mp3', startTime: 4, duration: 2 });
    let timeline = insertTimelineClip({ timeline: ensureNodeTimeline(), clip: first });
    timeline = insertTimelineClip({ timeline, clip: second });

    const moved = moveTimelineClipsByDelta({ timeline, clipIds: [first.id, second.id], deltaTime: -2 });

    expect(findTimelineClip(moved, first.id)?.clip.startTime).toBe(0);
    expect(findTimelineClip(moved, second.id)?.clip.startTime).toBe(3);
  });

  it('moves same-type clip groups across tracks while preserving vertical offsets', () => {
    const first = createMediaClip({ type: 'video', src: 'assets/first.mp4', startTime: 1, duration: 2 });
    const second = createMediaClip({ type: 'video', src: 'assets/second.mp4', startTime: 4, duration: 2 });
    let timeline = addTimelineTrack({ timeline: ensureNodeTimeline(), type: 'media' });
    timeline = addTimelineTrack({ timeline, type: 'media' });
    const mediaTracks = timeline.tracks.filter((track) => track.type === 'media');
    timeline = insertTimelineClip({ timeline, clip: first, trackId: mediaTracks[0].id });
    timeline = insertTimelineClip({ timeline, clip: second, trackId: mediaTracks[1].id });

    const moved = moveTimelineClipGroup({
      timeline,
      clipIds: [first.id, second.id],
      anchorClipId: first.id,
      startTime: 5,
      trackId: mediaTracks[1].id,
    });

    expect(findTimelineClip(moved, first.id)?.track.id).toBe(mediaTracks[1].id);
    expect(findTimelineClip(moved, second.id)?.track.id).toBe(mediaTracks[2].id);
    expect(findTimelineClip(moved, first.id)?.clip.startTime).toBe(5);
    expect(findTimelineClip(moved, second.id)?.clip.startTime).toBe(8);
  });

  it('moves clip groups into newly created tracks while preserving source-track grouping', () => {
    const first = createMediaClip({ type: 'video', src: 'assets/first.mp4', startTime: 1, duration: 2 });
    const second = createMediaClip({ type: 'video', src: 'assets/second.mp4', startTime: 4, duration: 2 });
    const third = createMediaClip({ type: 'image', src: 'assets/third.png', startTime: 7, duration: 2 });
    let timeline = addTimelineTrack({ timeline: ensureNodeTimeline(), type: 'media' });
    const mediaTracks = timeline.tracks.filter((track) => track.type === 'media');
    timeline = insertTimelineClip({ timeline, clip: first, trackId: mediaTracks[0].id });
    timeline = insertTimelineClip({ timeline, clip: second, trackId: mediaTracks[1].id });
    timeline = insertTimelineClip({ timeline, clip: third, trackId: mediaTracks[0].id });

    const moved = moveTimelineClipGroup({
      timeline,
      clipIds: [first.id, second.id, third.id],
      anchorClipId: first.id,
      startTime: 5,
      forceNewTrack: true,
      newTrackInsertIndex: 1,
    });
    const firstRef = findTimelineClip(moved, first.id);
    const secondRef = findTimelineClip(moved, second.id);
    const thirdRef = findTimelineClip(moved, third.id);

    expect(firstRef?.track.id).not.toBe(mediaTracks[0].id);
    expect(secondRef?.track.id).not.toBe(mediaTracks[1].id);
    expect(moved.tracks[1].id).toBe(firstRef?.track.id);
    expect(moved.tracks[2].id).toBe(secondRef?.track.id);
    expect(thirdRef?.track.id).toBe(firstRef?.track.id);
    expect(secondRef?.track.id).not.toBe(firstRef?.track.id);
    expect([firstRef?.clip.startTime, secondRef?.clip.startTime, thirdRef?.clip.startTime]).toEqual([5, 8, 11]);
  });

  it('falls back to time-only movement for mixed clip groups', () => {
    const mediaClip = createMediaClip({ type: 'video', src: 'assets/first.mp4', startTime: 1, duration: 2 });
    const interactionClip = createInteractionClip('button', 4, 12);
    let timeline = addTimelineTrack({ timeline: ensureNodeTimeline(), type: 'media' });
    const mediaTracks = timeline.tracks.filter((track) => track.type === 'media');
    timeline = insertTimelineClip({ timeline, clip: mediaClip, trackId: mediaTracks[0].id });
    timeline = insertTimelineClip({ timeline, clip: interactionClip, trackId: 'interaction-track-main' });

    const moved = moveTimelineClipGroup({
      timeline,
      clipIds: [mediaClip.id, interactionClip.id],
      anchorClipId: mediaClip.id,
      startTime: 6,
      trackId: mediaTracks[1].id,
    });

    expect(findTimelineClip(moved, mediaClip.id)?.track.id).toBe(mediaTracks[0].id);
    expect(findTimelineClip(moved, interactionClip.id)?.track.id).toBe('interaction-track-main');
    expect(findTimelineClip(moved, mediaClip.id)?.clip.startTime).toBe(6);
    expect(findTimelineClip(moved, interactionClip.id)?.clip.startTime).toBe(9);
  });

  it('trims selected clip groups by a shared left-edge delta while skipping locked tracks', () => {
    const first = { ...createMediaClip({ type: 'video', src: 'assets/first.mp4', startTime: 2, duration: 5 }), sourceStart: 1 };
    const second = createMediaClip({ type: 'video', src: 'assets/second.mp4', startTime: 4, duration: 3 });
    const locked = createMediaClip({ type: 'video', src: 'assets/locked.mp4', startTime: 6, duration: 4 });
    let timeline = addTimelineTrack({ timeline: ensureNodeTimeline(), type: 'media' });
    timeline = addTimelineTrack({ timeline, type: 'media' });
    const mediaTracks = timeline.tracks.filter((track) => track.type === 'media');
    timeline = insertTimelineClip({ timeline, clip: first, trackId: mediaTracks[0].id });
    timeline = insertTimelineClip({ timeline, clip: second, trackId: mediaTracks[1].id });
    timeline = insertTimelineClip({ timeline, clip: locked, trackId: mediaTracks[2].id });
    timeline = updateTimelineTrack({ timeline, trackId: mediaTracks[2].id, patch: { locked: true } });

    const trimmed = trimTimelineClipGroup({
      timeline,
      clipIds: [first.id, second.id, locked.id],
      anchorClipId: first.id,
      side: 'left',
      time: 3,
    });

    expect(findTimelineClip(trimmed, first.id)?.clip).toMatchObject({ startTime: 3, duration: 4, sourceStart: 2 });
    expect(findTimelineClip(trimmed, second.id)?.clip).toMatchObject({ startTime: 5, duration: 2, sourceStart: 1 });
    expect(findTimelineClip(trimmed, locked.id)?.clip).toMatchObject({ startTime: 6, duration: 4, sourceStart: 0 });
  });

  it('clamps selected clip group trims to keep every member above the minimum duration', () => {
    const first = createMediaClip({ type: 'video', src: 'assets/first.mp4', startTime: 0, duration: 4 });
    const short = createMediaClip({ type: 'video', src: 'assets/short.mp4', startTime: 6, duration: 0.3 });
    let timeline = insertTimelineClip({ timeline: ensureNodeTimeline(), clip: first });
    timeline = insertTimelineClip({ timeline, clip: short });

    const trimmed = trimTimelineClipGroup({
      timeline,
      clipIds: [first.id, short.id],
      anchorClipId: first.id,
      side: 'right',
      time: 1,
    });

    expect(findTimelineClip(trimmed, first.id)?.clip.duration).toBe(3.8);
    expect(findTimelineClip(trimmed, short.id)?.clip.duration).toBe(0.1);
  });

  it('keeps media source ranges in sync with trims and playback rate', () => {
    const clip = {
      ...createMediaClip({ type: 'video', src: 'assets/source.mp4', startTime: 2, duration: 6 }),
      sourceStart: 10,
      sourceDuration: 12,
      playbackRate: 2,
    };
    let timeline = insertTimelineClip({ timeline: ensureNodeTimeline({ duration: 12 }), clip });

    timeline = trimTimelineClip({ timeline, clipId: clip.id, side: 'left', time: 3 });
    expect(findTimelineClip(timeline, clip.id)?.clip).toMatchObject({
      startTime: 3,
      duration: 5,
      sourceStart: 12,
      sourceDuration: 10,
    });

    timeline = trimTimelineClip({ timeline, clipId: clip.id, side: 'right', time: 5 });
    expect(findTimelineClip(timeline, clip.id)?.clip).toMatchObject({
      startTime: 3,
      duration: 2,
      sourceStart: 12,
      sourceDuration: 4,
    });
  });

  it('ripples later clips on delete and trim within the same unlocked track', () => {
    const first = createMediaClip({ type: 'video', src: 'assets/first.mp4', startTime: 0, duration: 2 });
    const second = createMediaClip({ type: 'video', src: 'assets/second.mp4', startTime: 4, duration: 2 });
    const third = createMediaClip({ type: 'video', src: 'assets/third.mp4', startTime: 7, duration: 2 });
    let timeline = insertTimelineClip({
      timeline: insertTimelineClip({
        timeline: insertTimelineClip({
          timeline: ensureNodeTimeline(),
          clip: first,
        }),
        clip: second,
      }),
      clip: third,
    });

    const deleted = deleteTimelineClipsWithRipple({ timeline, clipIds: [first.id] });
    expect(findTimelineClip(deleted, first.id)).toBeNull();
    expect(findTimelineClip(deleted, second.id)?.clip.startTime).toBe(2);
    expect(findTimelineClip(deleted, third.id)?.clip.startTime).toBe(5);

    timeline = trimTimelineClipWithRipple({ timeline: deleted, clipId: second.id, side: 'right', time: 3 });
    expect(findTimelineClip(timeline, second.id)?.clip.duration).toBe(1);
    expect(findTimelineClip(timeline, third.id)?.clip.startTime).toBe(4);
  });

  it('splits clips and can retain only the left or right side', () => {
    const clip = {
      ...createMediaClip({ type: 'video', src: 'assets/source.mp4', startTime: 2, duration: 6 }),
      sourceStart: 10,
      sourceDuration: 6,
    };
    const timeline = insertTimelineClip({ timeline: ensureNodeTimeline(), clip });

    const splitBoth = splitTimelineClip({ timeline, clipId: clip.id, time: 5 });
    const rightClipId = splitBoth.clipIds[0];
    expect(findTimelineClip(splitBoth.timeline, clip.id)?.clip).toMatchObject({ startTime: 2, duration: 3, sourceStart: 10, sourceDuration: 3 });
    expect(findTimelineClip(splitBoth.timeline, rightClipId)?.clip).toMatchObject({ startTime: 5, duration: 3, sourceStart: 13, sourceDuration: 3 });

    const retainLeft = splitTimelineClip({ timeline, clipId: clip.id, time: 5, retainSide: 'left' });
    expect(retainLeft.clipIds).toEqual([clip.id]);
    expect(findTimelineClip(retainLeft.timeline, clip.id)?.clip).toMatchObject({ startTime: 2, duration: 3, sourceStart: 10, sourceDuration: 3 });
    expect(getMediaTimelineClips(retainLeft.timeline)).toHaveLength(1);

    const retainRight = splitTimelineClip({ timeline, clipId: clip.id, time: 5, retainSide: 'right' });
    expect(retainRight.clipIds[0]).not.toBe(clip.id);
    expect(findTimelineClip(retainRight.timeline, clip.id)).toBeNull();
    expect(findTimelineClip(retainRight.timeline, retainRight.clipIds[0])?.clip).toMatchObject({ startTime: 5, duration: 3, sourceStart: 13, sourceDuration: 3 });
    expect(getMediaTimelineClips(retainRight.timeline)).toHaveLength(1);
  });

  it('finds OpenCut-style split targets from selection or clips under the playhead', () => {
    const first = createMediaClip({ type: 'video', src: 'assets/first.mp4', startTime: 0, duration: 6 });
    const second = createMediaClip({ type: 'video', src: 'assets/second.mp4', startTime: 1, duration: 5 });
    const outside = createMediaClip({ type: 'video', src: 'assets/outside.mp4', startTime: 8, duration: 4 });
    const locked = createMediaClip({ type: 'video', src: 'assets/locked.mp4', startTime: 0, duration: 6 });
    let timeline = addTimelineTrack({ timeline: ensureNodeTimeline(), type: 'media' });
    timeline = addTimelineTrack({ timeline, type: 'media' });
    const mediaTracks = timeline.tracks.filter((track) => track.type === 'media');
    timeline = insertTimelineClip({ timeline, clip: first, trackId: mediaTracks[0].id });
    timeline = insertTimelineClip({ timeline, clip: second, trackId: mediaTracks[1].id });
    timeline = insertTimelineClip({ timeline, clip: outside, trackId: mediaTracks[0].id });
    timeline = insertTimelineClip({ timeline, clip: locked, trackId: mediaTracks[2].id });
    timeline = updateTimelineTrack({ timeline, trackId: mediaTracks[2].id, patch: { locked: true } });

    expect(getTimelineSplitTargetClipIds({ timeline, time: 3 })).toEqual([first.id, second.id]);
    expect(getTimelineSplitTargetClipIds({ timeline, time: 3, clipIds: [second.id, first.id] })).toEqual([second.id, first.id]);
    expect(getTimelineSplitTargetClipIds({ timeline, time: 3, clipIds: [locked.id, outside.id] })).toEqual([]);
  });

  it('splits multiple clips at the playhead while skipping locked tracks', () => {
    const first = createMediaClip({ type: 'video', src: 'assets/first.mp4', startTime: 0, duration: 6 });
    const second = createMediaClip({ type: 'video', src: 'assets/second.mp4', startTime: 1, duration: 6 });
    const locked = createMediaClip({ type: 'video', src: 'assets/locked.mp4', startTime: 0, duration: 6 });
    let timeline = addTimelineTrack({ timeline: ensureNodeTimeline(), type: 'media' });
    const mediaTracks = timeline.tracks.filter((track) => track.type === 'media');
    timeline = insertTimelineClip({ timeline, clip: first, trackId: mediaTracks[0].id });
    timeline = insertTimelineClip({ timeline, clip: second, trackId: mediaTracks[1].id });
    timeline = addTimelineTrack({ timeline, type: 'media' });
    const lockedTrackId = timeline.tracks.find((track) => track.type === 'media' && track.id !== mediaTracks[0].id && track.id !== mediaTracks[1].id)?.id as string;
    timeline = insertTimelineClip({ timeline, clip: locked, trackId: lockedTrackId });
    timeline = updateTimelineTrack({ timeline, trackId: lockedTrackId, patch: { locked: true } });

    const split = splitTimelineClips({
      timeline,
      clipIds: [first.id, second.id, locked.id],
      time: 3,
    });

    expect(split.clipIds).toHaveLength(2);
    expect(findTimelineClip(split.timeline, first.id)?.clip.duration).toBe(3);
    expect(findTimelineClip(split.timeline, second.id)?.clip.duration).toBe(2);
    expect(findTimelineClip(split.timeline, locked.id)?.clip.duration).toBe(6);
    expect(getMediaTimelineClips(split.timeline)).toHaveLength(5);
  });

  it('selects clip ids by marquee time and track range', () => {
    const first = createMediaClip({ type: 'video', src: 'assets/first.mp4', startTime: 1, duration: 2 });
    const second = createMediaClip({ type: 'audio', src: 'assets/second.mp3', startTime: 5, duration: 2 });
    const button = createInteractionClip('button', 1.5, 8);
    let timeline = addTimelineTrack({ timeline: ensureNodeTimeline(), type: 'media' });
    const mediaTracks = timeline.tracks.filter((track) => track.type === 'media');
    timeline = insertTimelineClip({ timeline, clip: first, trackId: mediaTracks[0].id });
    timeline = insertTimelineClip({ timeline, clip: second, trackId: mediaTracks[1].id });
    timeline = insertTimelineClip({ timeline, clip: button });
    const secondTrackId = findTimelineClip(timeline, second.id)?.track.id as string;
    timeline = updateTimelineTrack({ timeline, trackId: secondTrackId, patch: { locked: true } });

    expect(selectTimelineClipIdsInRange({
      timeline,
      startTime: 0,
      endTime: 4,
      trackIds: [mediaTracks[0].id],
    })).toEqual([first.id]);

    expect(selectTimelineClipIdsInRange({
      timeline,
      startTime: 0,
      endTime: 8,
      trackIds: [secondTrackId],
    })).toEqual([]);

    expect(selectTimelineClipIdsInRange({
      timeline,
      startTime: 0,
      endTime: 8,
      trackIds: [secondTrackId],
      includeLockedTracks: true,
    })).toEqual([second.id]);
  });

  it('moves timeline clips by the shared frame step used by keyboard nudging', () => {
    const first = createMediaClip({ type: 'video', src: 'assets/first.mp4', startTime: 1, duration: 2 });
    const second = createMediaClip({ type: 'audio', src: 'assets/second.mp3', startTime: 4, duration: 2 });
    let timeline = insertTimelineClip({ timeline: ensureNodeTimeline(), clip: first });
    timeline = insertTimelineClip({ timeline, clip: second });

    const moved = moveTimelineClipsByDelta({
      timeline,
      clipIds: [first.id, second.id],
      deltaTime: TIMELINE_FRAME_STEP_SECONDS,
    });

    expect(findTimelineClip(moved, first.id)?.clip.startTime).toBe(1.03);
    expect(findTimelineClip(moved, second.id)?.clip.startTime).toBe(4.03);
  });

  it('does not place newly inserted clips on locked tracks', () => {
    const clip = createMediaClip({ type: 'video', src: 'assets/locked.mp4', startTime: 0, duration: 4 });
    let timeline = updateTimelineTrack({
      timeline: ensureNodeTimeline(),
      trackId: 'media-track-main',
      patch: { locked: true },
    });

    timeline = insertTimelineClip({ timeline, clip, trackId: 'media-track-main' });
    const clipRef = findTimelineClip(timeline, clip.id);

    expect(clipRef?.track.id).not.toBe('media-track-main');
    expect(clipRef?.track.locked).not.toBe(true);
  });

  it('stores playhead time inside the node timeline within duration bounds', () => {
    const timeline = ensureNodeTimeline({ duration: 8, playheadTime: 2 });

    expect(timeline.playheadTime).toBe(2);
    expect(setTimelinePlayhead(timeline, 2)).toBe(timeline);
    expect(setTimelinePlayhead(timeline, 12).playheadTime).toBe(8);
    expect(setTimelinePlayhead(timeline, -1).playheadTime).toBe(0);
    const zoomTimeline = setTimelineZoom(timeline, 64);
    expect(setTimelineZoom(zoomTimeline, 64)).toBe(zoomTimeline);
  });

  it('toggles timeline bookmarks and exposes them as snap points', () => {
    let timeline = toggleTimelineBookmark({ timeline: ensureNodeTimeline({ duration: 8 }), time: 3.25, label: 'Beat' });

    expect(timeline.bookmarks).toMatchObject([{ time: 3.25, label: 'Beat' }]);
    expect(findTimelineBookmarkAtTime(timeline, 3.25)?.label).toBe('Beat');
    expect(buildTimelineSnapPoints({ timeline }).some((point) => point.type === 'bookmark' && point.time === 3.25)).toBe(true);
    expect(buildTimelineSnapPoints({ timeline, excludeClipIds: [] }).some((point) => point.type === 'bookmark' && point.time === 3.25)).toBe(true);
    timeline = updateTimelineBookmark({
      timeline,
      bookmarkId: timeline.bookmarks[0].id,
      patch: { time: 12, label: 'Moved', color: '#f59e0b' },
    });
    expect(timeline.bookmarks).toMatchObject([{ time: 8, label: 'Moved', color: '#f59e0b' }]);
    expect(buildTimelineSnapPoints({ timeline }).some((point) => point.type === 'bookmark' && point.time === 8)).toBe(true);
    expect(toggleTimelineBookmark({ timeline, time: 8 }).bookmarks).toEqual([]);
  });

  it('finds adjacent timeline edit points from clip bounds, bookmarks, and boundaries', () => {
    const mediaClip = createMediaClip({ type: 'video', src: 'assets/edit-point.mp4', startTime: 2, duration: 4 });
    const interactionClip = { ...createInteractionClip('button', 7, 12), duration: 2 };
    let timeline = insertTimelineClip({ timeline: ensureNodeTimeline({ duration: 12 }), clip: mediaClip });
    timeline = insertTimelineClip({ timeline, clip: interactionClip });
    timeline = toggleTimelineBookmark({ timeline, time: 5, label: 'Marker' });

    expect(getAdjacentTimelineEditPoint({ timeline, time: 0, direction: 'next' })).toBe(2);
    expect(getAdjacentTimelineEditPoint({ timeline, time: 2, direction: 'next' })).toBe(5);
    expect(getAdjacentTimelineEditPoint({ timeline, time: 5, direction: 'previous' })).toBe(2);
    expect(getAdjacentTimelineEditPoint({ timeline, time: 7, direction: 'previous' })).toBe(6);
    expect(getAdjacentTimelineEditPoint({ timeline, time: 12, direction: 'previous' })).toBe(9);
    expect(getAdjacentTimelineEditPoint({ timeline, time: 12, direction: 'next' })).toBeNull();
    expect(getAdjacentTimelineEditPoint({ timeline, time: 0, direction: 'previous' })).toBeNull();
  });

  it('compiles runtime media and overlay effects from node.data.timeline', () => {
    const mediaRect = { x: 0.2, y: 0.1, width: 0.6, height: 0.55 };
    const timeline = insertTimelineClip({
      timeline: ensureNodeTimeline(),
      clip: {
        ...createMediaClip({ type: 'video', src: 'assets/timeline.mp4', startTime: 0, duration: 10 }),
        rect: mediaRect,
        fit: 'cover',
        opacity: 0.42,
        rotation: 15,
        playbackRate: 1.5,
        preservePitch: false,
        sourceDuration: 6,
      },
    });
    const story = node('story', 'scene', {
      type: 'scene',
      title: 'Story',
      bodyText: '',
      timeline,
    });

    const compiled = compileNodeTimeline(story);
    const effects = buildNodeEffects(story, []);

    expect(compiled.primaryMediaClip?.src).toBe('assets/timeline.mp4');
    expect(effects).toContainEqual(expect.objectContaining({ type: 'playMedia', src: 'assets/timeline.mp4', rect: mediaRect, fit: 'cover', opacity: 0.42, rotation: 15, playbackRate: 1.5, preservePitch: false, sourceDuration: 6 }));
  });

  it('resolves keyframed media and interaction clip properties for runtime playback', () => {
    const videoClip = {
      ...createMediaClip({ type: 'video', src: 'assets/keyframed.mp4', startTime: 0, duration: 4 }),
      rect: { x: 0, y: 0, width: 1, height: 1 },
      opacity: 1,
    };
    const buttonClip = {
      ...createInteractionClip('button', 0, 4),
      rect: { x: 0.2, y: 0.2, width: 0.2, height: 0.1 },
      rotation: 0,
    };
    let timeline = insertTimelineClip({ timeline: ensureNodeTimeline({ duration: 4 }), clip: videoClip });
    timeline = insertTimelineClip({ timeline, clip: buttonClip });
    timeline = upsertTimelineClipKeyframe({ timeline, clipId: videoClip.id, property: 'opacity', time: 0, value: 0 });
    timeline = upsertTimelineClipKeyframe({ timeline, clipId: videoClip.id, property: 'opacity', time: 4, value: 1 });
    timeline = upsertTimelineClipKeyframe({ timeline, clipId: videoClip.id, property: 'x', time: 0, value: 0 });
    timeline = upsertTimelineClipKeyframe({ timeline, clipId: videoClip.id, property: 'x', time: 4, value: 0.4 });
    timeline = upsertTimelineClipKeyframe({ timeline, clipId: buttonClip.id, property: 'rotation', time: 0, value: 0 });
    timeline = upsertTimelineClipKeyframe({ timeline, clipId: buttonClip.id, property: 'rotation', time: 4, value: 90 });
    timeline = upsertTimelineClipKeyframe({ timeline, clipId: buttonClip.id, property: 'y', time: 0, value: 0.2 });
    timeline = upsertTimelineClipKeyframe({ timeline, clipId: buttonClip.id, property: 'y', time: 4, value: 0.4 });
    const story = node('story', 'scene', { type: 'scene', title: 'Story', bodyText: '', timeline });

    const effects = buildNodeEffects(story, [], 2);
    expect(effects).toContainEqual(expect.objectContaining({
      type: 'playMedia',
      mediaType: 'video',
      src: 'assets/keyframed.mp4',
      opacity: 0.5,
      rect: expect.objectContaining({ x: 0.2 }),
    }));

    const [activeButton] = getActiveTimelineClips(story, 2);
    expect(activeButton).toMatchObject({
      id: buttonClip.id,
      rotation: 45,
    });
    expect(activeButton?.rect?.y).toBeCloseTo(0.3, 5);
  });

  it('creates freeze-frame video clips and emits fixed-source runtime effects', () => {
    const videoClip = {
      ...createMediaClip({ type: 'video', src: 'assets/clip.mp4', startTime: 1, duration: 8 }),
      sourceStart: 2,
      playbackRate: 1.5,
      rect: { x: 0.1, y: 0.2, width: 0.7, height: 0.5 },
    };
    const timeline = insertTimelineClip({ timeline: ensureNodeTimeline({ duration: 12 }), clip: videoClip });
    const result = freezeTimelineVideoClipAtTime({ timeline, clipId: videoClip.id, time: 3, duration: 2 });

    expect(result.clip).toMatchObject({
      type: 'video',
      src: 'assets/clip.mp4',
      startTime: 3,
      duration: 2,
      sourceStart: 5,
      freezeFrameTime: 5,
      muted: true,
      sourceAudioEnabled: false,
    });
    expect(result.timeline.tracks.flatMap((track) => track.clips).filter((clip) => clip.type === 'video')).toMatchObject([
      { startTime: 1, duration: 2 },
      { startTime: 3, duration: 2, freezeFrameTime: 5 },
      { startTime: 5, duration: 6, sourceStart: 5 },
    ]);

    const story = node('story', 'scene', {
      type: 'scene',
      title: 'Story',
      bodyText: '',
      timeline: result.timeline,
    });
    const effects = buildNodeEffects(story, [], 3.5);

    expect(effects).toContainEqual(expect.objectContaining({
      type: 'playMedia',
      mediaType: 'video',
      src: 'assets/clip.mp4',
      sourceStart: 5,
      freezeFrameTime: 5,
      muted: true,
    }));
  });

  it('emits all active visual media effects for multi-track timeline overlays', () => {
    const mainClip = {
      ...createMediaClip({ type: 'video', src: 'assets/main.mp4', startTime: 0, duration: 8 }),
      rect: { x: 0, y: 0, width: 1, height: 1 },
    };
    const overlayClip = {
      ...createMediaClip({ type: 'image', src: 'assets/overlay.png', startTime: 0, duration: 8 }),
      rect: { x: 0.58, y: 0.12, width: 0.32, height: 0.24 },
      opacity: 0.7,
    };
    let timeline = insertTimelineClip({ timeline: ensureNodeTimeline(), clip: mainClip });
    timeline = insertTimelineClip({ timeline, clip: overlayClip });
    const story = node('story', 'scene', {
      type: 'scene',
      title: 'Story',
      bodyText: '',
      timeline,
    });

    const visualEffects = buildNodeEffects(story, [], 2)
      .filter((effect) => effect.type === 'playMedia' && (effect.mediaType === 'video' || effect.mediaType === 'image'));

    expect(visualEffects).toHaveLength(2);
    expect(visualEffects).toContainEqual(expect.objectContaining({ mediaType: 'video', src: 'assets/main.mp4', rect: mainClip.rect }));
    expect(visualEffects).toContainEqual(expect.objectContaining({ mediaType: 'image', src: 'assets/overlay.png', rect: overlayClip.rect, opacity: 0.7 }));
  });

  it('emits all active audio media effects for multi-track audio beds', () => {
    const voiceClip = {
      ...createMediaClip({ type: 'audio', src: 'assets/voice.mp3', startTime: 0, duration: 8 }),
      volume: 0.8,
    };
    const musicClip = {
      ...createMediaClip({ type: 'audio', src: 'assets/music.mp3', startTime: 0, duration: 8 }),
      volume: 0.35,
    };
    let timeline = insertTimelineClip({ timeline: ensureNodeTimeline(), clip: voiceClip });
    timeline = insertTimelineClip({ timeline, clip: musicClip });
    const story = node('story', 'scene', {
      type: 'scene',
      title: 'Story',
      bodyText: '',
      timeline,
    });

    const audioEffects = buildNodeEffects(story, [], 2)
      .filter((effect) => effect.type === 'playMedia' && effect.mediaType === 'audio');

    expect(timeline.tracks.filter((track) => track.type === 'media' && track.mediaRole === 'audio')).toHaveLength(2);
    expect(audioEffects).toHaveLength(2);
    expect(audioEffects).toContainEqual(expect.objectContaining({ mediaType: 'audio', src: 'assets/voice.mp3', volume: 0.8 }));
    expect(audioEffects).toContainEqual(expect.objectContaining({ mediaType: 'audio', src: 'assets/music.mp3', volume: 0.35 }));
  });

  it('normalizes audio clip volume for timeline inline controls', () => {
    const loudClip = {
      ...createMediaClip({ type: 'audio', src: 'assets/loud.mp3', startTime: 0, duration: 4 }),
      volume: 3,
    };
    const silentClip = {
      ...createMediaClip({ type: 'audio', src: 'assets/silent.mp3', startTime: 0, duration: 4 }),
      volume: -1,
    };
    let timeline = insertTimelineClip({ timeline: ensureNodeTimeline(), clip: loudClip });
    timeline = insertTimelineClip({ timeline, clip: silentClip });
    const story = node('story', 'scene', {
      type: 'scene',
      title: 'Story',
      bodyText: '',
      timeline,
    });

    const normalized = ensureNodeTimeline(timeline);
    const audioEffects = buildNodeEffects(story, [], 1)
      .filter((effect) => effect.type === 'playMedia' && effect.mediaType === 'audio');

    expect(findTimelineClip(normalized, loudClip.id)?.clip).toMatchObject({ volume: 2 });
    expect(findTimelineClip(normalized, silentClip.id)?.clip).toMatchObject({ volume: 0 });
    expect(audioEffects).toContainEqual(expect.objectContaining({ mediaType: 'audio', src: 'assets/loud.mp3', volume: 2 }));
    expect(audioEffects).toContainEqual(expect.objectContaining({ mediaType: 'audio', src: 'assets/silent.mp3', volume: 0 }));
  });

  it('extracts and recovers source audio for video clips while preserving runtime playback', () => {
    const videoClip = {
      ...createMediaClip({ type: 'video', src: 'assets/clip.mp4', name: 'Clip', startTime: 1, duration: 5 }),
      sourceStart: 0.75,
      volume: 0.6,
      playbackRate: 0.75,
      preservePitch: false,
    };
    const timeline = insertTimelineClip({ timeline: ensureNodeTimeline(), clip: videoClip });

    const separated = toggleTimelineSourceAudioSeparation({ timeline, clipId: videoClip.id });
    const separatedVideo = findTimelineClip(separated.timeline, videoClip.id)?.clip;
    const separatedAudio = getMediaTimelineClips(separated.timeline).find((clip) => clip.type === 'audio' && clip.sourceVideoClipId === videoClip.id);

    expect(separated.separated).toBe(true);
    expect(separated.audioClipId).toBe(separatedAudio?.id);
    expect(separatedVideo).toMatchObject({ sourceAudioEnabled: false, linkGroupId: separatedAudio?.linkGroupId });
    expect(separatedAudio).toMatchObject({
      type: 'audio',
      src: 'assets/clip.mp4',
      startTime: 1,
      duration: 5,
      sourceStart: 0.75,
      sourceVideoClipId: videoClip.id,
      volume: 0.6,
      playbackRate: 0.75,
      preservePitch: false,
    });

    const story = node('story', 'scene', {
      type: 'scene',
      title: 'Story',
      bodyText: '',
      timeline: separated.timeline,
    });
    const effects = buildNodeEffects(story, [], 2);
    expect(effects).toContainEqual(expect.objectContaining({ type: 'playMedia', mediaType: 'video', src: 'assets/clip.mp4', muted: true, playbackRate: 0.75, preservePitch: false }));
    expect(effects).toContainEqual(expect.objectContaining({ type: 'playMedia', mediaType: 'audio', src: 'assets/clip.mp4', sourceStart: 0.75, volume: 0.6, playbackRate: 0.75, preservePitch: false }));

    const recovered = toggleTimelineSourceAudioSeparation({ timeline: separated.timeline, clipId: videoClip.id });
    expect(getMediaTimelineClips(recovered.timeline).some((clip) => clip.type === 'audio' && clip.sourceVideoClipId === videoClip.id)).toBe(false);
    expect(findTimelineClip(recovered.timeline, videoClip.id)?.clip).not.toMatchObject({ sourceAudioEnabled: false });
  });

  it('keeps disabled clips editable while omitting them from runtime compilation', () => {
    const mediaClip = {
      ...createMediaClip({ type: 'video', src: 'assets/disabled.mp4', startTime: 0, duration: 8 }),
      enabled: false,
    };
    const buttonClip = {
      ...createInteractionClip('button', 1, 8),
      enabled: false,
    };
    const timeline = insertTimelineClip({
      timeline: insertTimelineClip({
        timeline: ensureNodeTimeline(),
        clip: mediaClip,
      }),
      clip: buttonClip,
    });
    const story = node('story', 'scene', {
      type: 'scene',
      title: 'Story',
      bodyText: '',
      timeline,
    });

    const compiled = compileNodeTimeline(story);
    const effects = buildNodeEffects(story, [], 1);

    expect(findTimelineClip(timeline, mediaClip.id)?.clip.enabled).toBe(false);
    expect(findTimelineClip(timeline, buttonClip.id)?.clip.enabled).toBe(false);
    expect(compiled.mediaClips).toEqual([]);
    expect(compiled.interactionClips).toEqual([]);
    expect(effects).not.toContainEqual(expect.objectContaining({ type: 'timelinePlayback' }));
    expect(effects).not.toContainEqual(expect.objectContaining({ type: 'playMedia' }));
    expect(effects).not.toContainEqual(expect.objectContaining({ type: 'timelineOverlay' }));
  });

  it('bulk toggles clip enabled state while preserving locked tracks', () => {
    const first = createMediaClip({ type: 'video', src: 'assets/first.mp4', startTime: 0, duration: 2 });
    const second = createMediaClip({ type: 'video', src: 'assets/second.mp4', startTime: 3, duration: 2 });
    let timeline = addTimelineTrack({ timeline: ensureNodeTimeline(), type: 'media' });
    const mediaTracks = timeline.tracks.filter((track) => track.type === 'media');
    timeline = insertTimelineClip({ timeline, clip: first, trackId: mediaTracks[0].id });
    timeline = insertTimelineClip({ timeline, clip: second, trackId: mediaTracks[1].id });
    timeline = updateTimelineTrack({ timeline, trackId: mediaTracks[1].id, patch: { locked: true } });

    const disabled = setTimelineClipsEnabled({ timeline, clipIds: [first.id, second.id], enabled: false });
    expect(findTimelineClip(disabled, first.id)?.clip.enabled).toBe(false);
    expect(findTimelineClip(disabled, second.id)?.clip.enabled).toBe(true);

    const enabled = setTimelineClipsEnabled({ timeline: disabled, clipIds: [first.id, second.id], enabled: true });
    expect(findTimelineClip(enabled, first.id)?.clip.enabled).toBe(true);
    expect(findTimelineClip(enabled, second.id)?.clip.enabled).toBe(true);
  });

  it('bulk toggles clip hidden state while preserving locked tracks and runtime filters hidden clips', () => {
    const mediaClip = createMediaClip({ type: 'video', src: 'assets/hidden.mp4', startTime: 0, duration: 4 });
    const lockedClip = createMediaClip({ type: 'video', src: 'assets/locked-visible.mp4', startTime: 5, duration: 2 });
    const buttonClip = createInteractionClip('button', 1, 8);
    let timeline = addTimelineTrack({ timeline: ensureNodeTimeline(), type: 'media' });
    const mediaTracks = timeline.tracks.filter((track) => track.type === 'media');
    timeline = insertTimelineClip({ timeline, clip: mediaClip, trackId: mediaTracks[0].id });
    timeline = insertTimelineClip({ timeline, clip: lockedClip, trackId: mediaTracks[1].id });
    timeline = insertTimelineClip({ timeline, clip: buttonClip });
    timeline = updateTimelineTrack({ timeline, trackId: mediaTracks[1].id, patch: { locked: true } });

    const hidden = setTimelineClipsHidden({ timeline, clipIds: [mediaClip.id, lockedClip.id, buttonClip.id], hidden: true });
    const story = node('story', 'scene', {
      type: 'scene',
      title: 'Story',
      bodyText: '',
      timeline: hidden,
    });

    expect(findTimelineClip(hidden, mediaClip.id)?.clip.hidden).toBe(true);
    expect(findTimelineClip(hidden, buttonClip.id)?.clip.hidden).toBe(true);
    expect(findTimelineClip(hidden, lockedClip.id)?.clip.hidden).toBe(false);
    expect(compileNodeTimeline(story).mediaClips.map((clip) => clip.src)).not.toContain('assets/hidden.mp4');
    expect(compileNodeTimeline(story).interactionClips).toEqual([]);
    expect(buildNodeEffects(story, [], 1)).not.toContainEqual(expect.objectContaining({ type: 'playMedia', src: 'assets/hidden.mp4' }));
    expect(buildNodeEffects(story, [], 1)).not.toContainEqual(expect.objectContaining({ type: 'timelineOverlay' }));
  });

  it('bulk toggles clip muted state only for editable video and audio clips', () => {
    const videoClip = createMediaClip({ type: 'video', src: 'assets/muted-clip.mp4', startTime: 0, duration: 4 });
    const lockedAudioClip = createMediaClip({ type: 'audio', src: 'assets/locked-audio.mp3', startTime: 0, duration: 4 });
    const imageClip = createMediaClip({ type: 'image', src: 'assets/card.png', startTime: 5, duration: 2 });
    let timeline = addTimelineTrack({ timeline: ensureNodeTimeline(), type: 'media' });
    const mediaTracks = timeline.tracks.filter((track) => track.type === 'media');
    timeline = insertTimelineClip({ timeline, clip: videoClip, trackId: mediaTracks[0].id });
    timeline = insertTimelineClip({ timeline, clip: lockedAudioClip, trackId: mediaTracks[1].id });
    timeline = insertTimelineClip({ timeline, clip: imageClip, trackId: mediaTracks[0].id });
    const lockedAudioTrackId = findTimelineClip(timeline, lockedAudioClip.id)?.track.id as string;
    timeline = updateTimelineTrack({ timeline, trackId: lockedAudioTrackId, patch: { locked: true } });

    const muted = setTimelineClipsMuted({ timeline, clipIds: [videoClip.id, lockedAudioClip.id, imageClip.id], muted: true });
    const story = node('story', 'scene', {
      type: 'scene',
      title: 'Story',
      bodyText: '',
      timeline: muted,
    });

    expect(findTimelineClip(muted, videoClip.id)?.clip).toMatchObject({ muted: true });
    expect(findTimelineClip(muted, lockedAudioClip.id)?.clip).not.toMatchObject({ muted: true });
    expect(findTimelineClip(muted, imageClip.id)?.clip).not.toMatchObject({ muted: true });
    expect(buildNodeEffects(story, [], 1)).toContainEqual(expect.objectContaining({ type: 'playMedia', mediaType: 'video', src: 'assets/muted-clip.mp4', muted: true }));
  });

  it('links and unlinks clip groups while keeping duplicated clips independent', () => {
    const first = createMediaClip({ type: 'video', src: 'assets/first.mp4', startTime: 0, duration: 2 });
    const second = createInteractionClip('button', 1, 8);
    let timeline = insertTimelineClip({
      timeline: insertTimelineClip({
        timeline: ensureNodeTimeline(),
        clip: first,
      }),
      clip: second,
    });

    const linked = linkTimelineClips({ timeline, clipIds: [first.id, second.id] });
    timeline = linked.timeline;
    const firstLinkedRef = findTimelineClip(timeline, first.id);
    const secondLinkedRef = findTimelineClip(timeline, second.id);

    expect(linked.linkGroupId).toBeTruthy();
    expect(firstLinkedRef?.clip.linkGroupId).toBe(linked.linkGroupId);
    expect(secondLinkedRef?.clip.linkGroupId).toBe(linked.linkGroupId);
    expect(getLinkedTimelineClipIds({ timeline, clipIds: [first.id] })).toEqual([first.id, second.id]);
    expect(findTimelineClip(ensureNodeTimeline(timeline), first.id)?.clip.linkGroupId).toBe(linked.linkGroupId);

    const duplicate = duplicateTimelineClip({ timeline, clipId: first.id });
    expect(duplicate.clip?.linkGroupId).toBeUndefined();

    const unlinked = unlinkTimelineClips({ timeline, clipIds: [first.id] });
    expect(findTimelineClip(unlinked, first.id)?.clip.linkGroupId).toBeUndefined();
    expect(findTimelineClip(unlinked, second.id)?.clip.linkGroupId).toBeUndefined();
  });

  it('links only editable clips when selected clips include locked tracks', () => {
    const first = createMediaClip({ type: 'video', src: 'assets/first.mp4', startTime: 0, duration: 2 });
    const second = createInteractionClip('button', 1, 8);
    const locked = createMediaClip({ type: 'audio', src: 'assets/locked.mp3', startTime: 2, duration: 3 });
    let timeline = insertTimelineClip({
      timeline: insertTimelineClip({
        timeline: ensureNodeTimeline(),
        clip: first,
      }),
      clip: second,
    });
    timeline = addTimelineTrack({ timeline, type: 'media' });
    const lockedTrackId = timeline.tracks.filter((track) => track.type === 'media').at(-1)?.id as string;
    timeline = insertTimelineClip({ timeline, clip: locked, trackId: lockedTrackId });
    const actualLockedTrackId = findTimelineClip(timeline, locked.id)?.track.id as string;
    timeline = updateTimelineTrack({ timeline, trackId: actualLockedTrackId, patch: { locked: true } });

    const linked = linkTimelineClips({ timeline, clipIds: [first.id, second.id, locked.id] });

    expect(linked.linkGroupId).toBeTruthy();
    expect(findTimelineClip(linked.timeline, first.id)?.clip.linkGroupId).toBe(linked.linkGroupId);
    expect(findTimelineClip(linked.timeline, second.id)?.clip.linkGroupId).toBe(linked.linkGroupId);
    expect(findTimelineClip(linked.timeline, locked.id)?.clip.linkGroupId).toBeUndefined();
  });

  it('duplicates extracted source audio as a new linked clip group', () => {
    const videoClip = {
      ...createMediaClip({ type: 'video', src: 'assets/clip.mp4', name: 'Clip', startTime: 1, duration: 5 }),
      sourceStart: 0.5,
      volume: 0.65,
      playbackRate: 0.75,
      preservePitch: false,
    };
    const timeline = insertTimelineClip({ timeline: ensureNodeTimeline(), clip: videoClip });
    const separated = toggleTimelineSourceAudioSeparation({ timeline, clipId: videoClip.id });
    const separatedVideo = findTimelineClip(separated.timeline, videoClip.id)?.clip;
    const separatedAudio = getMediaTimelineClips(separated.timeline).find((clip) => clip.type === 'audio' && clip.sourceVideoClipId === videoClip.id);

    if (!separatedVideo || !separatedAudio) throw new Error('Expected separated source audio');

    const duplicated = duplicateTimelineClips({ timeline: separated.timeline, clipIds: [videoClip.id, separatedAudio.id] });
    const duplicatedVideo = duplicated.clips.find((clip) => clip.type === 'video');
    const duplicatedAudio = duplicated.clips.find((clip) => clip.type === 'audio');

    if (!duplicatedVideo || !duplicatedAudio) throw new Error('Expected duplicated video and audio clips');

    expect(duplicatedVideo.id).not.toBe(videoClip.id);
    expect(duplicatedAudio.id).not.toBe(separatedAudio.id);
    expect(duplicatedVideo.startTime).toBe(6);
    expect(duplicatedAudio.startTime).toBe(6);
    expect(duplicatedVideo).toMatchObject({
      sourceAudioEnabled: false,
      sourceStart: 0.5,
      playbackRate: 0.75,
      preservePitch: false,
    });
    expect(duplicatedAudio).toMatchObject({
      sourceVideoClipId: duplicatedVideo.id,
      sourceStart: 0.5,
      volume: 0.65,
      playbackRate: 0.75,
      preservePitch: false,
    });
    expect(duplicatedVideo.linkGroupId).toBe(duplicatedAudio.linkGroupId);
    expect(duplicatedVideo.linkGroupId).not.toBe(separatedVideo.linkGroupId);
    expect(getLinkedTimelineClipIds({ timeline: duplicated.timeline, clipIds: [duplicatedVideo.id] }).sort()).toEqual([duplicatedAudio.id, duplicatedVideo.id].sort());
    expect(getLinkedTimelineClipIds({ timeline: duplicated.timeline, clipIds: [videoClip.id] }).sort()).toEqual([separatedAudio.id, videoClip.id].sort());
  });

  it('nudges linked clip groups together when moving from a partial selection', () => {
    const first = createMediaClip({ type: 'video', src: 'assets/first.mp4', startTime: 2, duration: 2 });
    const second = createMediaClip({ type: 'audio', src: 'assets/second.mp3', startTime: 4, duration: 2 });
    const unrelated = createInteractionClip('button', 5, 10);
    let timeline = insertTimelineClip({
      timeline: insertTimelineClip({
        timeline: insertTimelineClip({
          timeline: ensureNodeTimeline({ duration: 10 }),
          clip: first,
        }),
        clip: second,
      }),
      clip: unrelated,
    });
    timeline = linkTimelineClips({ timeline, clipIds: [first.id, second.id] }).timeline;

    const moved = moveLinkedTimelineClipsByDelta({ timeline, clipIds: [first.id], deltaTime: 1.5 });

    expect(findTimelineClip(moved, first.id)?.clip.startTime).toBe(3.5);
    expect(findTimelineClip(moved, second.id)?.clip.startTime).toBe(5.5);
    expect(findTimelineClip(moved, unrelated.id)?.clip.startTime).toBe(5);
  });

  it('routes timeline button outputs through the runtime dispatch loop', () => {
    const buttonClip = {
      ...createInteractionClip('button', 1, 8),
      opacity: 0.5,
      rotation: -12,
    };
    const timeline = insertTimelineClip({
      timeline: insertTimelineClip({
        timeline: ensureNodeTimeline(),
        clip: createMediaClip({ type: 'video', src: 'assets/intro.mp4', startTime: 0, duration: 8 }),
      }),
      clip: buttonClip,
    });
    const graph: OpenFMVGraph = {
      nodes: [
        node('start', 'start', { type: 'start', label: 'Start', timeline }),
        node('next', 'scene', { type: 'scene', title: 'Next', bodyText: '' }),
      ],
      edges: [
        {
          id: 'button-edge',
          source: 'start',
          sourceHandle: getTimelineClipOutputHandleId(buttonClip.id),
          target: 'next',
        },
      ] as AppEdge[],
    };
    const runtime = createRuntime(graph, { entryNodeId: 'start' });

    const start = runtime.start();
    expect(start.effects).toContainEqual(expect.objectContaining({ type: 'timelineOverlay', clips: [expect.objectContaining({ id: buttonClip.id, opacity: 0.5, rotation: -12 })] }));

    runtime.dispatch({ type: 'timeline.time.update', time: 1.25 });
    const next = runtime.dispatch({ type: 'timeline.clip.triggered', clipId: buttonClip.id });
    expect(next.currentNodeId).toBe('next');
    expect(next.history).toEqual(['start', 'next']);
  });

  it('selects active runtime media clips from timeline time', () => {
    const introClip = createMediaClip({ type: 'video', src: 'assets/intro.mp4', startTime: 0, duration: 2 });
    const imageClip = createMediaClip({ type: 'image', src: 'assets/card.png', startTime: 2, duration: 3 });
    const audioClip = {
      ...createMediaClip({ type: 'audio', src: 'assets/bed.mp3', startTime: 1, duration: 4 }),
      volume: 0.4,
    };
    const timeline = insertTimelineClip({
      timeline: insertTimelineClip({
        timeline: insertTimelineClip({
          timeline: ensureNodeTimeline(),
          clip: introClip,
        }),
        clip: imageClip,
      }),
      clip: audioClip,
    });
    const story = node('story', 'scene', {
      type: 'scene',
      title: 'Story',
      bodyText: '',
      timeline,
    });

    const initialEffects = buildNodeEffects(story, [], 0);
    expect(initialEffects).toContainEqual(expect.objectContaining({ type: 'timelinePlayback', nodeId: 'story', duration: 5 }));
    expect(initialEffects).toContainEqual(expect.objectContaining({ type: 'playMedia', mediaType: 'video', src: 'assets/intro.mp4' }));

    const duringAudio = buildNodeEffects(story, [], 1);
    expect(duringAudio).toContainEqual(expect.objectContaining({ type: 'playMedia', mediaType: 'video', src: 'assets/intro.mp4' }));
    expect(duringAudio).toContainEqual(expect.objectContaining({ type: 'playMedia', mediaType: 'audio', src: 'assets/bed.mp3', volume: 0.4 }));

    const afterCut = buildNodeEffects(story, [], 3);
    expect(afterCut).toContainEqual(expect.objectContaining({ type: 'playMedia', mediaType: 'image', src: 'assets/card.png' }));
    expect(afterCut).toContainEqual(expect.objectContaining({ type: 'playMedia', mediaType: 'audio', src: 'assets/bed.mp3' }));
    expect(afterCut).not.toContainEqual(expect.objectContaining({ type: 'playMedia', mediaType: 'video', src: 'assets/intro.mp4' }));
  });

  it('uses media source end instead of editor default duration for runtime completion', () => {
    const shortVideoClip = createMediaClip({
      type: 'video',
      src: 'assets/short.mp4',
      startTime: 0,
      duration: 24,
      sourceDuration: 7.06,
    });
    const timeline = insertTimelineClip({
      timeline: ensureNodeTimeline(),
      clip: shortVideoClip,
    });
    const graph: OpenFMVGraph = {
      nodes: [
        node('story', 'scene', { type: 'scene', title: 'Story', bodyText: '', timeline }),
        node('next', 'scene', { type: 'scene', title: 'Next', bodyText: '' }),
      ],
      edges: [{ id: 'edge', source: 'story', sourceHandle: 'node:default', target: 'next' }] as AppEdge[],
    };
    const runtime = createRuntime(graph, { entryNodeId: 'story' });

    expect(timeline.duration).toBe(24);
    expect(getTimelineClipRuntimeEndTime(shortVideoClip)).toBe(7.06);
    expect(getTimelineDuration(graph.nodes[0])).toBe(7.06);

    const start = runtime.start();
    expect(start.effects).toContainEqual(expect.objectContaining({ type: 'timelinePlayback', nodeId: 'story', duration: 7.06 }));
    expect(start.effects).not.toContainEqual(expect.objectContaining({ type: 'showContinue' }));

    const beforeSourceEnds = runtime.dispatch({ type: 'timeline.time.update', time: 7.05 });
    expect(beforeSourceEnds.effects).not.toContainEqual(expect.objectContaining({ type: 'showContinue' }));

    const completed = runtime.dispatch({ type: 'timeline.time.update', time: 24 });
    expect(completed.timelineTime).toBe(7.06);
    expect(completed.effects).toContainEqual(expect.objectContaining({ type: 'autoNavigate', targetNodeId: 'next' }));
    expect(completed.effects).not.toContainEqual(expect.objectContaining({ type: 'showContinue' }));
  });

  it('advances pure media timelines without requiring interaction overlays', () => {
    const timeline = insertTimelineClip({
      timeline: insertTimelineClip({
        timeline: ensureNodeTimeline({ duration: 5 }),
        clip: createMediaClip({ type: 'image', src: 'assets/first.png', startTime: 0, duration: 2 }),
      }),
      clip: createMediaClip({ type: 'image', src: 'assets/second.png', startTime: 2, duration: 3 }),
    });
    const graph: OpenFMVGraph = {
      nodes: [
        node('story', 'scene', { type: 'scene', title: 'Story', bodyText: '', timeline }),
        node('next', 'scene', { type: 'scene', title: 'Next', bodyText: '' }),
      ],
      edges: [{ id: 'edge', source: 'story', sourceHandle: 'node:default', target: 'next' }] as AppEdge[],
    };
    const runtime = createRuntime(graph, { entryNodeId: 'story' });

    const start = runtime.start();
    expect(start.effects).toContainEqual(expect.objectContaining({ type: 'timelinePlayback', nodeId: 'story' }));
    expect(start.effects).not.toContainEqual(expect.objectContaining({ type: 'timelineOverlay' }));
    expect(start.effects).not.toContainEqual(expect.objectContaining({ type: 'showContinue' }));
    expect(start.effects).toContainEqual(expect.objectContaining({ type: 'playMedia', mediaType: 'image', src: 'assets/first.png' }));

    const nextFrame = runtime.dispatch({ type: 'timeline.time.update', time: 2.25 });
    expect(nextFrame.timelineTime).toBe(2.25);
    expect(nextFrame.effects).toContainEqual(expect.objectContaining({ type: 'playMedia', mediaType: 'image', src: 'assets/second.png' }));
    expect(nextFrame.effects).not.toContainEqual(expect.objectContaining({ type: 'showContinue' }));

    const completed = runtime.dispatch({ type: 'timeline.time.update', time: 5 });
    expect(completed.timelineTime).toBe(5);
    expect(completed.effects).toContainEqual(expect.objectContaining({ type: 'autoNavigate', targetNodeId: 'next' }));
    expect(completed.effects).not.toContainEqual(expect.objectContaining({ type: 'showContinue' }));

    const advanced = runtime.dispatch({ type: 'navigate', nodeId: 'next' });
    expect(advanced.currentNodeId).toBe('next');
    expect(advanced.timelineTime).toBe(0);
  });

  it('uses runtime timeline time for image timeline interaction playback', () => {
    const buttonClip = createInteractionClip('button', 1, 6);
    const timeline = insertTimelineClip({
      timeline: insertTimelineClip({
        timeline: ensureNodeTimeline(),
        clip: createMediaClip({ type: 'image', src: 'assets/card.png', startTime: 0, duration: 6 }),
      }),
      clip: buttonClip,
    });
    const graph: OpenFMVGraph = {
      nodes: [
        node('start', 'start', { type: 'start', label: 'Start', timeline }),
        node('next', 'scene', { type: 'scene', title: 'Next', bodyText: '' }),
      ],
      edges: [
        {
          id: 'button-edge',
          source: 'start',
          sourceHandle: getTimelineClipOutputHandleId(buttonClip.id),
          target: 'next',
        },
      ] as AppEdge[],
    };
    const runtime = createRuntime(graph, { entryNodeId: 'start' });

    const start = runtime.start();
    expect(start.timelineTime).toBe(0);
    expect(start.effects).toContainEqual(expect.objectContaining({ type: 'playMedia', mediaType: 'image', src: 'assets/card.png' }));

    const timed = runtime.dispatch({ type: 'timeline.time.update', time: 1.25 });
    expect(timed.timelineTime).toBe(1.25);
    expect(timed.effects).toContainEqual(expect.objectContaining({ type: 'timelineOverlay', clips: [expect.objectContaining({ id: buttonClip.id })] }));

    const next = runtime.dispatch({ type: 'timeline.clip.triggered', clipId: buttonClip.id });
    expect(next.currentNodeId).toBe('next');
    expect(next.timelineTime).toBe(0);
  });

  it('only accepts timeline interaction triggers inside the active clip window', () => {
    const buttonClip = {
      ...createInteractionClip('button', 1, 4),
      duration: 2,
    };
    const timeline = insertTimelineClip({
      timeline: ensureNodeTimeline({ duration: 6 }),
      clip: buttonClip,
    });
    const graph: OpenFMVGraph = {
      nodes: [
        node('start', 'start', { type: 'start', label: 'Start', timeline }),
        node('next', 'scene', { type: 'scene', title: 'Next', bodyText: '' }),
        node('timeout', 'scene', { type: 'scene', title: 'Timeout', bodyText: '' }),
      ],
      edges: [
        {
          id: 'button-edge',
          source: 'start',
          sourceHandle: getTimelineClipOutputHandleId(buttonClip.id),
          target: 'next',
        },
        {
          id: 'timeout-edge',
          source: 'start',
          sourceHandle: getTimelineClipOutputHandleId(buttonClip.id, 'timeout'),
          target: 'timeout',
        },
      ] as AppEdge[],
    };

    let runtime = createRuntime(graph, { entryNodeId: 'start' });
    runtime.start();
    let early = runtime.dispatch({ type: 'timeline.clip.triggered', clipId: buttonClip.id });
    expect(early.currentNodeId).toBe('start');
    expect(early.timelineTime).toBe(0);
    early = runtime.dispatch({ type: 'timeline.clip.timeout', clipId: buttonClip.id });
    expect(early.currentNodeId).toBe('start');

    runtime = createRuntime(graph, { entryNodeId: 'start' });
    runtime.start();
    runtime.dispatch({ type: 'timeline.time.update', time: 1.25 });
    const active = runtime.dispatch({ type: 'timeline.clip.triggered', clipId: buttonClip.id });
    expect(active.currentNodeId).toBe('next');

    runtime = createRuntime(graph, { entryNodeId: 'start' });
    runtime.start();
    runtime.dispatch({ type: 'timeline.time.update', time: 3.5 });
    const lateTrigger = runtime.dispatch({ type: 'timeline.clip.triggered', clipId: buttonClip.id });
    expect(lateTrigger.currentNodeId).toBe('start');
    const timeout = runtime.dispatch({ type: 'timeline.clip.timeout', clipId: buttonClip.id });
    expect(timeout.currentNodeId).toBe('start');
  });

  it('allows QTE timeouts while the active clip is paused before its timeline end', () => {
    const qteClip = {
      ...createInteractionClip('button', 1, 6),
      mode: 'qte' as const,
      duration: 2,
      pauseOnShow: true,
      qte: { input: 'space' as const, keyLabel: 'Space', showCountdown: true },
    };
    const timeline = insertTimelineClip({
      timeline: ensureNodeTimeline({ duration: 6 }),
      clip: qteClip,
    });
    const graph: OpenFMVGraph = {
      nodes: [
        node('start', 'start', { type: 'start', label: 'Start', timeline }),
        node('success', 'scene', { type: 'scene', title: 'Success', bodyText: '' }),
        node('timeout', 'scene', { type: 'scene', title: 'Timeout', bodyText: '' }),
      ],
      edges: [
        {
          id: 'success-edge',
          source: 'start',
          sourceHandle: getTimelineClipOutputHandleId(qteClip.id),
          target: 'success',
        },
        {
          id: 'timeout-edge',
          source: 'start',
          sourceHandle: getTimelineClipOutputHandleId(qteClip.id, 'timeout'),
          target: 'timeout',
        },
      ] as AppEdge[],
    };

    let runtime = createRuntime(graph, { entryNodeId: 'start' });
    runtime.start();
    const early = runtime.dispatch({ type: 'timeline.clip.timeout', clipId: qteClip.id });
    expect(early.currentNodeId).toBe('start');

    runtime = createRuntime(graph, { entryNodeId: 'start' });
    runtime.start();
    runtime.dispatch({ type: 'timeline.time.update', time: 1 });
    const timeout = runtime.dispatch({ type: 'timeline.clip.timeout', clipId: qteClip.id });
    expect(timeout.currentNodeId).toBe('timeout');
    expect(timeout.timelineTime).toBe(0);

    runtime = createRuntime(graph, { entryNodeId: 'start' });
    runtime.start();
    runtime.dispatch({ type: 'timeline.time.update', time: 1.2 });
    const success = runtime.dispatch({ type: 'timeline.clip.triggered', clipId: qteClip.id });
    expect(success.currentNodeId).toBe('success');
    expect(success.timelineTime).toBe(0);
  });

  it('keeps the current runtime position when a button output is unconnected', () => {
    const qteClip = {
      ...createInteractionClip('button', 1, 6),
      mode: 'qte' as const,
      duration: 2,
      qte: { input: 'click' as const, clickCount: 1, showCountdown: true },
    };
    const timeline = insertTimelineClip({
      timeline: ensureNodeTimeline({ duration: 6 }),
      clip: qteClip,
    });
    const graph: OpenFMVGraph = {
      nodes: [
        node('start', 'start', { type: 'start', label: 'Start', timeline }),
        node('next', 'scene', { type: 'scene', title: 'Next', bodyText: '' }),
      ],
      edges: [] as AppEdge[],
    };
    const runtime = createRuntime(graph, { entryNodeId: 'start' });

    runtime.start();
    runtime.dispatch({ type: 'timeline.time.update', time: 1.25 });
    const unchanged = runtime.dispatch({ type: 'timeline.clip.triggered', clipId: qteClip.id });

    expect(unchanged.currentNodeId).toBe('start');
    expect(unchanged.timelineTime).toBe(1.25);
  });

  it('omits hidden tracks from runtime media and interaction overlays', () => {
    const buttonClip = createInteractionClip('button', 1, 8);
    let timeline = insertTimelineClip({
      timeline: insertTimelineClip({
        timeline: ensureNodeTimeline(),
        clip: createMediaClip({ type: 'video', src: 'assets/timeline.mp4', startTime: 0, duration: 8 }),
      }),
      clip: buttonClip,
    });
    const mediaTrackId = timeline.tracks.find((track) => track.type === 'media')?.id as string;
    const interactionTrackId = timeline.tracks.find((track) => track.type === 'interaction')?.id as string;
    timeline = updateTimelineTrack({ timeline, trackId: mediaTrackId, patch: { hidden: true } });
    timeline = updateTimelineTrack({ timeline, trackId: interactionTrackId, patch: { hidden: true } });
    const story = node('story', 'scene', {
      type: 'scene',
      title: 'Story',
      bodyText: '',
      timeline,
    });

    const compiled = compileNodeTimeline(story);
    const effects = buildNodeEffects(story, []);

    expect(compiled.primaryMediaClip).toBeNull();
    expect(compiled.interactionClips).toEqual([]);
    expect(effects).not.toContainEqual(expect.objectContaining({ type: 'playMedia' }));
    expect(effects).not.toContainEqual(expect.objectContaining({ type: 'timelineOverlay' }));
  });

  it('propagates muted media tracks to runtime video effects', () => {
    let timeline = insertTimelineClip({
      timeline: ensureNodeTimeline(),
      clip: createMediaClip({ type: 'video', src: 'assets/muted.mp4', startTime: 0, duration: 8 }),
    });
    const mediaTrackId = timeline.tracks.find((track) => track.type === 'media')?.id as string;
    timeline = updateTimelineTrack({ timeline, trackId: mediaTrackId, patch: { muted: true } });
    const story = node('story', 'scene', {
      type: 'scene',
      title: 'Story',
      bodyText: '',
      timeline,
    });

    expect(buildNodeEffects(story, [])).toContainEqual(expect.objectContaining({ type: 'playMedia', src: 'assets/muted.mp4', muted: true }));
  });
});
