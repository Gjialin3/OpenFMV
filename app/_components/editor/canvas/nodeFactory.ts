import type { XYPosition } from '@xyflow/react';

import { nodeRegistry } from '@/app/_registry/nodeRegistry';
import { AppNode, NodeType } from '@/app/_types';

export interface EditorNodeDefaults {
  startLabel: string;
  endLabel: string;
  sceneTitlePrefix: string;
}

export const getAvailableNodePosition = (position: XYPosition, nodes: AppNode[]) => {
  let nextPosition = position;
  let attempts = 0;

  while (
    nodes.some(
      (node) =>
        Math.abs(node.position.x - nextPosition.x) < 50 &&
        Math.abs(node.position.y - nextPosition.y) < 50
    ) &&
    attempts < 10
  ) {
    nextPosition = {
      x: nextPosition.x + 30,
      y: nextPosition.y + 30,
    };
    attempts++;
  }

  return nextPosition;
};

export const createEditorNode = (type: NodeType, position: XYPosition, nodes: AppNode[], defaults?: EditorNodeDefaults): AppNode => {
  const sceneCount = nodes.filter((node) => node.type === 'scene').length;

  return {
    id: crypto.randomUUID(),
    type,
    position,
    data: nodeRegistry.createDefaultData(type, { sceneCount, ...defaults }),
  };
};
