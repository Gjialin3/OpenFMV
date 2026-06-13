'use client';

import React, { DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Bot, FileText, History, ImageIcon, Loader2, Music, PanelTop, Paperclip, Plus, Send, Video, X } from 'lucide-react';

import { OpenFMVAgentInfo, OpenFMVAiConfig, OpenFMVChatAttachment, OpenFMVChatMessage } from '@/app/_types';
import { detectOpenFMVAiAgents, getDefaultOpenFMVAiConfig, getOpenFMVAiConfig, openfmvAgentDefinitions, sendOpenFMVChatMessage } from '@/app/_utils/aiSettings';
import AgentIcon from './AgentIcon';

interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: OpenFMVChatMessage[];
}

interface ReferenceFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content?: string;
  truncated?: boolean;
}

interface InteractionDesignViewProps {
  variant?: 'page' | 'panel';
  floating?: boolean;
  onToggleFloating?: () => void;
  onClose?: () => void;
}

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const createThread = (title: string): ChatThread => {
  const now = new Date().toISOString();
  return {
    id: createId(),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
};

const createTitle = (content: string, fallbackTitle: string) => {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) return fallbackTitle;
  return normalized.length > 18 ? `${normalized.slice(0, 18)}...` : normalized;
};

const formatTime = (value: string, locale: string, justNow: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return justNow;
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
};

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const isDefaultCliModel = (model: string) => model === 'default';

const TEXT_ATTACHMENT_MAX_BYTES = 128 * 1024;
const TEXT_ATTACHMENT_MAX_CHARS = 12000;
const TEXT_ATTACHMENT_EXTENSIONS = new Set([
  '.c',
  '.cpp',
  '.cs',
  '.css',
  '.csv',
  '.go',
  '.h',
  '.hpp',
  '.html',
  '.java',
  '.js',
  '.json',
  '.jsx',
  '.kt',
  '.log',
  '.md',
  '.markdown',
  '.php',
  '.ps1',
  '.py',
  '.rb',
  '.rs',
  '.scss',
  '.sh',
  '.sql',
  '.srt',
  '.svg',
  '.swift',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.vtt',
  '.xml',
  '.yaml',
  '.yml',
]);

const getFileExtension = (name: string) => {
  const dotIndex = name.lastIndexOf('.');
  return dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : '';
};

const canReadTextAttachment = (file: File) => {
  const type = file.type.toLowerCase();
  if (type.startsWith('text/')) return true;
  if (['application/json', 'application/javascript', 'application/typescript', 'application/xml', 'image/svg+xml'].includes(type)) return true;
  return TEXT_ATTACHMENT_EXTENSIONS.has(getFileExtension(file.name));
};

const createReferenceFile = async (file: File, fallbackType: string): Promise<ReferenceFile> => {
  let content: string | undefined;
  let truncated = false;
  if (canReadTextAttachment(file)) {
    try {
      const rawContent = await file.slice(0, TEXT_ATTACHMENT_MAX_BYTES).text();
      content = rawContent.slice(0, TEXT_ATTACHMENT_MAX_CHARS);
      truncated = file.size > TEXT_ATTACHMENT_MAX_BYTES || rawContent.length > TEXT_ATTACHMENT_MAX_CHARS;
    } catch {
      content = undefined;
    }
  }
  return {
    id: createId(),
    name: file.name,
    type: file.type || fallbackType,
    size: file.size,
    content,
    truncated,
  };
};

const getReferenceIcon = (file: Pick<ReferenceFile, 'name' | 'type'>) => {
  const type = file.type.toLowerCase();
  if (type.startsWith('image/')) return ImageIcon;
  if (type.startsWith('video/')) return Video;
  if (type.startsWith('audio/')) return Music;
  if (type.startsWith('text/') || TEXT_ATTACHMENT_EXTENSIONS.has(getFileExtension(file.name))) return FileText;
  return Paperclip;
};

const toChatAttachment = ({ name, type, size, content, truncated }: ReferenceFile): OpenFMVChatAttachment => ({
  name,
  type,
  size,
  content,
  truncated,
});

