# OpenFMV

<p align="center">
  <img src="./public/logo.png" alt="OpenFMV Logo" width="128" />
</p>

<p align="center">
  <mark><strong>该项目正在快速迭代，敬请期待</strong></mark>
</p>

<p align="center">
  <a href="./readme.md">English</a> · 简体中文 · <a href="./README.ja.md">日本語</a> · <a href="./README.ko.md">한국어</a>
</p>

OpenFMV 是一个本地优先的可视化非线性叙事编辑器，用于制作互动视频、分支叙事、互动短剧，以及可独立运行的桌面故事体验。

当前项目是 Next.js 16 + Electron 桌面应用。项目文件、导入素材、时间线媒体和导出内容都保存在本地，不依赖账号系统、数据库或云端存储。

![OpenFMV 编辑器总览](./public/readme/openfmv-editor-overview.png)

## 编辑模型

OpenFMV 目前有两个核心编辑界面：

- **Editor**：故事蓝图画布。负责场景节点、故事流、输出出口、连线、图结构标签和分支结构。
- **Nodes**：单个节点的多轨时间线编辑器。负责每个场景内的媒体轨道、交互轨道、片段时间、预览布局和交互动作。

媒体和交互都存储在节点的 `NodeTimeline v2` 数据里。Editor 会读取时间线里的交互输出，让用户可以在蓝图画布上直接连接分支；具体的媒体剪辑和交互细节则保留在 Nodes 页面中处理。

## 功能特性

- 可视化故事图：用开始、场景和结尾节点组织非线性叙事。
- 节点级时间线：支持媒体轨道和交互轨道。
- 本地素材库：支持视频、图片、音频和文本素材，并可在项目间复用。
- 交互片段：支持按钮、热点、暂停门、定时分支和变量动作。
- Editor 节点卡片：展示视频封面、媒体数量、交互数量和输出路径。
- 分支同步：时间线交互动作与蓝图连线保持同步。
- 固定比例预览舞台：剪辑时和预览时，媒体与按钮的相对位置保持一致。
- 即时播放预览：快速验证分支逻辑和时间线交互。
- 项目导入导出：使用本地 OpenFMV JSON 文件保存项目。
- 桌面体验导出：导出包含运行时、图数据、时间线数据和本地素材的桌面应用。
- 本地 AI 辅助：桌面端可调用本地 CLI Agent 或自行配置的模型服务。

## 界面预览

### 分支播放预览

![OpenFMV 分支播放预览](./public/readme/openfmv-play-preview.png)

### 本地项目工作台

![OpenFMV 本地项目工作台](./public/readme/openfmv-projects.png)

## 技术栈

- Next.js 16 App Router
- TypeScript
- React 19
- React Flow
- Zustand
- Tailwind CSS
- Electron
- Vitest

## 快速开始

### 环境要求

- Node.js 20 或更高版本
- npm
- Windows 是优先支持的桌面环境；Web 开发模式也可以在其他系统上运行。

### 安装依赖

```bash
npm install
```

### 启动 Web 开发服务

```bash
npm run dev
```

默认访问地址：

```text
http://localhost:3000
```

### 启动桌面端

```bash
npm run desktop:dev
```

运行构建后的 standalone 版本：

```bash
npm run build
npm run desktop:standalone
```

## 常用命令

```bash
npm run dev                 # 启动 Next.js 开发服务
npm run desktop             # 启动 Electron 桌面端
npm run desktop:dev         # 启动桌面开发模式
npm run desktop:standalone  # 启动 standalone 桌面模式
npm run build               # 构建应用
npm run package:desktop     # 打包桌面应用
npm run lint                # 运行 lint
npm run test:run            # 运行测试
```

运行单个测试文件：

```bash
npx vitest path/to/test.test.ts
```

运行单个测试用例：

```bash
npx vitest path/to/test.test.ts -t "test name"
```

## 项目结构

```text
app/
  _components/          React 组件
    nodes/              React Flow 节点组件
    editor/             编辑器 UI
    player/             播放器组件
    local/              本地桌面端 UI
    ui/                 通用 UI 组件
  _features/
    node-timeline/      NodeTimeline v2 schema、命令、吸附、播放和 UI
  _hooks/               React hooks
  _store/               Zustand stores
  _types/               共享 TypeScript 类型
  _utils/               运行时、持久化、时间线和本地项目工具
  api/                  本地 Next.js API routes
  editor/               Editor 页面
  play/[id]/            播放页面
  projects/             项目管理页面
electron/
  main.js               Electron 主进程与 IPC
  preload.js            Preload API
  exporter.js           桌面体验导出器
shared/
  runtimeCore.mjs       播放器和导出器共用运行时
scripts/                构建与打包脚本
__tests__/              单元测试
```

## 项目文件

OpenFMV 项目以 JSON 形式保存，核心字段包括：

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

导入素材会复制到本地项目或应用数据目录。导出项目或桌面体验时，相关时间线 `src` 和 `poster` 素材会复制到输出目录，让导出结果不依赖原始素材路径也能运行。

## 桌面导出

使用：

```bash
npm run package:desktop
```

构建完成后，桌面应用会输出到 `dist/`。从应用内导出的互动故事会包含运行时、项目图数据、节点时间线和素材资源，适合分发给玩家或测试者。

## 开发说明

- 项目遵循本地优先设计，不包含登录、用户同步、托管后端、数据库或云存储。
- 故事流属于 `/editor`；节点级媒体和交互属于 `/nodes`。
- 媒体片段和交互片段应存储在 `node.data.timeline`。
- 共享类型定义位于 `app/_types/index.ts`。
- 样式使用 Tailwind CSS，自定义颜色集中在 `app/globals.css`。
- React Flow 节点组件应使用 `React.memo` 包裹。

## 贡献

欢迎提交 issue 和 pull request。提交前请运行：

```bash
npm run lint
npm run test:run
```

如果改动影响桌面导出、时间线播放或图结构路由，也请手动验证编辑、保存、预览和导出路径。

## 致谢

感谢 [OpenCut](https://github.com/OpenCut-app/OpenCut) 在开放视频编辑工作流和交互设计上带来的启发。

## License

This project is open source under the MIT License. You may freely use, copy, modify, merge, publish, distribute, sublicense, and sell copies of this project, including for commercial use, provided that the original copyright notice and license text are retained in all copies or substantial portions.
