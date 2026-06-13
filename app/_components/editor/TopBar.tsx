'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronDown, Clock3, Download, Film, GitBranch, Globe2, Loader2, MonitorDown, Play, Settings2 } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useShallow } from 'zustand/react/shallow';

import { useProjectSessionStore } from '@/app/_features/project-session/store';
import { useRuntimeSessionStore } from '@/app/_features/runtime-session/store';
import { useClickOutside } from '@/app/_hooks/useClickOutside';
import { useEditorStore } from '@/app/_store/useEditorStore';
import { usePlayerStore } from '@/app/_store/usePlayerStore';
import { getLocalizedPath, stripLocaleFromPath } from '@/app/_utils/localePaths';
import { Header } from '../ui/Header';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const AUTOSAVE_DELAY_MS = 1200;

export default function TopBar() {
  const locale = useLocale();
  const t = useTranslations('editor');
  const {
    project,
    projectId,
    title,
    status,
    dirty,
    revision,
    loadProject,
    setTitle,
    saveNow,
    flushPendingChanges,
    getGraphSnapshot,
  } = useProjectSessionStore(
    useShallow((state) => ({
      project: state.project,
      projectId: state.projectId,
      title: state.title,
      status: state.status,
      dirty: state.dirty,
      revision: state.revision,
      loadProject: state.loadProject,
      setTitle: state.setTitle,
      saveNow: state.saveNow,
      flushPendingChanges: state.flushPendingChanges,
      getGraphSnapshot: state.getGraphSnapshot,
    }))
  );
  const {
    autoSaveEnabled,
    setAutoSaveEnabled,
    edgeCurveStyle,
    setEdgeCurveStyle,
  } = useEditorStore(
    useShallow((state) => ({
      autoSaveEnabled: state.autoSaveEnabled,
      setAutoSaveEnabled: state.setAutoSaveEnabled,
      edgeCurveStyle: state.edgeCurveStyle,
      setEdgeCurveStyle: state.setEdgeCurveStyle,
    }))
  );
  const { setIsPlaying, setCurrentNode, reset } = usePlayerStore();
  const startRuntimeSession = useRuntimeSessionStore((state) => state.start);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const routeProjectId = searchParams.get('id');
  const initialTitleFromQuery = searchParams.get('title')?.trim();
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const exportStatusTimerRef = useRef<number | null>(null);
  const navigationParams = new URLSearchParams(searchParams.toString());
  if (!navigationParams.get('id') && projectId) navigationParams.set('id', projectId);
  const queryString = navigationParams.toString();
  const querySuffix = queryString ? `?${queryString}` : '';
  const isNodeMode = stripLocaleFromPath(pathname).startsWith('/nodes');
  const blueprintHref = getLocalizedPath(locale, `/editor${querySuffix}`);
  const nodesHref = getLocalizedPath(locale, `/nodes${querySuffix}`);
  const lastSaved = project?.updatedAt ? new Date(project.updatedAt) : null;

  useClickOutside(settingsRef as React.RefObject<HTMLElement>, () => {
    if (isSettingsOpen) setIsSettingsOpen(false);
  });

  useClickOutside(exportMenuRef as React.RefObject<HTMLElement>, () => {
    if (isExportMenuOpen) setIsExportMenuOpen(false);
  });

  const flushProjectSession = useCallback(() => {
    void flushPendingChanges().catch((error) => {
      console.error('Failed to flush local project before navigation', error);
    });
  }, [flushPendingChanges]);

  useEffect(() => {
    void loadProject(routeProjectId).catch((error) => {
      console.error('Failed to load local project', error);
    });
  }, [loadProject, routeProjectId]);

  useEffect(() => {
    if (routeProjectId || !initialTitleFromQuery) return;
    if (title !== initialTitleFromQuery) setTitle(initialTitleFromQuery);
  }, [initialTitleFromQuery, routeProjectId, setTitle, title]);

  useEffect(() => {
    return () => {
      if (exportStatusTimerRef.current) window.clearTimeout(exportStatusTimerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      flushProjectSession();
    };
  }, [flushProjectSession]);

  useEffect(() => {
    if (!autoSaveEnabled || !dirty || status === 'loading' || status === 'saving') return;
    const timer = window.setTimeout(() => {
      void saveNow().catch((error) => {
        console.error('Failed to auto-save local project', error);
      });
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [autoSaveEnabled, dirty, revision, saveNow, status]);

  const isProjectSaving = status === 'saving';
  const saveStatus = !autoSaveEnabled
    ? { label: t('autoSavePaused'), icon: Clock3, className: 'text-openfmv-muted', spin: false }
    : isProjectSaving
      ? { label: t('saving'), icon: Loader2, className: 'text-sky-200', spin: true }
      : dirty
        ? { label: t('autoSaving'), icon: Clock3, className: 'text-orange-200', spin: false }
        : { label: t('autoSaved'), icon: Check, className: 'text-emerald-200', spin: false };
  const SaveStatusIcon = saveStatus.icon;

  const handlePlay = () => {
    const graph = getGraphSnapshot();
    const startNode = graph.nodes.find((node) => node.type === 'start') ?? graph.nodes[0];
    if (!startNode) return;
    reset();
    startRuntimeSession(graph, { entryNodeId: startNode.id });
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
    setIsExportMenuOpen(false);
    if (!window.openfmv?.exportGame || !window.openfmv?.selectDirectory) {
      showExportStatus(t('desktopExportRequired'));
      alert(t('desktopExportRequiredDetail'));
      return;
    }

    showExportStatus(t('exporting'));
    setIsExporting(true);
    try {
      const savedProject = await saveNow();
      if (!savedProject) return;
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
          <div className="flex h-openfmv-control min-w-0 items-center gap-2 rounded-openfmv-pill border border-white/10 bg-white/[0.075] px-3 shadow-[0_10px_28px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
            <div className="h-6 w-6 shrink-0 rounded-openfmv-pill bg-[radial-gradient(circle_at_30%_24%,#fff7ad,transparent_31%),radial-gradient(circle_at_66%_25%,#7dd3fc,transparent_34%),radial-gradient(circle_at_42%_70%,#c084fc,transparent_38%),linear-gradient(135deg,#f97316,#14b8a6)] shadow-[0_0_16px_rgba(125,211,252,0.18)]" />
            <Input type="text" value={title} onChange={(event) => setTitle(event.target.value)} className="h-auto w-32 min-w-0 border-0 bg-transparent px-0 py-0 text-sm font-semibold tracking-normal text-white shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 md:w-56" />
            <div className="h-5 w-px shrink-0 bg-white/10" />
            <div className="flex h-openfmv-tool w-openfmv-tool shrink-0 items-center justify-center rounded-openfmv-tool bg-black/20" title={lastSaved ? t('lastSaved', { time: lastSaved.toLocaleTimeString() }) : t('autoSaveEnabled')} suppressHydrationWarning>
              <SaveStatusIcon size={14} className={`${saveStatus.className} ${saveStatus.spin ? 'animate-spin' : ''}`} />
            </div>
          </div>
        </div>

        <nav className="pointer-events-auto flex h-openfmv-control items-center gap-1 rounded-openfmv-pill border border-white/10 bg-white/[0.075] p-1 shadow-[0_10px_28px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
          <Link href={blueprintHref} onClick={flushProjectSession} className={`inline-flex h-openfmv-tool min-w-[94px] items-center justify-center gap-1.5 rounded-openfmv-pill px-3 text-xs font-bold transition ${isNodeMode ? 'text-openfmv-sub hover:bg-white/[0.08] hover:text-white' : 'bg-white/[0.18] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'}`} title={t('blueprintMode')}>
            <GitBranch size={13} />
            <span className="hidden sm:inline">{t('blueprintMode')}</span>
          </Link>
          <Link href={nodesHref} onClick={flushProjectSession} className={`inline-flex h-openfmv-tool min-w-[88px] items-center justify-center gap-1.5 rounded-openfmv-pill px-3 text-xs font-bold transition ${isNodeMode ? 'bg-white/[0.18] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]' : 'text-openfmv-sub hover:bg-white/[0.08] hover:text-white'}`} title={t('nodeMode')}>
            <Film size={13} />
            <span className="hidden sm:inline">{t('nodeMode')}</span>
          </Link>
        </nav>

        <div className="pointer-events-auto flex min-w-0 items-center justify-end">
          <div className="flex h-openfmv-control items-center gap-1 rounded-openfmv-pill border border-white/10 bg-white/[0.075] p-1 shadow-[0_10px_28px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
            <div className="relative" ref={settingsRef}>
              <Button onClick={() => setIsSettingsOpen((value) => !value)} variant="icon" size="compactIcon" className={`border-0 bg-transparent shadow-none ${isSettingsOpen ? 'text-openfmv-accent' : 'text-openfmv-sub'}`} title={t('settings')}>
                <Settings2 size={15} />
              </Button>

              {isSettingsOpen && (
                <div className="absolute right-0 top-full z-50 mt-3 w-72 overflow-hidden rounded-openfmv-panel border border-white/15 bg-[#15171c]/95 p-1.5 shadow-[0_24px_80px_rgba(0,0,0,0.56)] ring-1 ring-black/40 backdrop-blur-xl">
                  <div className="px-3 py-3">
                    <button type="button" role="switch" aria-checked={autoSaveEnabled} onClick={() => setAutoSaveEnabled(!autoSaveEnabled)} className="flex h-openfmv-editor w-full items-center justify-between gap-3 rounded-openfmv-control border border-white/15 bg-white/[0.075] px-3 text-left transition hover:border-white/25 hover:bg-white/[0.10]" title={autoSaveEnabled ? t('pauseAutoSave') : t('enableAutoSave')}>
                      <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-openfmv-text">
                        <span className="truncate">{t('autoSave')}</span>
                        <SaveStatusIcon size={13} className={`shrink-0 ${saveStatus.className} ${saveStatus.spin ? 'animate-spin' : ''}`} />
                      </span>
                      <span aria-hidden="true" className={`flex h-6 w-11 shrink-0 items-center rounded-openfmv-pill border p-0.5 transition ${autoSaveEnabled ? 'border-emerald-300/40 bg-emerald-400/25' : 'border-white/15 bg-white/[0.08]'}`}>
                        <span className={`h-5 w-5 rounded-openfmv-pill bg-white shadow-[0_3px_10px_rgba(0,0,0,0.35)] transition-transform ${autoSaveEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                      </span>
                    </button>
                  </div>

                  <div className="border-t border-white/[0.08] px-3 py-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-openfmv-muted">{t('edgeStyle')}</div>
                    <Select value={edgeCurveStyle} onValueChange={(value) => setEdgeCurveStyle(value as 'smoothstep' | 'bezier' | 'straight')}>
                      <SelectTrigger className="nodrag h-openfmv-editor rounded-openfmv-control border-white/15 bg-white/[0.075] text-sm text-openfmv-text">
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

            <Button onClick={handlePlay} size="pill" className="h-openfmv-tool bg-white/[0.16] px-3 text-xs font-bold text-white shadow-none hover:bg-white/[0.22]">
              <Play size={13} fill="currentColor" />
              <span className="hidden sm:inline">{t('preview')}</span>
            </Button>

            <div className="relative" ref={exportMenuRef}>
              <Button
                onClick={() => setIsExportMenuOpen((value) => !value)}
                disabled={isExporting}
                variant="outline"
                size="pill"
                aria-haspopup="menu"
                aria-expanded={isExportMenuOpen}
                className="h-openfmv-tool rounded-openfmv-control border-0 bg-transparent px-2.5 text-xs font-bold text-openfmv-sub shadow-none hover:bg-white/[0.10] hover:text-white"
              >
                {isExporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                <span className="hidden sm:inline">{t('export')}</span>
                <ChevronDown size={12} className={`transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
              </Button>

              {isExportMenuOpen && (
                <div role="menu" className="absolute right-0 top-full z-50 mt-3 w-64 overflow-hidden rounded-openfmv-panel border border-white/15 bg-[#15171c]/95 p-1.5 shadow-[0_24px_80px_rgba(0,0,0,0.56)] ring-1 ring-black/40 backdrop-blur-xl">
                  <button type="button" role="menuitem" onClick={() => void handleExport()} className="flex h-openfmv-control w-full items-center gap-2.5 rounded-openfmv-control px-2.5 text-left text-sm font-semibold text-openfmv-text transition hover:bg-white/[0.075] hover:text-white">
                    <Globe2 size={15} />
                    <span className="min-w-0 flex-1 truncate">{t('exportWebPackage')}</span>
                  </button>
                  <div className="my-1 h-px bg-white/[0.08]" />
                  <button type="button" role="menuitem" disabled className="flex h-openfmv-control w-full cursor-not-allowed items-center gap-2.5 rounded-openfmv-control px-2.5 text-left text-sm font-semibold text-openfmv-muted opacity-55">
                    <MonitorDown size={15} />
                    <span className="min-w-0 flex-1 truncate">{t('exportExecutablePackage')}</span>
                    <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-normal text-openfmv-muted">{t('exportDisabled')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          {exportStatus && (
            <div className="absolute right-4 top-[58px] z-50 max-w-[360px] truncate rounded-openfmv-control border border-emerald-300/20 bg-black/72 px-3 py-2 text-xs font-medium text-emerald-100 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-2xl" title={exportStatus}>
              {exportStatus}
            </div>
          )}
        </div>
      </div>
    </Header>
  );
}
