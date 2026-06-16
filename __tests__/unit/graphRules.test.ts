import { describe, expect, it } from 'vitest';

import { AppEdge, AppNode } from '@/app/_types';
import { addGraphEdge, filterEdgesForNodes, isValidGraphConnection } from '@/app/_utils/graphRules';

const nodes: AppNode[] = [
  {
    id: 'source',
    type: 'scene',
    position: { x: 0, y: 0 },
    data: { type: 'scene', title: 'Source', bodyText: '' },
  },
  {
    id: 'target-a',
    type: 'scene',
    position: { x: 100, y: 0 },
    data: { type: 'scene', title: 'Target A', bodyText: '' },
  },
  {
    id: 'target-b',
    type: 'scene',
    position: { x: 200, y: 0 },
    data: { type: 'scene', title: 'Target B', bodyText: '' },
  },
];

describe('graphRules', () => {
  it('rejects duplicate source and sourceHandle edges', () => {
    const edges = addGraphEdge({ source: 'source', sourceHandle: 'a', target: 'target-a', targetHandle: null }, [], nodes);
    const nextEdges = addGraphEdge({ source: 'source', sourceHandle: 'a', target: 'target-b', targetHandle: null }, edges, nodes);

    expect(nextEdges).toHaveLength(1);
    expect(nextEdges[0].target).toBe('target-a');
  });

  it('allows different handles from the same source', () => {
    const first = addGraphEdge({ source: 'source', sourceHandle: 'a', target: 'target-a', targetHandle: null }, [], nodes);
    const second = addGraphEdge({ source: 'source', sourceHandle: 'b', target: 'target-b', targetHandle: null }, first, nodes);

    expect(second).toHaveLength(2);
  });

  it('rejects self loops', () => {
    expect(isValidGraphConnection({ source: 'source', sourceHandle: null, target: 'source', targetHandle: null }, [], nodes)).toBe(false);
  });

  it('filters invalid persisted edges', () => {
    const persistedEdges = [
      { id: 'valid', source: 'source', target: 'target-a' },
      { id: 'missing-source', source: 'missing', target: 'target-a' },
      { id: 'missing-target', source: 'source', target: 'missing' },
      { id: 'self', source: 'source', target: 'source' },
    ] as AppEdge[];

    expect(filterEdgesForNodes(persistedEdges, nodes)).toEqual([{ id: 'valid', source: 'source', target: 'target-a' }]);
  });
});
