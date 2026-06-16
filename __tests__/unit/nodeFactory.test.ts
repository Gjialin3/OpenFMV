import { describe, expect, it, vi } from 'vitest';

import { AppNode } from '@/app/_types';
import { createEditorNode, getAvailableNodePosition } from '@/app/_components/editor/canvas/nodeFactory';

vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'new-node-id'),
});

const sceneNode = (id: string, x: number, y: number): AppNode => ({
  id,
  type: 'scene',
  position: { x, y },
  data: { type: 'scene', title: id, bodyText: '' },
});

describe('editor canvas nodeFactory', () => {
  it('keeps open positions unchanged', () => {
    expect(getAvailableNodePosition({ x: 100, y: 100 }, [sceneNode('existing', 300, 300)])).toEqual({ x: 100, y: 100 });
  });

  it('offsets a new node away from occupied positions', () => {
    expect(getAvailableNodePosition({ x: 100, y: 100 }, [sceneNode('existing', 100, 100)])).toEqual({ x: 160, y: 160 });
  });

  it('creates nodes through the registry with scene count context', () => {
    const node = createEditorNode('scene', { x: 10, y: 20 }, [
      sceneNode('scene-1', 0, 0),
      sceneNode('scene-2', 100, 0),
    ]);

    expect(node).toEqual({
      id: 'new-node-id',
      type: 'scene',
      position: { x: 10, y: 20 },
      data: { type: 'scene', title: 'Scene-3', bodyText: '' },
    });
  });
});
