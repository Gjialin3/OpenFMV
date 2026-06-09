import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';

import { Film } from 'lucide-react';

import { useProjectSessionStore } from '@/app/_features/project-session/store';
import { useEditorStore } from '../../_store/useEditorStore';
import { getLocalizedPath } from '../../_utils/localePaths';

interface OpenNodeTimelineButtonProps {
  nodeId: string;
}

export const useOpenNodeTimeline = (nodeId: string) => {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentProjectId = useProjectSessionStore((state) => state.projectId);
  const setSelectedNodeId = useEditorStore((state) => state.setSelectedNodeId);

  return React.useCallback((event?: React.SyntheticEvent<HTMLElement>) => {
    event?.preventDefault();
    event?.stopPropagation();

    setSelectedNodeId(nodeId);
    const params = new URLSearchParams(searchParams.toString());
    if (!params.get('id') && currentProjectId) params.set('id', currentProjectId);
    const query = params.toString();
    router.push(getLocalizedPath(locale, `/nodes${query ? `?${query}` : ''}`));
  }, [currentProjectId, locale, nodeId, router, searchParams, setSelectedNodeId]);
};

const OpenNodeTimelineButton = ({ nodeId }: OpenNodeTimelineButtonProps) => {
  const t = useTranslations('editor');
  const openTimeline = useOpenNodeTimeline(nodeId);

  return (
    <button
      type="button"
      onClick={openTimeline}
      onMouseDown={(event) => event.stopPropagation()}
      className="nodrag grid h-7 w-7 shrink-0 place-items-center rounded-md text-openfmv-muted transition hover:bg-white/[0.08] hover:text-white"
      title={t('nodePreview.openInNodes')}
      aria-label={t('nodePreview.openInNodes')}
    >
      <Film size={13} />
    </button>
  );
};

export default OpenNodeTimelineButton;
