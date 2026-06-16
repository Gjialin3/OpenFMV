import type { LucideIcon } from 'lucide-react';
import { FileText, Flag, Play } from 'lucide-react';

import type { AppNode, NodeType } from '../_types';

export type NodeCategory = 'flow-control' | 'scene' | 'media';

export type NodeMenuPlacement = 'toolbar' | 'pendingConnect' | 'edgeMenu' | 'quickAdd';

export interface NodeFactoryContext {
  sceneCount: number;
  startLabel?: string;
  endLabel?: string;
  sceneTitlePrefix?: string;
}

export interface NodeDefinition {
  type: NodeType;
  category: NodeCategory;
  displayName: string;
  menuDescription: string;
  headerLabel: string;
  icon: LucideIcon;
  iconColorClass: string;
  menuPlacement: Record<NodeMenuPlacement, boolean>;
  createDefaultData: (context: NodeFactoryContext) => AppNode['data'];
}

export const NODE_DEFINITIONS: NodeDefinition[] = [
  {
    type: 'start',
    category: 'flow-control',
    displayName: 'Start',
    menuDescription: 'Story entry point',
    headerLabel: 'ENTRY POINT',
    icon: Play,
    iconColorClass: 'bg-white/[0.08] text-openfmv-sub',
    menuPlacement: {
      toolbar: true,
      pendingConnect: false,
      edgeMenu: false,
      quickAdd: false,
    },
    createDefaultData: (context) => ({
      type: 'start',
      label: context.startLabel || 'Start',
    }),
  },
  {
    type: 'scene',
    category: 'scene',
    displayName: 'Scene',
    menuDescription: 'Timeline media and button interactions',
    headerLabel: 'SCENE',
    icon: FileText,
    iconColorClass: 'bg-white/[0.08] text-openfmv-sub',
    menuPlacement: {
      toolbar: true,
      pendingConnect: true,
      edgeMenu: true,
      quickAdd: true,
    },
    createDefaultData: (context) => ({
      type: 'scene',
      title: `${context.sceneTitlePrefix || 'Scene'}-${context.sceneCount + 1}`,
      bodyText: '',
    }),
  },
  {
    type: 'end',
    category: 'flow-control',
    displayName: 'End',
    menuDescription: 'Story endpoint',
    headerLabel: 'FINISH',
    icon: Flag,
    iconColorClass: 'bg-white/[0.08] text-openfmv-sub',
    menuPlacement: {
      toolbar: true,
      pendingConnect: false,
      edgeMenu: false,
      quickAdd: true,
    },
    createDefaultData: (context) => ({
      type: 'end',
      label: context.endLabel || 'End',
    }),
  },
];
