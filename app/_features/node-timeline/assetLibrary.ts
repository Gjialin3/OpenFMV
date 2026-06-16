import { OpenFMVAsset, OpenFMVProject } from '@/app/_types';
import { getAssetIdentityKeys } from '@/app/_utils/assetIdentity';

export interface TimelineAssetItem {
  asset: OpenFMVAsset;
  projectId: string;
  projectTitle: string;
}

export const getTimelineAssetItemKey = (item: TimelineAssetItem) => `${item.projectId}:${item.asset.id}`;

export const buildTimelineAssetLibraryItems = ({
  projects,
  currentProjectId,
  isAssetSupported,
}: {
  projects: OpenFMVProject[];
  currentProjectId?: string | null;
  isAssetSupported?: (asset: OpenFMVAsset) => boolean;
}): TimelineAssetItem[] => {
  const activeProject = currentProjectId ? projects.find((project) => project.id === currentProjectId) : null;
  const visibleProjects = activeProject
    ? [activeProject, ...projects.filter((project) => project.id !== activeProject.id)]
    : projects;
  const seenAssetKeys = new Set<string>();
  const items: TimelineAssetItem[] = [];

  for (const project of visibleProjects) {
    for (const asset of project.assets || []) {
      if (isAssetSupported && !isAssetSupported(asset)) continue;

      const assetKeys = getAssetIdentityKeys(asset);
      if (assetKeys.some((key) => seenAssetKeys.has(key))) continue;

      assetKeys.forEach((key) => seenAssetKeys.add(key));
      items.push({
        asset,
        projectId: project.id,
        projectTitle: project.title,
      });
    }
  }

  return items;
};
