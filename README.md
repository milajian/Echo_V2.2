# Echo V3.1

一个面向个人成长与自我反思的 AI 辅助应用。围绕"记录 → 对话 → 洞察"的闭环，你可以把灵感、感受、对话片段沉淀下来，与 AI 围绕同一段内容连续对话，并在周/月维度生成 CBT 框架的成长洞察报告。

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

Echo V3.1 由底部三个主 Tab 组成：

1. **记录**（Inspiration Hub）— 输入灵感、感受、对话片段，AI 自动打标签；支持选中文字快速沉淀。
2. **对话**（Conversation）— 与 AI 围绕灵感或洞察报告进行多轮对话，全部消息持久化到 SQLite。
3. **洞察**（Growth Insights）— AI 基于一段时间内的灵感与对话生成 **CBT 框架** 的周/月成长洞察报告，可归档、可搜索、可继续聊聊。

界面同时支持中文 / 英文与浅色 / 深色主题，AI 输出会跟随当前语言模式。

## 当前工作流

1. **记录灵感**：在"记录" Tab 输入文字 → AI 自动打最多 3 个标签 → 入库。
2. **沉淀文字**：在记录卡片或对话页选中任一段文字 → 浮层"沉淀 Echo" → 一键存为新灵感（自动打 `Echo` 高亮标签）。
3. **开启 / 继续对话**：从灵感卡片点"开启对话"；如已存在历史对话，按钮自动切换为"继续对话"，跳到同一对话。
4. **生成洞察报告**：在记录页对当前筛选结果生成 AI 洞察报告（CBT 七段结构），自动归档到 `insightReports`，可按标签 / 综合筛选与搜索。
5. **基于报告继续聊聊**：报告内"继续聊聊"会把报告塞进对话上下文，但不自动发送，等用户写下第一句话后再合并发出。
6. **查看成长洞察**：在"洞察" Tab 浏览左右滑动的周/月报告，默认显示最新一期，附"查看全部"。

## 核心功能

### 1) 本地账号系统

- 用户名 + 密码注册 / 登录 / 登出
- 会话基于 Express Session + SQLite 存储（`sessions.db`）
- 登录页支持密码可见性切换（眼睛图标）

### 2) 记录（Inspiration Hub）

- 新增 / 删除灵感，AI 自动生成最多 3 个标签
- 输入框瘦身为"文本框 + 麦克风 + 保存"，已移除"关联人物"下拉
- 视图设置（齿轮按钮）：
  - 列表 / Gallery 视图
  - 新→旧 / 旧→新
  - 按标签 / 按日期 / 不分组（默认时间倒序）
- 按标签分组时，组内按时间排序，组间按"该组最新一张卡片"的时间排序
- `Echo` 标签使用 amber 色系高亮，与其它中性色标签区分
- 选中文字 → 浮层"沉淀 Echo" → 自动打 `Echo` 标签生成新灵感
- AI 洞察按钮智能态：
  - 若当前筛选下已有报告：显示"查看已有报告"
  - 若标签下还有新灵感：同时保留"生成报告"

### 3) 对话（Conversation）

- 独立的 **对话** 主 Tab，所有消息持久化到 SQLite
- 对话与灵感 / 报告绑定（`ConversationSeed`）：
  - 从灵感开启的对话继承灵感标签
  - 多灵感聚合或跨标签对话打"综合 / Synthesized"标签
  - 对话页右上角提供"相关灵感"快速回跳按钮
- 默认标题取灵感原文或报告标题前 20 字
- 选中 AI 回复文字 → 浮层"沉淀 Echo"
  - 浮层悬浮在选中文字上方且不遮挡，保留选区高亮
  - 首次出现的引导提示（[src/lib/textPromotions.ts](src/lib/textPromotions.ts)）
  - 桌面与移动端均支持（移动端走 `onTouchEnd` 路径）
- 对话页位置记忆：按上次状态（详情 / 列表）恢复
- 输入框贴底，底部内容加 ChatGPT 式渐隐
- "基于此报告聊聊" 走 `autoSend: false`：把报告塞进 `pendingContext`，光标聚焦到输入框，发送第一条消息时再合并 preamble

### 4) 洞察（Growth Insights）

- 取代旧版"人生课题"卡片
- 周度报告排在月度上方，左右滑动浏览，默认显示最新一期，附"查看全部"
- 提供 mock 数据：[src/lib/mockGrowthReports.ts](src/lib/mockGrowthReports.ts)
- 报告关联灵感与对话，可直接跳转
- 洞察归档板块按标签 / 综合筛选与搜索（`insightReports` 表）
- 报告内 Markdown 由 `react-markdown` 渲染（标题 / 段落 / 强调样式）
- 旧的"目标档案"和"每周叙事"两块已隐藏

### 5) 设置

- [SettingsModal.tsx](src/components/SettingsModal.tsx) 抽屉：
  - **外观**：Light / Dark 主题切换，全局通过 `html.dark` 应用 stone 色系
  - **语言**：中文 / 英文
  - **通知**：启用通知 / 提示音开关（深色态下圆点显式锁为 `#ffffff` 与暗椭圆区分）
  - 退出登录
