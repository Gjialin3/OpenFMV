import React, { memo } from 'react';
import { useTranslations } from 'next-intl';
import { NodeProps, Position } from '@xyflow/react';
import { CheckCircle2 } from 'lucide-react';

import { AppNode } from '../../_types';
import { CustomHandle } from './CustomHandle';
import EditorNodeCardBody, { getEditorNodeDurationLabel } from './EditorNodeCardBody';
import OpenNodeTimelineButton from './OpenNodeTimelineButton';
import { nodeHeaderIconClassName, nodeTitleClassName, nodeTypeBadgeClassName } from './nodeStyles';

const EndNode = ({ id, data }: NodeProps<AppNode>) => {
  const t = useTranslations('editor');
  const label = data.type === 'end' ? data.label || t('endNode') : t('endNode');
  const durationLabel = getEditorNodeDurationLabel(data);

  return (
    <div className="group relative">
      <div className="w-[320px] rounded-lg border border-white/12 bg-[#1f1f1f] shadow-[0_18px_50px_rgba(0,0,0,0.34)] transition group-hover:border-white/28">
        <div className="flex h-11 items-center gap-2 border-b border-white/10 bg-white/[0.045] px-3">
          <div className={nodeHeaderIconClassName}>
            <CheckCircle2 size={15} />
          </div>
          <div className={`${nodeTitleClassName} truncate`}>{label}</div>
          <OpenNodeTimelineButton nodeId={id} />
          {durationLabel && <div className="shrink-0 font-mono text-[11px] font-semibold text-openfmv-muted">{durationLabel}</div>}
          <div className={nodeTypeBadgeClassName}>{t('nodeTypes.end.name')}</div>
        </div>
        <EditorNodeCardBody nodeId={id} data={data} />
      </div>
      <div className="absolute left-[-10px] top-6 -translate-x-1/2">
        <CustomHandle type="target" position={Position.Left} isConnectable className="!border-white/30 !bg-[#1f1f1f]" />
      </div>
    </div>
  );
};

export default memo(EndNode);
