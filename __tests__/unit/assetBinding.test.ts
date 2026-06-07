import { describe, expect, it } from 'vitest';

import { AppNode } from '@/app/_types';
import { getPickerAssetUpdate } from '@/app/_components/editor/canvas/assetBinding';

const storyNode: AppNode = {
  id: 'story',
  type: 'story',
  position: { x: 0, y: 0 },
  data: { type: 'story', title: 'Story', content: '' },
};

const interactionNode: AppNode = {
  id: 'interaction',
  type: 'interaction',
  position: { x: 0, y: 0 },
  data: { type: 'interaction', rules: [] },
};

describe('assetBinding', () => {
  it('maps text picker assets to story text fields', () => {
    expect(getPickerAssetUpdate(storyNode, { id: 'text', type: 'text', url: '', prompt: null, metadata: { content: 'Scene text' }, createdAt: new Date() })).toEqual({
      content: 'Scene text',
      fullText: 'Scene text',
    });
  });

  it('maps text picker assets to interaction prompts', () => {
    expect(getPickerAssetUpdate(interactionNode, { id: 'text', type: 'text', url: '', prompt: null, metadata: { content: 'Choose' }, createdAt: new Date() })).toEqual({
      prompt: 'Choose',
    });
  });

  it('does not bind media picker assets to blueprint node data', () => {
    expect(getPickerAssetUpdate(storyNode, { id: 'image', type: 'image', url: 'image.png', prompt: null, metadata: {}, createdAt: new Date() })).toBeNull();
    expect(getPickerAssetUpdate(storyNode, { id: 'video', type: 'video', url: 'video.mp4', prompt: null, metadata: { playbackId: 'mux' }, createdAt: new Date() })).toBeNull();
  });

  it('rejects unsupported or incompatible asset bindings', () => {
    expect(getPickerAssetUpdate(storyNode, { id: 'audio', type: 'audio', url: 'audio.mp3', prompt: null, metadata: {}, createdAt: new Date() })).toBeNull();
  });
});