- 偏好持久化到 `localStorage` 的 `echo.settings.prefs`

## 技术栈

### 前端

- React 19 + TypeScript + Vite
- Tailwind CSS（含 `html.dark` 深色覆盖样式）
- motion、Lucide 图标
- react-markdown（用于渲染 CBT 报告与 AI 回复中的 Markdown）

### 后端

- Express + express-session + connect-sqlite3
- better-sqlite3（业务数据 + 会话）
- bcryptjs（密码哈希）

### AI

- DeepSeek Chat Completions API
- 输出已去 JSON 化，直接给自然语言段落
- 报告类输出按 CBT 框架的固定段落结构生成

## 项目结构

```text
.
├── server.ts                          # Express 服务、会话、认证、REST API
├── src/
│   ├── App.tsx                        # 应用入口、底部三 Tab、登录态、跨 Tab 联动 state
│   ├── main.tsx
│   ├── index.css                      # Tailwind + html.dark 深色主题覆盖
│   ├── components/
│   │   ├── inspirations/
│   │   │   └── InspirationHub.tsx     # 记录 Tab：灵感、AI 洞察、归档、视图设置
│   │   ├── conversations/
│   │   │   └── ConversationPage.tsx   # 对话 Tab：多轮对话、沉淀 Echo、相关灵感跳转
│   │   ├── tracking/
│   │   │   └── NarrativeTracking.tsx  # 洞察 Tab：周/月成长洞察、归档列表
│   │   ├── relationships/             # 关系图（保留目录）
│   │   ├── SettingsModal.tsx          # 设置抽屉（主题、语言、通知）
│   │   └── AIChatModal.tsx            # 旧弹窗（已不在主入口使用，保留文件）
│   ├── constants/
│   │   └── inspirationTags.ts         # 标签元数据，Echo 标签高亮配色
│   ├── hooks/
│   │   └── useFirebase.ts             # 统一数据请求封装（当前走本地 API）
│   ├── lib/
│   │   ├── localAuth.ts               # 登录注册接口封装
│   │   ├── firebase.ts                # Firebase 初始化（兼容保留）
│   │   ├── mockGrowthReports.ts       # 成长洞察 mock 数据
│   │   └── textPromotions.ts          # 沉淀 Echo 引导提示
│   ├── services/
│   │   └── gemini.ts                  # AI 服务封装（文件名保留，内部为 DeepSeek + CBT 提示词）
│   └── types.ts                       # 全局类型（含 ConversationSeed、GrowthReport、Inspiration.tags）
├── local.db                           # 业务数据 SQLite
├── sessions.db                        # 会话 SQLite
├── vite.config.ts                     # Vite 配置及环境变量注入
├── CHANGELOG.md
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

在项目根目录创建 `.env.local`：

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

默认服务地址：`http://localhost:3000`

### 语言与主题

- 中文模式：AI 输出中文标题、报告、对话回复
- 英文模式：保持英文输出
- 主题切换：设置面板"外观"→ Light / Dark，立即生效并写入 `localStorage`

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
| npm run dev | 启动后端 + Vite 中间件开发服务（tsx server.ts） |
| npm run build | 构建前端产物到 dist |
| npm run preview | 预览构建结果 |
| npm run lint | TypeScript 类型检查（tsc --noEmit） |
| npm run clean | 删除 dist 目录 |

## 认证与会话机制

### 登录流程

1. 前端调用 `/api/register` 或 `/api/login`
2. 后端校验后将 `userId` 写入 session
3. 浏览器持有 `Echo.sid` Cookie
4. 前端通过 `/api/me` 获取当前用户，决定渲染登录页或主界面

### Cookie 策略

- 开发环境：`secure=false`，`sameSite=lax`
- 生产环境：`secure=true`，`sameSite=none`

可避免本地 HTTP 场景下 Cookie 被浏览器拒收，导致"注册成功但仍未登录"。

## API 概览

### 认证相关

- `POST /api/register`
- `POST /api/login`
- `GET /api/me`
- `POST /api/logout`

### 业务数据

- Inspirations
  - `GET    /api/inspirations`
  - `POST   /api/inspirations`
  - `PUT    /api/inspirations/:id`
  - `DELETE /api/inspirations/:id`
- People
  - `GET    /api/people`
  - `POST   /api/people`
  - `PUT    /api/people/:id`
  - `DELETE /api/people/:id`
- Relationships
  - `GET    /api/relationships`
  - `POST   /api/relationships`
  - `PUT    /api/relationships/:id`
  - `DELETE /api/relationships/:id`
- Goals
  - `GET    /api/goals`
  - `POST   /api/goals`
  - `PUT    /api/goals/:id`
  - `DELETE /api/goals/:id`
- Summaries（周叙事，已隐藏入口但接口保留）
  - `GET    /api/summaries`
  - `POST   /api/summaries`
  - `PUT    /api/summaries/:id`
  - `DELETE /api/summaries/:id`
