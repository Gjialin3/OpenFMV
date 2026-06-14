'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, FileText, Image as ImageIcon, Music, Plus, Search, Upload, Video, X } from 'lucide-react';

import { useProjectSessionStore } from '@/app/_features/project-session/store';
import { useResolvedMediaSrc } from '@/app/_hooks/useResolvedMediaSrc';
import { OpenFMVAsset } from '@/app/_types';
import { addAssetToLocalProject, canUseNativeAssetPicker, importAssetFromFile, importAssetFromNativePicker, isStorageQuotaError, listLocalProjects } from '@/app/_utils/localProjects';
import { Button } from '@/app/_components/ui/button';
import { Input } from '@/app/_components/ui/input';
import { PickerAsset } from './canvas/assetBinding';

type AssetFilter = 'all' | OpenFMVAsset['type'];

interface AssetPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (asset: PickerAsset) => void;
  allowAudio?: boolean;
}

interface ProjectAsset {
  asset: OpenFMVAsset;
  projectId: string;
  projectTitle: string;
}

const assetFilters: AssetFilter[] = [
  'all',
  'image',
  'video',
  'text',
  'audio',
];

const getTextPreview = (asset: OpenFMVAsset) => {
  const content = asset.metadata?.content;
  if (typeof content !== 'string') return '';
  return content.replace(/\s+/g, ' ').trim().slice(0, 100);
};

