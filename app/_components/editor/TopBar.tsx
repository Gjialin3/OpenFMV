'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Clock3, Download, Film, GitBranch, Loader2, Play, Settings } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEditorStore } from '@/app/_store/useEditorStore';
import { usePlayerStore } from '@/app/_store/usePlayerStore';
import { useRuntimeGraphStore } from '@/app/_store/useRuntimeGraphStore';
import { ensureGraphData, getLocalProject, saveLocalProject } from '@/app/_utils/localProjects';
import { getLocalizedPath, stripLocaleFromPath } from '@/app/_utils/localePaths';
import { createProjectSnapshot } from '@/app/_utils/projectPersistence';
import { OpenFMVProject } from '@/app/_types';
import { Header } from '../ui/Header';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useClickOutside } from '@/app/_hooks/useClickOutside';

export default function TopBar() {
  const locale = useLocale();
  const t = useTranslations('editor');
  const { nodes, edges, setNodes, setEdges, autoSaveEnabled, setAutoSaveEnabled, edgeCurveStyle, setEdgeCurveStyle, setCurrentProjectId } = useEditorStore();
  const { setIsPlaying, setCurrentNode, reset } = usePlayerStore();
  const { setGraph } = useRuntimeGraphStore();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const projectId = searchParams.get('id');
  const initialTitleFromQuery = searchParams.get('title')?.trim();
  const [project, setProject] = useState<OpenFMVProject | null>(null);
  const [title, setTitle] = useState(initialTitleFromQuery || t('untitledProject'));
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isFirstGraphChange = useRef(true);
  const settingsRef = useRef<HTMLDivElement>(null);
  const exportStatusTimerRef = useRef<number | null>(null);
  const queryString = searchParams.toString();
  const querySuffix = queryString ? `?${queryString}` : '';
  const isNodeMode = stripLocaleFromPath(pathname).startsWith('/nodes');
  const blueprintHref = getLocalizedPath(locale, `/editor${querySuffix}`);
  const nodesHref = getLocalizedPath(locale, `/nodes${querySuffix}`);

  useClickOutside(settingsRef as React.RefObject<HTMLElement>, () => {
    if (isSettingsOpen) setIsSettingsOpen(false);
  });

  useEffect(() => {
    return () => {
      if (exportStatusTimerRef.current) window.clearTimeout(exportStatusTimerRef.current);
    };
  }, []);

  const saveStatus = !autoSaveEnabled
    ? { label: t('autoSavePaused'), icon: Clock3, className: 'text-openfmv-muted', spin: false }
    : isSaving
    ? { label: t('saving'), icon: Loader2, className: 'text-sky-200', spin: true }
    : hasUnsavedChanges
      ? { label: t('autoSaving'), icon: Clock3, className: 'text-orange-200', spin: false }
      : { label: t('autoSaved'), icon: Check, className: 'text-emerald-200', spin: false };
  const SaveStatusIcon = saveStatus.icon;

  useEffect(() => {
    const loadedProject = getLocalProject(projectId);
    if (!loadedProject) {
      setCurrentProjectId(projectId);
      return;
    }

    setProject(loadedProject);
    setTitle(loadedProject.title);
    const graphData = ensureGraphData(loadedProject.graphData);
    setNodes(graphData.nodes);
    setEdges(graphData.edges);
    setCurrentProjectId(loadedProject.id);
    setLastSaved(new Date(loadedProject.updatedAt));
    isFirstGraphChange.current = true;
  }, [projectId, setCurrentProjectId, setEdges, setNodes]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const latestProject = project?.id ? getLocalProject(project.id) : null;
      const nextProject = createProjectSnapshot(project, title, nodes, edges, latestProject?.assets);
      const savedProject = await saveLocalProject(nextProject);
      setProject(savedProject);
      setCurrentProjectId(savedProject.id);
      setLastSaved(new Date(savedProject.updatedAt));
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save local project', error);
      alert(t('saveLocalFailed'));
    } finally {
      setIsSaving(false);
    }
  }, [edges, nodes, project, setCurrentProjectId, t, title]);

  const handleSaveAs = useCallback(async () => {
    if (!window.openfmv?.selectDirectory) {
      await handleSave();
      return;
    }

    const projectDirectory = await window.openfmv.selectDirectory();
    if (!projectDirectory) return;

    setIsSaving(true);
    try {
      const latestProject = project?.id ? getLocalProject(project.id) : null;
      const nextProject = createProjectSnapshot(project, title, nodes, edges, latestProject?.assets);
      const savedProject = await saveLocalProject({
        ...nextProject,
        metadata: {
          ...nextProject.metadata,
          projectDirectory,
        },
      });
      setProject(savedProject);
      setCurrentProjectId(savedProject.id);
      setLastSaved(new Date(savedProject.updatedAt));
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save local project as', error);
      alert(t('saveAsFailed'));
    } finally {
      setIsSaving(false);
    }
  }, [edges, handleSave, nodes, project, setCurrentProjectId, t, title]);

  useEffect(() => {
    if (isFirstGraphChange.current) {
      isFirstGraphChange.current = false;
      return;
    }
    setHasUnsavedChanges(true);
    if (!autoSaveEnabled) return;
    const timer = window.setTimeout(() => {
      void handleSave();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [autoSaveEnabled, edges, handleSave, nodes, title]);

  const handlePlay = () => {
    const startNode = nodes.find((node) => node.type === 'start') ?? nodes[0];
    if (!startNode) return;
    setGraph({ nodes, edges }, startNode.id);
    reset();
    setCurrentNode(startNode.id);
    setIsPlaying(true);
  };

  const showExportStatus = (message: string) => {
    if (exportStatusTimerRef.current) window.clearTimeout(exportStatusTimerRef.current);
    setExportStatus(message);
    exportStatusTimerRef.current = window.setTimeout(() => {
      setExportStatus('');
      exportStatusTimerRef.current = null;
    }, 3600);
  };

  const handleExport = async () => {
    if (!window.openfmv?.exportGame || !window.openfmv?.selectDirectory) {
      showExportStatus(t('desktopExportRequired'));
      alert(t('desktopExportRequiredDetail'));
      return;
    }

    const latestProject = project?.id ? getLocalProject(project.id) : null;
    const nextProject = createProjectSnapshot(project, title, nodes, edges, latestProject?.assets);
    showExportStatus(t('exporting'));
    setIsExporting(true);
    try {
      const savedProject = await saveLocalProject(nextProject);
      setProject(savedProject);
      const outputDirectory = await window.openfmv.selectDirectory();
      if (!outputDirectory) return;
      await window.openfmv.exportGame(savedProject, {
        gameTitle: savedProject.title,
        outputDirectory,
        locale,
        entryNodeId: savedProject.metadata.entryNodeId,
        windowMode: 'windowed',
        resolution: { width: 1280, height: 720 },
        includeDebugOverlay: false,
      });
      showExportStatus(t('exportComplete'));
      alert(t('exportComplete'));
    } catch (error) {
      console.error('Failed to export game', error);
      alert(t('exportFailed'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Header position="absolute" className="h-14 border-b border-white/[0.06] bg-black/24 px-3 shadow-[0_16px_44px_rgba(0,0,0,0.24)]">
      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <div className="pointer-events-auto flex min-w-0 items-center">
          <div className="flex h-9 min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.075] px-2.5 shadow-[0_10px_28px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
            <div className="h-6 w-6 shrink-0 rounded-full bg-[radial-gradient(circle_at_30%_24%,#fff7ad,transparent_31%),radial-gradient(circle_at_66%_25%,#7dd3fc,transparent_34%),radial-gradient(circle_at_42%_70%,#c084fc,transparent_38%),linear-gradient(135deg,#f97316,#14b8a6)] shadow-[0_0_16px_rgba(125,211,252,0.18)]" />
            <Input type="text" value={title} onChange={(event) => setTitle(event.target.value)} className="h-auto w-32 min-w-0 border-0 bg-transparent px-0 py-0 text-sm font-semibold tracking-normal text-white shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 md:w-56" />
            <div className="h-5 w-px shrink-0 bg-white/10" />
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/20" title={lastSaved ? t('lastSaved', { time: lastSaved.toLocaleTimeString() }) : t('autoSaveEnabled')} suppressHydrationWarning>
              <SaveStatusIcon size={14} className={`${saveStatus.className} ${saveStatus.spin ? 'animate-spin' : ''}`} />
            </div>
          </div>
        </div>

        <nav className="pointer-events-auto flex h-9 items-center gap-1 rounded-full border border-white/10 bg-white/[0.075] p-1 shadow-[0_10px_28px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
          <Link href={blueprintHref} className={`inline-flex h-7 min-w-[94px] items-center justify-center gap-1.5 rounded-full px-3 text-xs font-bold transition ${isNodeMode ? 'text-openfmv-sub hover:bg-white/[0.08] hover:text-white' : 'bg-white/[0.18] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'}`} title={t('blueprintMode')}>
            <GitBranch size={13} />
            <span className="hidden sm:inline">{t('blueprintMode')}</span>
          </Link>
          <Link href={nodesHref} className={`inline-flex h-7 min-w-[88px] items-center justify-center gap-1.5 rounded-full px-3 text-xs font-bold transition ${isNodeMode ? 'bg-white/[0.18] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]' : 'text-openfmv-sub hover:bg-white/[0.08] hover:text-white'}`} title={t('nodeMode')}>
            <Film size={13} />
            <span className="hidden sm:inline">{t('nodeMode')}</span>
          </Link>
        </nav>

        <div className="pointer-events-auto flex min-w-0 items-center justify-end">
          <div className="flex h-9 items-center gap-1 rounded-full border border-white/10 bg-white/[0.075] p-1 shadow-[0_10px_28px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
            <div className="relative" ref={settingsRef}>
              <Button onClick={() => setIsSettingsOpen((value) => !value)} variant="icon" size="icon" className={`h-7 w-7 rounded-full border-0 bg-transparent shadow-none ${isSettingsOpen ? 'text-openfmv-accent' : 'text-openfmv-sub'}`} title={t('settings')}>
                <Settings size={15} />
              </Button>

              {isSettingsOpen && (
                <div className="absolute right-0 top-full z-50 mt-3 w-72 overflow-hidden rounded-[18px] border border-white/15 bg-[#15171c]/95 p-1.5 shadow-[0_24px_80px_rgba(0,0,0,0.56)] ring-1 ring-black/40 backdrop-blur-xl">
                  <div className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <button type="button" role="switch" aria-checked={autoSaveEnabled} onClick={() => setAutoSaveEnabled(!autoSaveEnabled)} className={`flex h-6 w-11 shrink-0 items-center rounded-full border p-0.5 transition ${autoSaveEnabled ? 'border-emerald-300/40 bg-emerald-400/25' : 'border-white/15 bg-white/[0.08]'}`} title={autoSaveEnabled ? t('pauseAutoSave') : t('enableAutoSave')}>
                        <span className={`h-5 w-5 rounded-full bg-white shadow-[0_3px_10px_rgba(0,0,0,0.35)] transition-transform ${autoSaveEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold text-openfmv-text">
                          {t('autoSave')}
                          <SaveStatusIcon size={13} className={`${saveStatus.className} ${saveStatus.spin ? 'animate-spin' : ''}`} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/[0.08] px-1.5 py-1.5">
                    <Button onClick={() => { setIsSettingsOpen(false); void handleSaveAs(); }} variant="ghost" className="h-9 w-full justify-start rounded-[12px] px-2.5 text-sm font-semibold text-openfmv-text hover:bg-white/[0.075]">
                      {t('saveAs')}
                    </Button>
                  </div>

                  <div className="border-t border-white/[0.08] px-3 py-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-openfmv-muted">{t('edgeStyle')}</div>
                    <Select value={edgeCurveStyle} onValueChange={(value) => setEdgeCurveStyle(value as 'smoothstep' | 'bezier' | 'straight')}>
                      <SelectTrigger className="nodrag h-9 rounded-[12px] border-white/15 bg-white/[0.075] text-sm text-openfmv-text">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-white/15 bg-openfmv-node text-openfmv-text">
                        <SelectItem value="smoothstep">{t('smoothStep')}</SelectItem>
                        <SelectItem value="bezier">{t('bezier')}</SelectItem>
                        <SelectItem value="straight">{t('straight')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            <Button onClick={handlePlay} size="pill" className="h-7 rounded-full bg-white/[0.16] px-3 text-xs font-bold text-white shadow-none hover:bg-white/[0.22]">
              <Play size={13} fill="currentColor" />
              <span className="hidden sm:inline">{t('preview')}</span>
            </Button>

            <Button onClick={() => void handleExport()} disabled={isExporting} variant="outline" size="pill" className="h-7 rounded-full border-0 bg-transparent px-2.5 text-xs font-bold text-openfmv-sub shadow-none hover:bg-white/[0.10] hover:text-white">
              {isExporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              <span className="hidden sm:inline">{t('export')}</span>
            </Button>
          </div>
          {exportStatus && (
            <div className="absolute right-4 top-[58px] z-50 max-w-[360px] truncate rounded-[12px] border border-emerald-300/20 bg-black/72 px-3 py-2 text-xs font-medium text-emerald-100 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-2xl" title={exportStatus}>
              {exportStatus}
            </div>
          )}
        </div>
      </div>
    </Header>
  );
}


