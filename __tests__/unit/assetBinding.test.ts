import { describe, expect, it } from 'vitest';

import { AppNode } from '@/app/_types';
import { getPickerAssetUpdate } from '@/app/_components/editor/canvas/assetBinding';

const sceneNode: AppNode = {
  id: 'story',
  type: 'scene',
  position: { x: 0, y: 0 },
  data: { type: 'scene', title: 'Story', bodyText: '' },
};

describe('assetBinding', () => {
  it('maps text picker assets to scene text fields', () => {
    expect(getPickerAssetUpdate(sceneNode, { id: 'text', type: 'text', url: '', prompt: null, metadata: { content: 'Scene text' }, createdAt: new Date() })).toEqual({
      bodyText: 'Scene text',
    });
  });

  it('does not bind media picker assets to blueprint node data', () => {
    expect(getPickerAssetUpdate(sceneNode, { id: 'image', type: 'image', url: 'image.png', prompt: null, metadata: {}, createdAt: new Date() })).toBeNull();
    expect(getPickerAssetUpdate(sceneNode, { id: 'video', type: 'video', url: 'video.mp4', prompt: null, metadata: { playbackId: 'mux' }, createdAt: new Date() })).toBeNull();
  });

  it('rejects unsupported or incompatible asset bindings', () => {
    expect(getPickerAssetUpdate(sceneNode, { id: 'audio', type: 'audio', url: 'audio.mp3', prompt: null, metadata: {}, createdAt: new Date() })).toBeNull();
  });
});