const formatAssetDuration = (asset: OpenFMVAsset) => {
  const duration = Number(asset.metadata?.duration);
  if (!Number.isFinite(duration) || duration <= 0) return '';
  if (duration < 60) return `${Math.round(duration)}s`;
  const minutes = Math.floor(duration / 60);
  const seconds = Math.round(duration % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const formatAssetSize = (value: unknown) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
};

const toPickerAsset = (asset: OpenFMVAsset): PickerAsset => ({
  id: asset.id,
  type: asset.type,
  url: asset.relativePath || asset.path,
  prompt: asset.name,
  metadata: asset.metadata,
  createdAt: new Date(asset.importedAt),
});

const AssetPreview = ({ asset }: { asset: OpenFMVAsset }) => {
  const Icon = asset.type === 'image' ? ImageIcon : asset.type === 'video' ? Video : asset.type === 'audio' ? Music : FileText;
  const src = useResolvedMediaSrc(asset.path || asset.relativePath);

  if (asset.type === 'image') return <img src={src} alt={asset.name} className="h-full w-full object-cover" />;
  if (asset.type === 'video') return <video src={src} className="h-full w-full object-cover" muted />;
  return <Icon size={21} />;
};

export default function AssetPicker({ isOpen, onClose, onSelect, allowAudio = false }: AssetPickerProps) {
  const t = useTranslations('assets');
  const inputRef = useRef<HTMLInputElement>(null);
  const currentProjectId = useProjectSessionStore((state) => state.projectId);
  const saveProjectSession = useProjectSessionStore((state) => state.saveNow);
  const [isImporting, setIsImporting] = useState(false);
  const [projectAssets, setProjectAssets] = useState<ProjectAsset[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AssetFilter>('all');
  const useNativeAssetPicker = canUseNativeAssetPicker();

  const refreshProjectAssets = useCallback(() => {
    const projects = listLocalProjects();
    const currentProject = projects.find((project) => project.id === currentProjectId);
    const orderedProjects = currentProject
      ? [currentProject, ...projects.filter((project) => project.id !== currentProject.id)]
      : projects;

    setProjectAssets(orderedProjects.flatMap((project) => (
      (project.assets || []).map((asset) => ({
        asset,
        projectId: project.id,
        projectTitle: project.title,
      }))
    )));
  }, [currentProjectId]);

  useEffect(() => {
    if (!isOpen) return;
    refreshProjectAssets();
  }, [isOpen, refreshProjectAssets]);

  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return projectAssets
      .filter(({ asset }) => filter === 'all' || asset.type === filter)
      .filter(({ asset, projectTitle }) => {
        if (!normalizedQuery) return true;
        return asset.name.toLowerCase().includes(normalizedQuery) || asset.type.includes(normalizedQuery) || projectTitle.toLowerCase().includes(normalizedQuery);
      });
  }, [filter, projectAssets, query]);

  const persistAssetToCurrentProject = async (asset: OpenFMVAsset) => {
    const targetProjectId = currentProjectId ?? (await saveProjectSession())?.id;
    const savedProject = await addAssetToLocalProject(targetProjectId, asset);
    if (!savedProject) throw new Error(t('selectProjectBeforeImport'));
    refreshProjectAssets();
  };

  const selectAsset = (asset: OpenFMVAsset) => {
    if (asset.type === 'audio' && !allowAudio) {
      alert(t('audioCannotBind'));
      return;
    }
    onSelect(toPickerAsset(asset));
    onClose();
  };

  const importAsset = async (asset: OpenFMVAsset | null) => {
    if (!asset) return;
    await persistAssetToCurrentProject(asset);
    if (asset.type === 'audio' && !allowAudio) {
      refreshProjectAssets();
      alert(t('audioCannotBind'));
      return;
    }
    selectAsset(asset);
  };

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      await importAsset(await importAssetFromFile(file));
    } catch (error) {
      console.error('Failed to import local asset', error);
      alert(isStorageQuotaError(error) ? t('quotaExceeded') : error instanceof Error ? error.message : t('importFailed'));
    } finally {
      setIsImporting(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleChooseFile = async () => {
    if (!canUseNativeAssetPicker()) {
      inputRef.current?.click();
      return;
    }

    setIsImporting(true);
    try {
      await importAsset(await importAssetFromNativePicker());
    } catch (error) {
      console.error('Failed to import local asset', error);
      alert(error instanceof Error ? error.message : t('importFailed'));
    } finally {
      setIsImporting(false);
    }
  };

  const importButtonClassName = 'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-white/15 bg-white/[0.055] px-3 text-xs font-medium text-openfmv-sub transition-colors hover:border-openfmv-accent hover:bg-white/[0.08] hover:text-white disabled:pointer-events-none disabled:opacity-50';

  if (!isOpen) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]">
      <div className="pointer-events-auto absolute bottom-5 left-5 top-24 flex w-[390px] flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[#171717]/96 shadow-[0_30px_120px_rgba(0,0,0,0.58)] backdrop-blur-3xl">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
          <Button type="button" onClick={onClose} variant="icon" size="compactIcon" className="rounded-full" title={t('back')}>
            <ChevronLeft size={19} />
          </Button>
          <h2 className="min-w-0 flex-1 text-xl font-semibold text-white">{t('title')}</h2>
          {useNativeAssetPicker ? (
            <Button type="button" onClick={() => void handleChooseFile()} disabled={isImporting} variant="glass" size="sm">
              <Plus size={17} />
              {isImporting ? t('importing') : t('import')}
            </Button>
          ) : (
            <label className={`${importButtonClassName} ${isImporting ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}>
              <Plus size={17} />
              {isImporting ? t('importing') : t('import')}
              <input ref={inputRef} type="file" accept="image/*,video/*,audio/*,.txt,.md" className="sr-only" onChange={(event) => { void handleFiles(event.target.files); }} />
            </label>
          )}
          <Button type="button" onClick={onClose} variant="icon" size="compactIcon" title={t('close')}>
            <X size={18} />
          </Button>
        </div>

        <div className="space-y-4 border-b border-white/10 p-4">
          <div className="relative">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-openfmv-muted" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchAssets')}
              className="h-12 rounded-[18px] border-white/10 bg-black/20 pl-11 text-white placeholder:text-openfmv-muted focus-visible:ring-white/20"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {assetFilters.map((item) => (
              <Button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                variant="glass"
                size="sm"
                className={filter === item ? 'border-white/20 bg-white/[0.16] text-white' : 'border-white/10 bg-white/[0.04] text-openfmv-muted'}
              >
                {t(`filter.${item}`)}
              </Button>
            ))}
          </div>
        </div>

        {useNativeAssetPicker && <input ref={inputRef} type="file" accept="image/*,video/*,audio/*,.txt,.md" className="hidden" onChange={(event) => { void handleFiles(event.target.files); }} />}

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {filteredAssets.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center rounded-[18px] border border-dashed border-white/12 bg-white/[0.035] px-6 text-center">
              <div className="mb-4 grid h-14 w-14 place-items-center rounded-[18px] border border-white/10 bg-white/[0.08] text-openfmv-sub">
                <Upload size={25} />
              </div>
              <div className="text-base font-semibold text-white">{t('noAssetsYet')}</div>
              <p className="mt-2 text-sm leading-6 text-openfmv-muted">{t('noAssetsYetDescription')}</p>
              <Button type="button" onClick={() => void handleChooseFile()} disabled={isImporting} variant="glass" size="default" className="mt-5 text-white">
                <Upload size={16} />
                {isImporting ? t('importing') : t('importAsset')}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAssets.map(({ asset, projectId, projectTitle }) => {
                const typeLabel = t(`type.${asset.type}`);
                const detailItems = asset.type === 'text'
                  ? [getTextPreview(asset) || t('textAsset')]
                  : [typeLabel, formatAssetDuration(asset), formatAssetSize(asset.metadata?.size)].filter(Boolean);

                return (
                  <button
                    key={`${projectId}-${asset.id}`}
                    type="button"
                    onClick={() => selectAsset(asset)}
                    className="group grid w-full grid-cols-[64px_minmax(0,1fr)_30px] items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.045] p-2.5 text-left outline-none transition hover:border-white/22 hover:bg-white/[0.075] focus-visible:border-openfmv-accent/70 focus-visible:ring-2 focus-visible:ring-openfmv-accent/20"
                  >
                    <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-[13px] border border-white/10 bg-black/[0.32] text-openfmv-sub">
                      <AssetPreview asset={asset} />
                      <span className="absolute bottom-1 left-1 rounded-[7px] border border-white/10 bg-black/[0.62] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white/86">
                        {typeLabel}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold leading-5 text-white">{asset.name}</div>
                      <div className="mt-1 truncate text-xs leading-4 text-openfmv-sub">{projectTitle}</div>
                      {detailItems.length > 0 && (
                        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-openfmv-muted">
                          {detailItems.map((item) => (
                            <span key={item} className="min-w-0 truncate first:max-w-[160px]">{item}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="grid h-8 w-8 place-items-center rounded-openfmv-tool border border-white/10 bg-white/[0.05] text-openfmv-muted transition group-hover:border-openfmv-accent/60 group-hover:bg-openfmv-accent/12 group-hover:text-white">
                      <Plus size={15} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
