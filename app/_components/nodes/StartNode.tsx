import React, { memo } from 'react';
import { useTranslations } from 'next-intl';

import { NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';

import { AppNode } from '../../_types';
import EditorNodeCardBody, { getEditorNodeDurationLabel } from './EditorNodeCardBody';
import OpenNodeTimelineButton from './OpenNodeTimelineButton';
import { nodeHeaderIconClassName, nodeTitleClassName, nodeTypeBadgeClassName } from './nodeStyles';

const StartNode = ({ id, data }: NodeProps<AppNode>) => {
  const t = useTranslations('editor');
  const startData = data.type === 'start' ? data : undefined;
  const displayLabel = startData?.label && startData.label !== '??' ? startData.label : t('nodeTypes.start.name');
  const durationLabel = getEditorNodeDurationLabel(data);

  return (
    <div className="group relative">
      <div className="w-[320px] rounded-lg border border-white/12 bg-[#1f1f1f] shadow-[0_18px_50px_rgba(0,0,0,0.34)] transition group-hover:border-white/28">
        <div className="flex h-11 items-center gap-2 border-b border-white/10 bg-white/[0.045] px-3">
          <div className={nodeHeaderIconClassName}>
            <Play size={15} fill="currentColor" />
          </div>
          <div className={nodeTitleClassName}>{displayLabel}</div>
          <OpenNodeTimelineButton nodeId={id} />
          {durationLabel && <div className="shrink-0 font-mono text-[11px] font-semibold text-openfmv-muted">{durationLabel}</div>}
          <div className={nodeTypeBadgeClassName}>{t('startNode')}</div>
        </div>

        <EditorNodeCardBody nodeId={id} data={data} />
      </div>
    </div>
  );
};

export default memo(StartNode);
