# Echo V3.1

一个面向个人成长、关系梳理与行动沉淀的 AI 辅助应用。你可以记录灵感、管理目标、构建关系图谱，并通过 DeepSeek 生成灵感洞察、人生课题、下一步建议与周叙事。

## 目录

- [项目概述](#项目概述)
- [当前工作流](#当前工作流)
- [核心功能](#核心功能)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [环境变量](#环境变量)
- [运行脚本](#运行脚本)
- [认证与会话机制](#认证与会话机制)
- [API 概览](#api-概览)
- [AI 能力说明](#ai-能力说明)
- [数据存储](#数据存储)
- [常见问题与排错](#常见问题与排错)
- [生产部署建议](#生产部署建议)

## 项目概述

Echo V3.1 提供一个围绕“记录 - 洞察 - 主题 - 行动 - 回顾”的闭环体验：

1. 在 Inspiration Hub 中记录灵感、对话片段与触发瞬间，并由 AI 自动补充最多 3 个标签。
2. 在灵感页或 AI 对话中选中文字后，可以直接沉淀为灵感、人生课题或目标档案。
3. 在 Narrative Tracking 中查看 AI 汇总的人生课题、为课题生成下一步建议，并将建议写入目标档案。
4. 在每周叙事中按周回顾灵感，生成结构化周志，并以预览卡片方式查看周志片段。
5. 通过历史保存的 AI 报告与进度记录，避免重复生成相同建议，让内容可回溯、可复用。

当前界面同时支持中文和英文模式；中文模式下，AI 生成内容、洞察摘要、下一步建议和周志叙事都会输出为中文。

## 当前工作流

1. 记录灵感：输入一段文字后，系统会自动调用 AI 打标并保存到 inspirations。
2. 选中文字沉淀：在灵感页或 AI 对话窗口中选择文本，可一键加入灵感、目标档案或人生课题。
3. 生成人生课题：AI 先尝试并入已有主题，再决定是否创建新课题，并把报告保存到 insightReports。
4. 课题推进：点击人生课题卡片会优先读取上次保存的下一步建议；完成后才会生成新的下一步并同步写入目标档案。
5. 周志回顾：按周聚合灵感后生成周叙事，已保存的周志可继续打开并查看关联片段预览。

## 核心功能

### 1) 本地账号系统

- 支持用户名+密码注册、登录、登出
- 会话基于 Express Session + SQLite 存储
- 前后端均通过 Cookie 维持登录态

### 2) 灵感记录（Inspiration Hub）

- 新增/删除灵感
- 灵感可关联人物（personId）
- AI 自动生成最多 3 个标签，并支持按标签筛选
- 详情面板可触发 AI 洞察与 AI 对话延展（Echo Dialogue）
- 支持选中文字直接沉淀为灵感 / 人生课题 / 目标档案
- 支持基于当前筛选结果生成 AI 洞察报告并保存历史


### 3) 目标与周叙事（Narrative Tracking）

- 新增、完成、删除目标
- 按状态、关键词、排序方式管理目标档案
- 人生课题从记录下的时刻中生成，并保存可复用的下一步建议
- 下一步建议会自动写入目标档案，作为可执行 todo 留存
- 按周聚合灵感并生成 Weekly Narrative（Markdown）
- 周志详情支持预览关联片段，避免整段内容堆叠在详情页
- 保存、删除周叙事

### 4) AI 交互

- Analyze Thought：输出标题、洞察与目标建议
- AI 洞察：输出结构化报告、反复主题与 CBT 风格建议
- 生成人生课题：优先参考已有主题，减少重复开题
- Next Action：基于当前课题与历史进度生成下一步建议，并持久化
- Generate Narrative：输出周叙事、主题、地平线建议
- 对话延展：支持基于上下文的多轮问答

## 技术栈

### 前端

- React 19
- TypeScript
- Vite
- Tailwind CSS
- motion
- Lucide 图标

### 后端

- Express
- express-session
- connect-sqlite3
- better-sqlite3
- bcryptjs

### AI

- DeepSeek Chat Completions API
- 中文模式下会强制输出中文用户文案

## 项目结构

```text
.
├── server.ts                     # Express 服务、会话、认证、REST API
├── src/
│   ├── App.tsx                   # 应用入口与登录态 UI
│   ├── components/
│   │   ├── inspirations/
│   │   │   └── InspirationHub.tsx  # 灵感记录、AI 洞察、选中文本沉淀
│   │   ├── relationships/
│   │   │   └── RelationshipMap.tsx
│   │   ├── tracking/
│   │   │   └── NarrativeTracking.tsx  # 人生课题、目标档案、周志
│   │   └── AIChatModal.tsx       # AI 对话弹窗，支持选中文本沉淀
│   ├── hooks/
│   │   └── useFirebase.ts        # 统一数据请求封装（当前走本地 API）
│   ├── services/
│   │   └── gemini.ts             # AI 服务封装（已迁移为 DeepSeek 实现）
│   ├── lib/
│   │   ├── localAuth.ts          # 登录注册接口封装
│   │   └── firebase.ts           # Firebase 初始化（兼容保留）
│   └── types.ts                  # 全局类型定义
├── local.db                      # 业务数据 SQLite
├── sessions.db                   # 会话 SQLite
├── vite.config.ts                # Vite 配置及环境变量注入
└── README.md
```

## 快速开始

### 前置要求

- Node.js 18+
- npm 9+

### 安装依赖

```bash
npm install
```

### 配置环境变量

在项目根目录创建 `.env.local`。

示例：

```env
DEEPSEEK_API_KEY="your_deepseek_api_key"
DEEPSEEK_API_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-chat"
SESSION_SECRET="your_strong_session_secret"
```

### 启动开发环境

```bash
npm run dev
```

默认服务地址：

- http://localhost:3000

### 语言模式说明

- 切换到中文模式后，AI 会优先输出中文标题、摘要、建议和周志内容
- 英文模式则保留英文输出风格，适合双语使用场景

## 环境变量

| 变量名 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| DEEPSEEK_API_KEY | 是 | 无 | DeepSeek API Key |
| DEEPSEEK_API_BASE_URL | 否 | https://api.deepseek.com | DeepSeek 接口基地址 |
| DEEPSEEK_MODEL | 否 | deepseek-chat | 使用的模型名称 |
| SESSION_SECRET | 是（生产强制） | Echo-local-secret（代码默认） | Session 签名密钥 |
| NODE_ENV | 否 | development | 影响 Cookie 策略与静态资源模式 |

## 运行脚本

| 命令 | 说明 |
| --- | --- |
| npm run dev | 启动后端+Vite 中间件开发服务 |
| npm run build | 构建前端产物到 dist |
| npm run preview | 预览构建结果 |
| npm run lint | TypeScript 类型检查（tsc --noEmit） |

## 认证与会话机制

### 登录流程

1. 前端调用 `/api/register` 或 `/api/login`。
2. 后端校验后将 `userId` 写入 session。
3. 浏览器持有 `Echo.sid` Cookie。
4. 前端通过 `/api/me` 获取当前用户，决定渲染登录页或主界面。

### Cookie 策略

- 开发环境：`secure=false`，`sameSite=lax`
- 生产环境：`secure=true`，`sameSite=none`

这样可避免本地 HTTP 场景下 Cookie 被浏览器拒收，导致“注册成功但仍未登录”。

## API 概览

### 认证相关

- `POST /api/register`
- `POST /api/login`
- `GET /api/me`
- `POST /api/logout`

### 业务数据

- Inspirations
  - `GET /api/inspirations`
  - `POST /api/inspirations`
  - `PUT /api/inspirations/:id`
  - `DELETE /api/inspirations/:id`
- People
  - `GET /api/people`
  - `POST /api/people`
  - `PUT /api/people/:id`
  - `DELETE /api/people/:id`
- Relationships
  - `GET /api/relationships`
  - `POST /api/relationships`
  - `PUT /api/relationships/:id`
  - `DELETE /api/relationships/:id`
- Goals
  - `GET /api/goals`
  - `POST /api/goals`
  - `PUT /api/goals/:id`
  - `DELETE /api/goals/:id`
- Summaries
  - `GET /api/summaries`
  - `POST /api/summaries`
  - `PUT /api/summaries/:id`
  - `DELETE /api/summaries/:id`

所有业务接口均受会话鉴权保护，未登录返回 401。

## AI 能力说明

当前 AI 封装位于 `src/services/gemini.ts`（文件名保留，内部已改为 DeepSeek 实现）。

### 主要方法

- `getAIInsight(content)`
  - 用于 Analyze Thought
  - 返回结构化 JSON：`title`、`insight`、`goalSuggestion`
- `getAIOverview(inspirations, existingThemes)`
  - 用于灵感洞察与人生课题提炼
  - 返回结构化 JSON：`title`、`summary`、`insights`、`recurringThemes`、`recommendedActions`
- `getAINextAction(theme, report, completedAction, conversationNotes)`
  - 用于人生课题的下一步建议
  - 返回结构化 JSON：`nextAction`、`rationale`、`steps`、`measurement`
- `summarizeWeek(inspirations)`
  - 用于 Generate Narrative
  - 返回 Markdown 内容并保存到 `summaries`
- `continueChat(history, nextMessage)`
  - 用于对话弹窗多轮交流

### 语言策略

- 中文模式下，AI 会优先输出中文标题、摘要、行动建议和周志内容
- 英文模式下，AI 会保持英文输出，方便双语切换
- 生成人生课题时会先尝试与已有主题合并，再决定是否开新题

### 错误处理

- 若未配置 `DEEPSEEK_API_KEY`，会抛出可见错误提示
- 若 API 失败，按钮区域会显示错误信息而不是无响应

## 数据存储

### SQLite 文件

- `local.db`：用户、灵感、人物、关系、目标、周叙事、AI 洞察报告
- `sessions.db`：会话存储

### 建表逻辑

服务启动时自动执行建表 SQL，首次运行无需手动初始化数据库。

### 关键数据对象

- `inspirations`：灵感、标签、人物关联、创建时间
- `goals`：目标档案与下一步行动
- `summaries`：周志 Markdown 内容
- `insightReports`：AI 洞察报告、人生课题报告与 `themeProgress` 历史

## 常见问题与排错

### 1) 注册成功但仍停留登录页

排查顺序：

1. 确认访问地址是 `http://localhost:3000`
2. 清理浏览器站点 Cookie 后重试
3. 确认服务端 `NODE_ENV` 是否符合当前环境
4. 检查 `server.ts` Cookie 策略是否被改动

### 2) Analyze Thought 或 Generate Narrative 无法使用

排查顺序：

1. 检查 `.env.local` 中是否存在 `DEEPSEEK_API_KEY`
2. 修改后是否重启 `npm run dev`
3. 检查 Key 是否有效、余额或权限是否正常
4. 检查按钮附近错误提示文案

### 3) TypeScript 报错或构建失败

执行：

```bash
npm run lint
```

根据报错定位到具体文件修复。

## 生产部署建议

1. 设置强随机 `SESSION_SECRET`。
2. 通过 HTTPS 提供服务（生产 `secure cookie` 必需）。
3. 将 `local.db`、`sessions.db` 放置到可持久化存储目录。
4. 使用进程管理器（如 PM2）保障服务稳定。
5. 配置日志轮转与错误监控。

---

如果你希望，我可以在下一步继续补一份“接口请求 / 响应示例”版文档（包含每个 API 的 JSON 示例），用于前后端联调和二次开发。