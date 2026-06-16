import { AppNode, OpenFMVAsset } from '@/app/_types';

export type PickerAsset = {
  id: string;
  type: OpenFMVAsset['type'];
  url: string;
  prompt: string | null;
  metadata: unknown;
  createdAt: Date;
};

export const canReceiveAsset = (node: AppNode) => {
  return node.type === 'start' || node.type === 'scene' || node.type === 'end';
};

export const getPickerAssetUpdate = (targetNode: AppNode, asset: PickerAsset) => {
  if (!canReceiveAsset(targetNode)) return null;

  if (asset.type === 'text') {
    const metadata = typeof asset.metadata === 'object' && asset.metadata ? asset.metadata as Record<string, unknown> : {};
    const content = typeof metadata.content === 'string' ? metadata.content : asset.prompt || '';
    return { bodyText: content };
  }

  return null;
};