- Insight Reports（AI 洞察 / 成长洞察归档）
  - `GET    /api/insightReports`
  - `POST   /api/insightReports`
  - `DELETE /api/insightReports/:id`
- Conversations（对话 Tab 持久化）
  - `GET    /api/conversations`
  - `POST   /api/conversations`
  - `PUT    /api/conversations/:id`
  - `DELETE /api/conversations/:id`
  - `GET    /api/conversations/:id/messages`
  - `POST   /api/conversations/:id/messages`

所有业务接口均受会话鉴权保护，未登录返回 401。

## AI 能力说明

AI 封装位于 [src/services/gemini.ts](src/services/gemini.ts)（文件名保留，内部为 DeepSeek 实现）。

### 主要方法

- `getAIInsight(content)` — 用于"分析想法"，输出标题与自然语言洞察（已删除"采纳目标"按钮，"推荐目标"改为"行为建议"）。
- `getAIOverview(inspirations, existingThemes)` — **CBT 框架** 的洞察报告生成器：
  - System prompt 定义为 *CBT-grounded reflective coach*
  - 总长度硬约束 400–600 字 / words
  - `summary` 强制按 7 段 `### 【...】` 输出：核心冲突、关键自动思维、情绪与行为模式、认知偏差、已有资源、关键杠杆、替代视角
  - 每个小标题下输出 1–3 句连贯段落，**不使用 bullet / 列表 / 加粗子项**
  - `recommendedActions` 为 CBT 风格、针对"关键杠杆"的可执行建议，含 `stepByStep` + `measurement`
- `getAINextAction(theme, report, completedAction, conversationNotes)` — 同样按 CBT 口径输出 `nextAction / rationale / steps / measurement`。
- `summarizeWeek(inspirations)` — 周叙事 Markdown（接口保留，UI 入口已隐藏）。
- `continueChat(history, nextMessage)` — 对话 Tab 多轮交流的核心方法，支持 `pendingContext` preamble 注入。

### 语言策略

- 中文模式：标题、报告、回复全部中文输出
- 英文模式：保持英文输出
- 标签自动调用 AI 生成，最多 3 个；沉淀 Echo 时同时附加 `Echo` 标签

### 错误处理

- 未配置 `DEEPSEEK_API_KEY` 时抛出可见错误提示
- API 失败时按钮区域显示错误信息而非无响应

## 数据存储

### SQLite 文件

- `local.db`：用户、灵感、人物、关系、目标、周叙事、洞察报告、对话与消息
- `sessions.db`：会话存储

### 关键数据对象

- `inspirations`：灵感正文、`tags`、人物关联、创建时间
- `goals`：目标档案与下一步行动（接口保留）
- `summaries`：周志 Markdown 内容（接口保留，UI 已隐藏）
- `insightReports`：AI 洞察 / 成长洞察报告，附标签（含"综合"）与时间戳
- `conversations` + `conversation_messages`：对话与消息持久化，对话表带灵感来源 / 标签字段，驱动"相关灵感"与对话标签
- `ConversationSeed`（[src/types.ts](src/types.ts)）：跨 Tab 跳转的对话种子，含 `autoSend` 字段控制是否自动发送首条消息

服务启动时自动建表，首次运行无需手动初始化数据库。

## 常见问题与排错

### 1) 注册成功但仍停留登录页

1. 确认访问地址是 `http://localhost:3000`
2. 清理浏览器站点 Cookie 后重试
3. 确认 `NODE_ENV` 是否符合当前环境
4. 检查 [server.ts](server.ts) Cookie 策略是否被改动

### 2) AI 洞察 / 对话 / 分析想法无响应

1. 检查 `.env.local` 中是否存在 `DEEPSEEK_API_KEY`
2. 修改后是否重启 `npm run dev`
3. 检查 Key 是否有效、余额或权限是否正常
4. 查看按钮附近错误提示文案

### 3) 报告里出现 `### 【小标题】` 等原始 Markdown 字符

报告区已接入 `react-markdown` 渲染（[InspirationHub.tsx](src/components/inspirations/InspirationHub.tsx) 中的 `reportMarkdownComponents`）。如再次出现，确认依赖未被裁剪、组件 props 未被改动。

### 4) 深色主题下开关圆点与背景融为一体

圆点已在 [SettingsModal.tsx](src/components/SettingsModal.tsx) 显式锁为 `#ffffff`。如修改色板，注意保留与暗色椭圆的对比。

### 5) TypeScript 报错或构建失败

```bash
npm run lint
```

根据报错定位到具体文件修复。

## 生产部署建议

1. 设置强随机 `SESSION_SECRET`
2. 通过 HTTPS 提供服务（生产 `secure cookie` 必需）
3. 将 `local.db`、`sessions.db` 放置到可持久化存储目录
4. 使用进程管理器（如 PM2）保障服务稳定
5. 配置日志轮转与错误监控

---

如需进一步的接口请求 / 响应 JSON 示例文档（用于前后端联调或二次开发），可以在下一步补一份对应的"API Reference"。