export default function InteractionDesignView({ variant = 'page', floating = false, onToggleFloating, onClose }: InteractionDesignViewProps) {
  const t = useTranslations('chat');
  const settingsT = useTranslations('settings');
  const locale = useLocale();
  const isPanel = variant === 'panel';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [threads, setThreads] = useState<ChatThread[]>(() => [createThread(t('creativeAssistant'))]);
  const [activeThreadId, setActiveThreadId] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState('');
  const [references, setReferences] = useState<ReferenceFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [config, setConfig] = useState<OpenFMVAiConfig>(() => getDefaultOpenFMVAiConfig());
  const [agents, setAgents] = useState<OpenFMVAgentInfo[]>([]);

  const activeThread = threads.find((thread) => thread.id === activeThreadId) || threads[0];
  const selectedAgent = agents.find((agent) => agent.id === config.selectedCliAgentId) || openfmvAgentDefinitions.find((agent) => agent.id === config.selectedCliAgentId);
  const selectedModel = config.cliSelections.find((selection) => selection.agentId === config.selectedCliAgentId)?.model || selectedAgent?.models[0] || '';
  const selectedModelLabel = isDefaultCliModel(selectedModel) ? t('defaultModel') : selectedModel;
  const sortedThreads = useMemo(() => [...threads].sort((first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()), [threads]);
  const suggestions = useMemo(() => ['suggestionClarify', 'suggestionBranch', 'suggestionCapabilities'].map((key) => t(key)), [t]);

  useEffect(() => {
    setActiveThreadId((current) => current || threads[0]?.id || '');
  }, [threads]);

  useEffect(() => {
    let mounted = true;
    const loadAiState = async () => {
      const [loadedConfig, detectedAgents] = await Promise.all([getOpenFMVAiConfig(), detectOpenFMVAiAgents()]);
      if (!mounted) return;
      setConfig(loadedConfig);
      setAgents(detectedAgents);
    };
    const handleSettingsChanged = () => {
      void loadAiState();
    };
    void loadAiState();
    window.addEventListener('openfmv-ai-settings-changed', handleSettingsChanged);
    return () => {
      mounted = false;
      window.removeEventListener('openfmv-ai-settings-changed', handleSettingsChanged);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [activeThread?.messages.length, isSending]);

  const updateActiveThread = (updater: (thread: ChatThread) => ChatThread) => {
    setThreads((current) => current.map((thread) => thread.id === activeThread.id ? updater(thread) : thread));
  };

  const startThread = () => {
    const thread = createThread(t('newChat'));
    setThreads((current) => [thread, ...current]);
    setActiveThreadId(thread.id);
    setShowHistory(false);
    setInput('');
    setReferences([]);
  };

  const selectThread = (threadId: string) => {
    setActiveThreadId(threadId);
    setShowHistory(false);
  };

  const addFiles = async (files: FileList | File[]) => {
    const nextFiles = await Promise.all(Array.from(files).map((file) => createReferenceFile(file, t('file'))));
    setReferences((current) => [...current, ...nextFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files.length > 0) void addFiles(event.dataTransfer.files);
  };

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || isSending) return;

    const attachments = references.map(toChatAttachment);
    const userMessage: OpenFMVChatMessage = { role: 'user', content, ...(attachments.length ? { attachments } : {}) };
    const nextMessages = [...activeThread.messages, userMessage];
    const now = new Date().toISOString();

    updateActiveThread((thread) => ({
      ...thread,
      title: thread.messages.length ? thread.title : createTitle(content, t('newChat')),
      updatedAt: now,
      messages: nextMessages,
    }));
    setInput('');
    setReferences([]);
    setIsSending(true);

    try {
      const response = await sendOpenFMVChatMessage({ messages: nextMessages });
      const assistantMessage: OpenFMVChatMessage = {
        role: 'assistant',
        content: response.ok ? response.content : response.error || t('emptyAiResponse'),
      };
      updateActiveThread((thread) => ({
        ...thread,
        updatedAt: new Date().toISOString(),
        messages: [...thread.messages, assistantMessage],
      }));
      setConfig(await getOpenFMVAiConfig());
    } catch (error) {
      console.error('聊天失败:', error);
      updateActiveThread((thread) => ({
        ...thread,
        updatedAt: new Date().toISOString(),
        messages: [...thread.messages, { role: 'assistant', content: t('chatFailed') }],
      }));
    } finally {
      setIsSending(false);
    }
  };

  const historyList = (
    <aside className={isPanel ? 'absolute left-3 right-3 top-12 z-30 max-h-[420px] overflow-hidden rounded-[8px] border border-white/[0.10] bg-[#151619] shadow-[0_16px_48px_rgba(0,0,0,0.34)]' : 'flex w-[300px] shrink-0 flex-col border-r border-white/8 bg-[#202020]'}>
      <div className={`${isPanel ? 'h-9 px-2.5' : 'h-12 px-4'} flex items-center justify-between border-b border-white/8`}>
        <div className={`${isPanel ? 'text-[11px] font-semibold uppercase tracking-[0.08em] text-openfmv-muted' : 'text-sm font-semibold text-white'}`}>{t('history')}</div>
        <button type="button" onClick={startThread} className={`${isPanel ? 'h-7 w-7 rounded-[7px]' : 'h-7 w-7 rounded-[8px]'} grid place-items-center text-openfmv-sub transition hover:bg-white/[0.08] hover:text-white`} title={t('newChat')}>
          <Plus size={16} />
        </button>
      </div>
      <div className={isPanel ? 'max-h-[380px] overflow-y-auto p-1.5' : 'min-h-0 flex-1 overflow-y-auto p-3'}>
        {sortedThreads.map((thread) => {
          const isActive = thread.id === activeThread.id;
          const lastMessage = thread.messages.at(-1)?.content || t('noMessages');
          return (
            <button key={thread.id} type="button" onClick={() => selectThread(thread.id)} className={`${isPanel ? 'mb-0.5 rounded-[7px] border px-2.5 py-2' : 'mb-2 rounded-[12px] border p-3'} block w-full text-left transition ${isActive ? 'border-white/[0.12] bg-white/[0.08]' : `${isPanel ? 'border-transparent bg-transparent' : 'border-white/8 bg-white/[0.035]'} hover:bg-white/[0.055]`}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-semibold text-white">{thread.title}</span>
                <span className="shrink-0 text-xs text-openfmv-muted">{formatTime(thread.updatedAt, locale, t('justNow'))}</span>
              </div>
              <div className={`${isPanel ? 'line-clamp-1' : 'line-clamp-2'} mt-1 text-xs leading-5 text-openfmv-muted`}>{lastMessage}</div>
            </button>
          );
        })}
      </div>
      {!isPanel && (
        <div className="border-t border-white/8 p-3">
          <div className="flex items-center gap-3 rounded-[12px] border border-white/10 bg-white/[0.045] p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-white/[0.08]">
              {selectedAgent?.id ? <AgentIcon id={selectedAgent.id} size={22} /> : <Bot size={19} />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">{selectedAgent?.name || t('localAi')}</span>
              <span className="mt-0.5 block truncate text-xs text-openfmv-muted">{selectedModelLabel || t('noModelSelected')}</span>
            </span>
          </div>
        </div>
      )}
    </aside>
  );

  return (
    <div className={isPanel ? 'relative flex h-full w-full overflow-hidden bg-[#111113] text-white' : 'mx-auto flex h-[calc(100dvh-9rem)] max-w-[1500px] overflow-hidden rounded-[14px] border border-white/8 bg-[#1b1b1b] text-white shadow-[0_28px_100px_rgba(0,0,0,0.2)]'}>
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => { if (event.target.files) void addFiles(event.target.files); }} />

      {!isPanel && historyList}
      {isPanel && showHistory ? historyList : null}

      <section className={`flex min-w-0 flex-1 flex-col ${isPanel ? 'bg-[#111113]' : 'bg-[#181818]'}`}>
        <header data-chat-drag-handle={isPanel ? true : undefined} className={`flex shrink-0 items-center justify-between ${isPanel ? 'h-11 cursor-move border-b border-white/[0.08] px-3' : 'h-14 border-b border-white/8 px-6'}`}>
          {isPanel ? (
            <div className="flex flex-1 justify-end gap-1">
              <button type="button" onClick={() => setShowHistory((current) => !current)} className={`grid h-7 w-7 place-items-center rounded-[7px] transition hover:bg-white/[0.08] hover:text-white ${showHistory ? 'bg-white/[0.08] text-white' : 'text-white/[0.62]'}`} title={t('history')}>
                <History size={17} />
              </button>
              <button type="button" onClick={onToggleFloating} className={`grid h-7 w-7 place-items-center rounded-[7px] transition hover:bg-white/[0.08] hover:text-white ${floating ? 'bg-white/[0.08] text-white' : 'text-white/[0.62]'}`} title={floating ? t('dockWindow') : t('floatWindow')}>
                <PanelTop size={17} />
              </button>
              <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-[7px] text-white/[0.62] transition hover:bg-white/[0.08] hover:text-white" title={settingsT('close')}>
                <X size={17} />
              </button>
            </div>
          ) : (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{activeThread.title}</div>
              <div className="mt-0.5 truncate text-xs text-openfmv-muted">{t('chattingWith', { agent: selectedAgent?.name || t('localAi'), model: selectedModelLabel || t('defaultModel') })}</div>
            </div>
          )}
        </header>

        <div ref={scrollRef} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} className={`min-h-0 flex-1 overflow-y-auto ${isPanel ? 'px-4 py-3' : 'px-6 py-6'} ${isDragging ? 'outline outline-2 outline-white/[0.18]' : ''}`}>
          {activeThread.messages.length ? (
            <div className={isPanel ? 'flex w-full flex-col gap-3' : 'mx-auto flex max-w-4xl flex-col gap-5'}>
              {activeThread.messages.map((message, index) => {
                const isUser = message.role === 'user';
                const messageClassName = isPanel
                  ? isUser
                    ? 'max-w-[88%] rounded-[10px] border border-white/[0.08] bg-[#202124] px-3.5 py-2.5 text-sm leading-6 text-white/[0.92] shadow-none'
                    : 'w-full rounded-[10px] border border-transparent bg-transparent px-1 py-1 text-sm leading-6 text-white/[0.86] shadow-none'
                  : `max-w-[78%] rounded-[16px] px-4 py-3 text-sm leading-7 shadow-[0_12px_40px_rgba(0,0,0,0.18)] ${isUser ? 'bg-openfmv-accent text-white' : 'border border-white/10 bg-white/[0.06] text-white/[0.88]'}`;
                return (
                  <div key={`${message.role}-${index}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={messageClassName}>
                      <div className="whitespace-pre-wrap break-words">{message.content}</div>
                      {message.attachments?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {message.attachments.map((file, fileIndex) => {
                            const ReferenceIcon = getReferenceIcon(file);
                            return (
                              <span key={`${file.name}-${file.size}-${fileIndex}`} className="inline-flex max-w-full items-center gap-1.5 rounded-[7px] border border-white/[0.10] bg-white/[0.07] px-2 py-1 text-[11px] leading-4 text-white/[0.72]">
                                <ReferenceIcon size={12} className="shrink-0" />
                                <span className="truncate">{file.name}</span>
                              </span>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {isSending ? (
                <div className="flex justify-start">
                  <div className={`${isPanel ? 'rounded-[10px] bg-transparent px-1 py-2 text-sm' : 'rounded-[16px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm'} inline-flex items-center gap-2 text-openfmv-sub`}>
                    <Loader2 size={15} className="animate-spin" />
                    {t('aiReplying')}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className={isPanel ? 'flex h-full items-end pb-40' : 'grid h-full place-items-center'}>
              <div className={isPanel ? 'w-full text-left' : 'text-center'}>
                {!isPanel && (
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-[16px] border border-white/10 bg-white/[0.06] text-openfmv-sub">
                    <Bot size={24} />
                  </div>
                )}
                {isPanel ? (
                  <>
                    <div className="text-[28px] font-bold leading-tight text-[#b8d3ff]">{t('hello')}</div>
                    <div className="mt-1 text-[24px] font-bold leading-tight text-white/[0.82]">{t('prompt')}</div>
                    <div className="mt-8 flex flex-col items-start gap-3">
                      {suggestions.map((item) => (
                        <button key={item} type="button" onClick={() => setInput(item)} className="rounded-full bg-white/[0.045] px-4 py-2 text-left text-sm font-semibold text-white/[0.42] transition hover:bg-white/[0.08] hover:text-white/[0.75]">
                          {item}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-4 text-lg font-semibold text-white">{t('startChat')}</div>
                    <div className="mt-2 text-sm text-openfmv-muted">{t('startChatDescription')}</div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={`shrink-0 ${isPanel ? 'border-t border-white/[0.08] bg-[#111113] p-3' : 'border-t border-white/8 bg-[#1d1d1d] p-4'}`}>
          <div className={isPanel ? 'w-full' : 'mx-auto max-w-4xl'}>
            <div onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} className={`${isPanel ? 'rounded-[12px] bg-[#17181b] p-2' : 'rounded-[16px] bg-white/[0.055] p-3'} border border-white/10 transition ${isDragging ? 'border-white/[0.22] bg-white/[0.065]' : ''}`}>
              {references.length ? (
                <div className="mb-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto px-1">
                  {references.map((file) => {
                    const ReferenceIcon = getReferenceIcon(file);
                    return (
                      <span key={file.id} title={`${file.name} · ${formatFileSize(file.size)}`} className="inline-flex max-w-full items-center gap-1.5 rounded-[8px] border border-white/[0.10] bg-white/[0.055] px-2 py-1.5 text-xs leading-4 text-openfmv-sub">
                        <ReferenceIcon size={13} className="shrink-0 text-white/[0.52]" />
                        <span className="max-w-[220px] truncate">{file.name}</span>
                        <span className="shrink-0 text-openfmv-muted">{formatFileSize(file.size)}</span>
                        <button type="button" onClick={() => setReferences((current) => current.filter((item) => item.id !== file.id))} className="grid h-5 w-5 shrink-0 place-items-center rounded-[5px] text-openfmv-muted transition hover:bg-white/[0.08] hover:text-white" title={t('removeAttachment')}>
                          <X size={12} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : null}

              <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void sendMessage(); }} className={`${isPanel ? 'min-h-[56px] px-2 pb-1 pt-2' : 'min-h-[72px] px-2 pb-2 pt-1'} max-h-40 w-full resize-none bg-transparent text-sm leading-6 text-white outline-none placeholder:text-openfmv-muted`} placeholder={t('inputPlaceholder')} />

              <div className="mt-1 flex items-center justify-between gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()} className={`${isPanel ? 'h-8 w-8 rounded-[8px]' : 'h-9 w-9 rounded-[10px]'} grid shrink-0 place-items-center text-openfmv-sub transition hover:bg-white/[0.08] hover:text-white`} title={t('addAttachment')}>
                  <Paperclip size={isPanel ? 17 : 18} />
                </button>
                <button type="button" onClick={() => void sendMessage()} disabled={!input.trim() || isSending} className={isPanel ? 'grid h-8 w-8 shrink-0 place-items-center rounded-[8px] border border-white/[0.10] bg-white/[0.08] px-0 text-sm font-semibold text-white/[0.82] transition hover:bg-white/[0.13] hover:text-white disabled:cursor-not-allowed disabled:opacity-45' : 'inline-flex h-9 shrink-0 items-center gap-2 rounded-[10px] bg-openfmv-accent px-3 text-sm font-semibold text-white transition hover:bg-openfmv-accent-hover disabled:cursor-not-allowed disabled:opacity-45'}>
                  {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {!isPanel && t('send')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
