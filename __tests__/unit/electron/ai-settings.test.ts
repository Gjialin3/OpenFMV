import { mkdtemp, rm } from 'node:fs/promises';
import { basename, delimiter, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

const { agentDefinitions, getDefaultAiConfig, readAiConfig, registerAiSettingsIpc, saveAiConfig, sendChatMessage } = require('../../../electron/ai-settings');

describe('electron AI settings handlers', () => {
  it('returns default config when the settings file does not exist', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'openfmv-ai-settings-'));
    const app = { getPath: () => dir };

    try {
      await expect(readAiConfig(app)).resolves.toEqual(getDefaultAiConfig());
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('registers an IPC handler that returns default config when no settings file exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'openfmv-ai-settings-ipc-'));
    const app = { getPath: () => dir };
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipcMain = {
      handle: (channel: string, handler: (...args: unknown[]) => unknown) => handlers.set(channel, handler),
    };

    try {
      registerAiSettingsIpc({ ipcMain, app });
      await expect(handlers.get('openfmv:get-ai-config')?.()).resolves.toEqual(getDefaultAiConfig());
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('normalizes saved config and drops unknown ids', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'openfmv-ai-settings-'));
    const app = { getPath: () => dir };

    try {
      const saved = await saveAiConfig(app, {
        selectedCliAgentId: 'ghost',
        byokProviders: [
          { providerId: 'anthropic', apiKey: 'key', baseUrl: 'https://api.test', model: 'claude-test' },
          { providerId: 'ghost', apiKey: 'ghost', baseUrl: 'https://ghost.test', model: 'ghost' },
        ],
      });

      expect(saved.selectedCliAgentId).toBe('codex');
      expect(saved.byokProviders.find((item: { providerId: string }) => item.providerId === 'anthropic')?.apiKey).toBe('key');
      expect(saved.byokProviders.some((item: { providerId: string }) => item.providerId === 'ghost')).toBe(false);
      await expect(readAiConfig(app)).resolves.toEqual(saved);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('allows Codex chat calls from the Electron working directory', () => {
    const codex = agentDefinitions.find((agent: { id: string }) => agent.id === 'codex');
    const args = codex.chatArgs({ model: 'default', reasoningEffort: 'default', outputPath: 'answer.txt' });

    expect(args).toContain('--skip-git-repo-check');
    expect(args).not.toContain('--model');
    expect(args).not.toContain('model_reasoning_effort="default"');
  });

  it('passes explicit Codex model and reasoning choices when configured', () => {
    const codex = agentDefinitions.find((agent: { id: string }) => agent.id === 'codex');
    const args = codex.chatArgs({ model: 'gpt-5.5', reasoningEffort: 'high', outputPath: 'answer.txt' });

    expect(args).toEqual(expect.arrayContaining(['--model', 'gpt-5.5', '-c', 'model_reasoning_effort="high"']));
  });

  it('includes text attachment excerpts in the chat prompt', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'openfmv-ai-chat-'));
    const app = { getPath: () => dir };
    const codex = agentDefinitions.find((agent: { id: string }) => agent.id === 'codex');
    const original = {
      bin: codex.bin,
      chatArgs: codex.chatArgs,
      stdinPrompt: codex.stdinPrompt,
      useOutputLastMessage: codex.useOutputLastMessage,
      path: process.env.PATH,
    };

    try {
      process.env.PATH = `${dirname(process.execPath)}${delimiter}${process.env.PATH || ''}`;
      codex.bin = basename(process.execPath);
      codex.stdinPrompt = false;
      codex.useOutputLastMessage = false;
      codex.chatArgs = ({ prompt }: { prompt: string }) => ['-e', 'process.stdout.write(process.argv[1])', prompt];

      const result = await sendChatMessage(app, {
        messages: [{
          role: 'user',
          content: 'Summarize this.',
          attachments: [{ name: 'notes.md', type: 'text/markdown', size: 42, content: '# Scene notes', truncated: false }],
        }],
      });

      expect(result.ok).toBe(true);
      expect(result.content).toContain('Summarize this.');
      expect(result.content).toContain('Attachments:');
      expect(result.content).toContain('<attachment name="notes.md">');
      expect(result.content).toContain('# Scene notes');
    } finally {
      codex.bin = original.bin;
      codex.chatArgs = original.chatArgs;
      codex.stdinPrompt = original.stdinPrompt;
      codex.useOutputLastMessage = original.useOutputLastMessage;
      process.env.PATH = original.path;
      await rm(dir, { recursive: true, force: true });
    }
  });
});
