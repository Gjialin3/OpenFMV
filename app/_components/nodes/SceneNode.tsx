import React, { memo, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import type { NodeProps } from '@xyflow/react';
import { Position } from '@xyflow/react';
import { FileText } from 'lucide-react';

import { AppNode } from '../../_types';
import { useDebouncedCallback } from '../../_hooks/useDebounce';
import { useProjectSessionStore } from '@/app/_features/project-session/store';
import { CustomHandle } from './CustomHandle';
import EditorNodeCardBody, { getEditorNodeDurationLabel } from './EditorNodeCardBody';
import OpenNodeTimelineButton from './OpenNodeTimelineButton';
import { nodeHeaderIconClassName, nodeTitleInputClassName, nodeTypeBadgeClassName } from './nodeStyles';

const SceneNode = ({ id, data }: NodeProps<AppNode>) => {
  const t = useTranslations('editor');
  const { updateNodeData } = useProjectSessionStore();
  const title = data.type === 'scene' ? data.title : t('nodeTypes.story.name');
  const durationLabel = getEditorNodeDurationLabel(data);
  const [localTitle, setLocalTitle] = useState(title);

  useEffect(() => setLocalTitle(title), [title]);

  const debouncedUpdateTitle = useDebouncedCallback((value: string) => updateNodeData(id, { title: value }), 300);

  return (
    <div className="group relative">
      <div className="w-[320px] rounded-lg border border-white/12 bg-[#1f1f1f] shadow-[0_18px_50px_rgba(0,0,0,0.34)] transition group-hover:border-white/28">
        <div className="flex h-11 items-center gap-2 border-b border-white/10 bg-white/[0.045] px-3">
          <div className={nodeHeaderIconClassName}><FileText size={15} /></div>
          <input value={localTitle} onChange={(event) => { setLocalTitle(event.target.value); debouncedUpdateTitle(event.target.value); }} className={nodeTitleInputClassName} placeholder={t('nodeTypes.story.name')} />
          <OpenNodeTimelineButton nodeId={id} />
          {durationLabel && <div className="shrink-0 font-mono text-[11px] font-semibold text-openfmv-muted">{durationLabel}</div>}
          <div className={nodeTypeBadgeClassName}>{t('nodeTypes.story.name')}</div>
        </div>

        <EditorNodeCardBody nodeId={id} data={data} />
      </div>
      <div className="absolute left-[-10px] top-6 -translate-x-1/2"><CustomHandle type="target" position={Position.Left} className="!border-white/30 !bg-[#1f1f1f]" /></div>
    </div>
  );
};

export default memo(SceneNode);
