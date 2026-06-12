'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Minus, Settings, Sparkles, Square, X } from 'lucide-react';

import { getLocalizedPath } from '@/app/_utils/localePaths';

interface AppNavigationProps {
  chatOpen?: boolean;
  compact?: boolean;
  onOpenSettings?: () => void;
  onToggleChat?: () => void;
}

export default function AppNavigation({ chatOpen = false, compact = false, onOpenSettings, onToggleChat }: AppNavigationProps) {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const settingsT = useTranslations('settings');

  return (
    <header className={`relative z-[100] flex shrink-0 items-center justify-between bg-[#181818] [-webkit-app-region:drag] ${compact ? 'h-10 px-3' : 'h-14 px-7'}`}>
      <Link href={getLocalizedPath(locale, '/projects')} className="flex min-w-0 items-center gap-3 text-white/70 transition hover:text-white [-webkit-app-region:no-drag]">
        <img src="/logo.png" alt="OpenFMV" className={`shrink-0 object-cover ${compact ? 'h-7 w-7 rounded-[8px]' : 'h-8 w-8 rounded-[9px]'}`} />
        <span className={`truncate font-semibold ${compact ? 'text-sm' : 'text-base'}`}>OpenFMV</span>
      </Link>

      <div className={`flex min-w-0 items-center [-webkit-app-region:no-drag] ${compact ? 'gap-2' : 'gap-3'}`}>
        <button type="button" onClick={onToggleChat} className={`inline-flex items-center gap-2 rounded-[10px] font-semibold transition ${compact ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm'} ${chatOpen ? 'bg-white/[0.17] text-white' : 'bg-white/[0.09] text-white/86 hover:bg-white/[0.14] hover:text-white'}`} title={t('askAi')}>
          <Sparkles size={compact ? 14 : 16} className="text-cyan-300" />
          <span>{t('askAi')}</span>
        </button>
        <button type="button" onClick={onOpenSettings} className={`flex items-center justify-center rounded-[10px] text-white/75 transition hover:bg-white/[0.08] hover:text-white ${compact ? 'h-7 w-7' : 'h-8 w-8'}`} title={settingsT('open')}>
          <Settings size={compact ? 14 : 16} />
        </button>
        <span aria-hidden="true" className={`select-none leading-none text-white/30 ${compact ? 'text-base' : 'text-lg'}`}>|</span>
        <button type="button" onClick={() => void window.openfmv?.minimizeWindow?.()} className={`flex items-center justify-center text-white/75 transition hover:text-white ${compact ? 'h-7 w-7' : 'h-8 w-8'}`} title={t('minimize')}>
          <Minus size={17} />
        </button>
        <button type="button" onClick={() => void window.openfmv?.toggleMaximizeWindow?.()} className={`flex items-center justify-center text-white/75 transition hover:text-white ${compact ? 'h-7 w-7' : 'h-8 w-8'}`} title={t('maximize')}>
          <Square size={14} />
        </button>
        <button type="button" onClick={() => void window.openfmv?.closeWindow?.()} className={`flex items-center justify-center text-white/75 transition hover:bg-red-500 hover:text-white ${compact ? 'h-7 w-7' : 'h-8 w-8'}`} title={t('close')}>
          <X size={17} />
        </button>
      </div>
    </header>
  );
}
