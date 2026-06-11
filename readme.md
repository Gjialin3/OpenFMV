# OpenFMV

<p align="center">
  <img src="./public/logo.png" alt="OpenFMV Logo" width="128" />
</p>

<p align="center">
  <mark><strong>This project is evolving quickly. Stay tuned.</strong></mark>
</p>

<p align="center">
  English · <a href="./README.zh-CN.md">简体中文</a> · <a href="./README.ja.md">日本語</a> · <a href="./README.ko.md">한국어</a>
</p>

OpenFMV is a local-first visual nonlinear storytelling editor for building interactive videos, branching narratives, interactive short dramas, and standalone desktop story experiences.

The current project is a Next.js 16 + Electron desktop app. Project files, imported assets, timeline media, and exported content are stored locally, with no account system, database, or cloud storage dependency.

![OpenFMV editor overview](./public/readme/openfmv-editor-overview.png)

## Editing Model

OpenFMV has two focused editing surfaces:

- **Editor**: the story graph canvas. It owns scene nodes, story flow, output handles, edges, graph labels, and branching structure.
- **Nodes**: the node-level multi-track editor. It owns each scene's media timeline, interaction timeline, clip timing, preview layout, and interaction actions.

Media and interactions are stored in each node's `NodeTimeline v2` data. The graph editor reads timeline interaction outputs so branches can be connected visually from the Editor page while the detailed clip work stays in Nodes.

## Features

- Visual story graph for organizing nonlinear narratives with start, scene, and ending nodes.
- Node-level timeline editor with media tracks and interaction tracks.
- Local asset library for videos, images, audio, and text assets shared across projects.
- Interactive clips such as buttons, hotspots, pause gates, timed branches, and variable actions.
- Editor nodes that show video covers, media counts, interaction counts, and output routes.
- Synchronized branch routing between timeline interaction actions and graph edges.
- Fixed-ratio preview stage so media and interaction positions stay consistent while editing and previewing.
- Instant playback preview for validating branching and timeline interactions.
- Project import/export as local OpenFMV JSON.
- Desktop game export with bundled runtime, graph data, timeline data, and local assets.
- Local AI assistance through desktop-configured CLI agents or model services.

## Screenshots

### Branching Playback Preview

![OpenFMV branching playback preview](./public/readme/openfmv-play-preview.png)

### Local Project Workspace

![OpenFMV local project workspace](./public/readme/openfmv-projects.png)

## Tech Stack

- Next.js 16 App Router
- TypeScript
- React 19
- React Flow
- Zustand
- Tailwind CSS
- Electron
- Vitest

## Quickstart

### Requirements

- Node.js 20 or later
- npm
- Windows is the primary supported desktop environment; web development mode can run on other systems.

### Install Dependencies

```bash
npm install
```

### Start the Web Development Server

```bash
npm run dev
```

Default URL:

```text
http://localhost:3000
```

### Start the Desktop App

```bash
npm run desktop:dev
```

To run the built standalone version:

```bash
npm run build
npm run desktop:standalone
```

## Common Commands

```bash
npm run dev                 # Start the Next.js development server
npm run desktop             # Start the Electron desktop app
npm run desktop:dev         # Start desktop development mode
npm run desktop:standalone  # Start standalone desktop mode
npm run build               # Build the app
npm run package:desktop     # Package the desktop app
npm run lint                # Run lint
npm run test:run            # Run tests
```

Run a single test file:

```bash
npx vitest path/to/test.test.ts
```

Run a single named test:

```bash
npx vitest path/to/test.test.ts -t "test name"
```

## Project Structure

```text
app/
  _components/          React components
    nodes/              React Flow node components
    editor/             Editor UI
    player/             Player components
    local/              Local desktop UI
    ui/                 Shared UI components
  _features/
    node-timeline/      NodeTimeline v2 schema, commands, snapping, playback, and UI
  _hooks/               React hooks
  _store/               Zustand stores
  _types/               Shared TypeScript types
  _utils/               Runtime, persistence, timeline, and local project utilities
  api/                  Local Next.js API routes
  editor/               Editor page
  play/[id]/            Player page
  projects/             Project management page
electron/
  main.js               Electron main process and IPC
  preload.js            Preload API
  exporter.js           Desktop experience exporter
shared/
  runtimeCore.mjs       Shared runtime used by player and exporter
scripts/                Build and packaging scripts
__tests__/              Unit tests
```

## Project Files

OpenFMV projects are saved as JSON. Core fields include:

```text
schemaVersion
id
title
graphData
assets
metadata
createdAt
updatedAt
```

Imported assets are copied into the local project or app data directory. When exporting a project or desktop experience, related timeline `src` and `poster` assets are copied into the output directory so the result can run without relying on the original asset paths.

In the installed Electron app on Windows, OpenFMV keeps its local workspace under:

```text
%APPDATA%\openfmv-client
```

Native file imports are first copied into:

```text
%APPDATA%\openfmv-client\assets
```

When a project is saved, project-owned copies are written under:

```text
%APPDATA%\openfmv-client\projects\<project-title>\assets
%APPDATA%\openfmv-client\projects\<project-title>\project.openfmv.json
```

Project asset folders are grouped by media type, for example `assets\videos`, `assets\images`, and `assets\files`. Original source files are copied, not moved.

## Desktop Export

Use:

```bash
npm run package:desktop
```

After the build completes, desktop distribution files are output to `dist/`:

```text
dist\OpenFMV-win32-x64\OpenFMV.exe
dist\OpenFMV-win32-x64.zip
dist\installers\OpenFMV-Setup-<version>.exe
```

The installer version comes from `package.json`; for example, version `0.0.1` produces `OpenFMV-Setup-0.0.1.exe`.

The Windows installer copies the app to:

```text
%LOCALAPPDATA%\OpenFMV\app
```

It also creates Start Menu and desktop shortcuts named `OpenFMV`. After installation, launch OpenFMV from the shortcut instead of re-running the setup executable.

Interactive stories exported from the app include the runtime, project graph data, node timelines, and asset resources, making them suitable for distribution to players or testers.

## Development Notes

- The project follows a local-first design and does not include login, user sync, hosted backends, databases, or cloud storage.
- Story flow belongs in `/editor`; node-level media and interactions belong in `/nodes`.
- Media clips and interaction clips should be stored in `node.data.timeline`.
- Shared type definitions live in `app/_types/index.ts`.
- Styling uses Tailwind CSS, with custom colors centralized in `app/globals.css`.
- React Flow node components should be wrapped with `React.memo`.

## Contributing

Issues and pull requests are welcome. Before submitting, run:

```bash
npm run lint
npm run test:run
```

If your change affects desktop export, timeline playback, or graph routing, also manually verify editing, saving, previewing, and export paths.

## Acknowledgements

Thanks to [OpenCut](https://github.com/OpenCut-app/OpenCut) for inspiration around open video editing workflows and interaction design.

## License

This project is open source under the MIT License. You may freely use, copy, modify, merge, publish, distribute, sublicense, and sell copies of this project, including for commercial use, provided that the original copyright notice and license text are retained in all copies or substantial portions.
