'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Clock, Plus, Trash2, X } from 'lucide-react';

import { useProjectSessionStore } from '@/app/_features/project-session/store';
import { useEditorStore } from '../../_store/useEditorStore';
import { AppNode, InteractionMode, InteractionRule } from '../../_types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';

const getNodeTitle = (node: AppNode, t: ReturnType<typeof useTranslations<'editor'>>) => {
  const data = node.data;
  if (node.type === 'start') return data.type === 'start' ? data.label || t('startNode') : t('startNode');
  if (node.type === 'end') return data.type === 'end' ? data.label || t('endNode') : t('endNode');
  if (node.type === 'interaction') return data.type === 'interaction' ? data.title || data.prompt || t('nodeTypes.interaction.name') : t('nodeTypes.interaction.name');
  return data.type === 'story' ? data.title || t('nodeTypes.story.name') : node.type;
};

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-openfmv-muted">{children}</div>
);

export default function PropertyPanel() {
  const t = useTranslations('editor');
  const nodes = useProjectSessionStore((state) => state.nodes);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useEditorStore((state) => state.setSelectedNodeId);
  const updateNodeData = useProjectSessionStore((state) => state.updateNodeData);
  const removeNode = useProjectSessionStore((state) => state.removeNode);
  const selectedNode = selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) ?? null : null;

  if (!selectedNode) return null;

  const data = selectedNode.data;
  const rules = ('rules' in data && Array.isArray(data.rules) ? data.rules : []) as InteractionRule[];
  const isInteractive = selectedNode.type === 'interaction' || selectedNode.type === 'start';

  const handleChange = (key: string, value: unknown) => {
    updateNodeData(selectedNode.id, { [key]: value } as Partial<AppNode['data']>);
  };

  const handleDelete = () => {
    if (!selectedNodeId) return;
    if (!window.confirm(t('deleteNodeConfirm'))) return;
    removeNode(selectedNodeId);
    setSelectedNodeId(null);
  };

  const handleAddRule = () => {
    const label = t('optionName', { index: rules.length + 1 });
    const nextRule: InteractionRule = {
      id: crypto.randomUUID(),
      keyword: label,
      condition: label,
      handleId: crypto.randomUUID(),
    };
    handleChange('rules', [...rules, nextRule]);
  };

  const handleUpdateRule = (id: string, value: string) => {
    handleChange('rules', rules.map((rule) => (rule.id === id ? { ...rule, keyword: value, condition: value } : rule)));
  };

  const handleRemoveRule = (id: string) => {
    handleChange('rules', rules.filter((rule) => rule.id !== id));
  };

  const storyText = data.type === 'story' || data.type === 'start' || data.type === 'end' ? data.fullText || data.content || '' : '';
  const promptText = data.type === 'interaction' || data.type === 'start' ? data.prompt || '' : '';
  const interactionMode = data.type === 'interaction' || data.type === 'start' ? data.interactionMode || 'choice' : 'choice';
  const sliderLabel = data.type === 'interaction' || data.type === 'start' ? data.sliderConfig?.label || t('sliderMode') : t('sliderMode');
  const timeLimit = data.type === 'interaction' || data.type === 'start' ? data.timeLimit || '' : '';

  return (
    <aside className="absolute right-4 top-24 z-40 flex max-h-[calc(100%-7rem)] w-[360px] flex-col overflow-hidden rounded-openfmv-panel border border-white/15 bg-white/[0.10] shadow-[0_24px_90px_rgba(0,0,0,0.44)] backdrop-blur-3xl">
      <div className="flex items-center justify-between border-b border-white/15 px-4 py-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-openfmv-muted">{selectedNode.type}</div>
          <div className="mt-1 truncate text-base font-semibold text-white">{getNodeTitle(selectedNode, t)}</div>
        </div>
        <Button onClick={() => setSelectedNodeId(null)} variant="icon" size="compactIcon">
          <X size={16} />
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <section className="space-y-3">
          <SectionTitle>{t('basicInfo')}</SectionTitle>
          <Label className="block">
            <span className="mb-1.5 block text-xs font-medium text-openfmv-sub">{t('titleLabel')}</span>
            <Input
              value={(data.type === 'start' || data.type === 'end' ? data.label : data.type === 'story' || data.type === 'interaction' ? data.title : '') || ''}
              onChange={(event) => handleChange(selectedNode.type === 'start' || selectedNode.type === 'end' ? 'label' : 'title', event.target.value)}
              className="nodrag border-white/15 bg-white/[0.055] px-4 text-white"
            />
          </Label>

          {selectedNode.type !== 'interaction' && (
            <Label className="block">
              <span className="mb-1.5 block text-xs font-medium text-openfmv-sub">{t('storyText')}</span>
              <Textarea
                value={storyText}
                onChange={(event) => handleChange('fullText', event.target.value)}
                className="nodrag nowheel min-h-32 resize-none border-white/15 bg-white/[0.055] px-4 py-3 text-white"
              />
            </Label>
          )}
        </section>

        {isInteractive && (
          <section className="space-y-3">
            <SectionTitle>{t('interaction')}</SectionTitle>
            <Label className="block">
              <span className="mb-1.5 block text-xs font-medium text-openfmv-sub">{t('promptText')}</span>
              <Textarea value={promptText} onChange={(event) => handleChange('prompt', event.target.value)} className="nodrag nowheel min-h-24 resize-none border-white/15 bg-white/[0.055] px-4 py-3 text-white" />
            </Label>

            <Label className="block">
              <span className="mb-1.5 block text-xs font-medium text-openfmv-sub">{t('interactionMode')}</span>
              <Select value={interactionMode} onValueChange={(value) => handleChange('interactionMode', value as InteractionMode)}>
                <SelectTrigger className="nodrag h-openfmv-control rounded-openfmv-control border-white/15 bg-white/[0.055] px-4 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/15 bg-openfmv-node text-openfmv-text">
                  <SelectItem value="choice">{t('choiceMode')}</SelectItem>
                  <SelectItem value="input">{t('inputMode')}</SelectItem>
                  <SelectItem value="slider">{t('sliderMode')}</SelectItem>
                </SelectContent>
              </Select>
            </Label>

            {interactionMode === 'slider' && (
              <Label className="block">
                <span className="mb-1.5 block text-xs font-medium text-openfmv-sub">{t('sliderLabel')}</span>
                <Input value={sliderLabel} onChange={(event) => handleChange('sliderConfig', { ...(data.type === 'interaction' || data.type === 'start' ? data.sliderConfig : {}), label: event.target.value })} className="nodrag border-white/15 bg-white/[0.055] px-4 text-white" />
              </Label>
            )}

            <Label className="block">
              <span className="mb-1.5 flex items-center gap-1 text-xs font-medium text-openfmv-sub">
                <Clock size={12} />
                {t('countdownSeconds')}
              </span>
              <Input type="number" min={0} value={timeLimit} onChange={(event) => handleChange('timeLimit', Number(event.target.value) || 0)} className="nodrag nowheel border-white/15 bg-white/[0.055] px-4 text-white" />
            </Label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-openfmv-sub">{t('interactionOptions')}</span>
                <Button onClick={handleAddRule} variant="outline" size="sm" className="border-white/15 bg-transparent text-openfmv-sub hover:border-openfmv-accent hover:bg-white/[0.08] hover:text-white">
                  <Plus size={12} />
                  {t('add')}
                </Button>
              </div>
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center gap-2">
                  <Input value={rule.condition || rule.keyword} onChange={(event) => handleUpdateRule(rule.id, event.target.value)} className="nodrag min-w-0 flex-1 border-white/15 bg-white/[0.055] px-4 text-xs text-white" />
                  <Button onClick={() => handleRemoveRule(rule.id)} variant="icon" size="compactIcon" className="hover:bg-red-500/10 hover:text-red-300">
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="border-t border-white/15 p-4">
        <Button onClick={handleDelete} variant="outline" className="w-full border-red-400/30 bg-red-500/5 px-3 text-sm font-semibold text-red-300 hover:bg-red-500/10 hover:text-red-200">
          <Trash2 size={14} />
          {t('deleteNode')}
        </Button>
      </div>
    </aside>
  );
}
