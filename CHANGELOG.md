# Echo V3.1 修改记录

> 基于 5/1–5/5 期间 42 个会话整理，并与当前 [src/](src/) 与 [server.ts](server.ts) 代码状态交叉验证。

## ✨ 新功能

- **新增"对话"主 Tab**：底部导航增加独立的对话页面，对话持久化到 SQLite（[ConversationPage.tsx](src/components/conversations/ConversationPage.tsx) + [server.ts](server.ts)）。
- **从灵感卡片"开启 / 继续对话"**：对话与灵感卡片绑定；存在历史时按钮文案自动切到"继续对话"，跳到同一对话。
- **对话内"沉淀灵感"**：选中 AI 回复文字 → 一键存为灵感卡片，自动打 `Echo` 标签。
  - 弹窗悬浮在选中文字上方且不遮挡，保留高亮选中态。
  - 首次出现的引导提示（[src/lib/textPromotions.ts](src/lib/textPromotions.ts)）。
- **AI 洞察直接进对话页**：取消旧的 AIChatModal 弹窗，"直接对话/继续聊聊/基于此报告聊聊"统一走对话页 navigation。
- **洞察报告归档板块**：每生成一次自动入库，支持按标签筛选/搜索（`insightReports` 表）。
- **"成长洞察"周/月度报告**：替换原"人生课题"卡片，附关联灵感与对话；提供 mock 数据 [src/lib/mockGrowthReports.ts](src/lib/mockGrowthReports.ts)。
  - 周度排在月度上方；都改为左右滑动、默认显示最新一期，附"查看全部"。
- **AI 洞察按钮智能态切换**：已有报告时显示"查看已有报告"；标签下有新灵感时同时保留"生成报告"。
- **报告/对话标签继承**：从灵感开启的对话继承灵感标签；多灵感聚合时打"综合"标签；标签只读。
- **灵感视图设置（齿轮按钮）**：列表/Gallery、新→旧/旧→新、按标签或日期 group by。
- **设置面板抽屉** [SettingsModal.tsx](src/components/SettingsModal.tsx)：语言切换、通知开关、退出登录。
- **登录页密码可见性切换**（眼睛图标）。
- **"相关灵感"快速回跳按钮**（对话页右上角）。
- **AI 洞察按钮 hover 提示**。

## 🐛 Bug 修复

- "分析想法"结果切 Tab 后丢失 → 改为持久化存储。
- 对话页位置不记忆 → 按上次状态（详情/列表）恢复。
- DeepSeek 返回内容里残留 `{ "message": ..., "suggested_action": ... }` JSON → 改为自然语言。
- "全部"标签生成的报告缺"综合"标签；归档区缺"综合"筛选项 → 已补，位置在"全部"右边。
- 由灵感开启的对话标签未显示 → 修复。
- 沉淀灵感弹窗遮挡选中文字 / 选中态丢失 → 调整定位与选区保留。
- "继续对话"按钮在已有对话时未生效 → 修复。
- 关闭按钮关不掉报告（半关闭态）→ 统一为关闭整个报告。

## 🎨 UI / 交互优化

- 底部导航改为常驻底部、铺满、不悬浮、不遮挡内容；尺寸多次细调。
- 移动端导航最小化按钮（`navMinimized`）。
- 整体响应式 / 手机端窗口适配。
- Tab 改名："灵感" → "记录"，"叙事" → "洞察"。
- 隐藏"叙事"内的"目标档案"和"每周叙事"两块。
- "分析想法"结果页清理：删除"采纳目标"按钮、"推荐目标" → "行为建议"、移除"人生课题"段落。
- 灵感页布局多轮微调：输入框移到标签上方；搜索框、AI 洞察按钮、filter 按钮排成一行；缩短各处垂直间距。
- 成长洞察页紧凑化：删除"X 份报告"提示，搜索框上移。
- 对话页输入框贴底；底部内容加 ChatGPT 式渐隐。
- 日期 filter 一度加入又应你要求删除。

## 🤖 AI 能力调整

- DeepSeek 输出去 JSON 化，直接出自然语言段落（[src/services/gemini.ts](src/services/gemini.ts)）。
- AI 洞察删除"认知发现/情绪探索/行为洞察"三个子问题。
- 对话默认标题：取灵感原文或报告标题前 20 字。
- 加入"综合洞察"类型，覆盖跨标签场景。
- 沉淀灵感时自动调用 AI 打标签 + 加 `Echo` 标签。

## 🗄️ 数据 / 后端

- 新增 `insightReports` 表与 GET/POST/DELETE 接口（[server.ts](server.ts)）。
- 对话与消息持久化：`/api/conversations/:id/messages` 等。
- 对话表加灵感来源/标签字段（驱动"相关灵感"和对话标签）。
- [src/types.ts](src/types.ts) 扩展 `ConversationSeed`、`Inspiration.tags`、`GrowthReport`。

## 🌏 国际化 / 中英文

- 修复"关系洞察"等场景混入英文 `relationship` 的问题。
- Tab 改名同步中英文 label。
- 新增"综合 / Synthesized"对照。

## ♻️ 重构 / 代码质量

- 删除 AIChatModal 调用路径，AI 对话入口统一走对话页。
- 灵感分析结果 state 提升 / 持久化。
- Tab 间联动改为 App 顶层 state + nonce 模式（`pendingConversationSeed / pendingInspirationFocus / pendingInsightReportTag`，见 [App.tsx](src/App.tsx)）。

## 📦 构建 / 配置 / 依赖

- 环境变量主切到 `DEEPSEEK_API_KEY / DEEPSEEK_API_BASE_URL / DEEPSEEK_MODEL`，未见依赖大改。

## 📝 备注

- 这份清单基于 42 个会话通读 + 当前代码交叉验证，**只列出现在代码里仍体现的最终态**，但保留了几次显著的"加了又删"作为子要点（典型：日期 filter、人生课题段落、目标档案/每周叙事板块）。
- 同一需求在不同会话被反复打磨（如"分析想法结果丢失"、导航栏位置）已合并去重。
- 像素级 hover/间距微调归入 🎨 大类，未单列。
- 项目无 git 历史，时间线靠对话 mtime 推断。

---

# 5/5 19:51 之后的增量修改

> 基于 5/5 21:45–23:14 期间 17 个会话整理，并与当前 [src/](src/) 与 [server.ts](server.ts) 代码状态交叉验证。

## ✨ 新功能

- **深色 / 浅色主题切换**：设置面板「外观」从原来的「减少动画」改成 Light / Dark 二选一，全局通过 `html.dark` 应用配色（[SettingsModal.tsx](src/components/SettingsModal.tsx) + [src/index.css](src/index.css)）。
  - 偏好持久化到 `localStorage` 的 `echo.settings.prefs`。
  - 在 [index.css](src/index.css) 里补了一整套 `html.dark` 的 stone 色系覆盖（背景/文字/边框/hover）。
- **手机端选中文字唤出"沉淀 Echo"弹窗**：在消息容器上加 `onTouchEnd` 触发选区检测（[ConversationPage.tsx](src/components/conversations/ConversationPage.tsx)）。

## 🐛 Bug 修复

- 深色主题下「启用通知 / 提示音」开关圆点与背景椭圆颜色融成一体 → 圆点显式锁为白底（`#ffffff`），与暗色椭圆形成对比（[SettingsModal.tsx](src/components/SettingsModal.tsx)）。
- 手机端选中 AI 回复文字不弹出「沉淀灵感」浮层 → 补 touch 事件路径。
- 报告里 `### 【小标题】` 等 markdown 字符直接显示成符号 → 报告区接 ReactMarkdown 渲染（[InspirationHub.tsx](src/components/inspirations/InspirationHub.tsx)，`reportMarkdownComponents`）。

## 🎨 UI / 交互优化

- **记录页输入框瘦身**：移除"关联人物"下拉（含「不关联人物」等选项），整段 dropdown 删掉，只保留文本框 + 麦克风 + 保存按钮（[InspirationHub.tsx](src/components/inspirations/InspirationHub.tsx)）。
- **记录页默认排序改回纯时间倒序**：`groupBy` 默认从 `tag` 改成 `none`，齿轮里依然可切换为按标签或按日期 group（[InspirationHub.tsx](src/components/inspirations/InspirationHub.tsx)）。
- **按标签 group 时的内部排序口径**：每个分组内按时间排序，分组之间按"该组最新一张卡片的时间"排序，跟全局 sortOrder 同向（[InspirationHub.tsx](src/components/inspirations/InspirationHub.tsx) `groupInspirationsByPrimaryTag`）。
- **成长洞察页继续紧凑**：删除"X 份报告"的统计文字，搜索框再向上贴近标题，整体竖向间距继续收紧（[NarrativeTracking.tsx](src/components/tracking/NarrativeTracking.tsx)）。
- **AI 洞察弹窗里删除"直接对话"按钮**：洞察入口只保留与报告相关的动作。
- **沉淀弹窗文案**：选中 AI 回复后浮层文字从"沉淀为灵感"改成"沉淀 Echo"（[ConversationPage.tsx](src/components/conversations/ConversationPage.tsx)）。
- **`echo` 标签视觉高亮**：在标签条、卡片标签、详情标签处用 `amber` 色系突出，跟其它中性色标签拉开差距（`isAhaMomentTag` 分支，[InspirationHub.tsx](src/components/inspirations/InspirationHub.tsx)）。
  - 期间一度把标签名改成 "Aha Moment"，最后又改回 "Echo"，仅保留高亮配色（[inspirationTags.ts](src/constants/inspirationTags.ts)）。

## 🤖 AI 能力调整

- **AI 洞察报告改成 CBT 框架结构化输出**（[gemini.ts](src/services/gemini.ts) `getAIOverview`）：
  - System prompt 明确为"CBT-grounded reflective coach"，严格用认知行为疗法的自动思维 / 认知扭曲 / 情绪 / 行为 / 杠杆点框架。
  - 总长度硬约束 400–600 字 / words。
  - summary 强制按 7 段 `### 【...】` 输出：核心冲突、关键自动思维、情绪与行为模式（情绪 / 行为子项）、认知偏差、已有资源、关键杠杆、替代视角。
  - `recommendedActions` 要求是 CBT 风格、针对"关键杠杆"，含 stepByStep + measurement。
  - `getAINextAction` 同步改成 CBT 口径，要求 nextAction / rationale / steps / measurement 四段。

## 🗄️ 数据 / 后端

- 报告"继续聊聊"行为重构（[ConversationPage.tsx](src/components/conversations/ConversationPage.tsx) + [InspirationHub.tsx](src/components/inspirations/InspirationHub.tsx)）：
  - 新增 `ConversationSeed.autoSend` 字段（[types.ts](src/types.ts)）。
  - 报告里点"继续聊聊"现在传 `autoSend: false`：把报告内容塞进 `pendingContext`，不自动发任何首条消息，光标聚焦到输入框等用户自己写。
  - 用户真正发第一条消息时，把"参考报告「标题」：…"作为 user/model 双轮 preamble 拼到上下文，再调 `continueChat`，发完即清掉 `pendingContext`。

## 📝 备注

- 这一节基于 5/5 19:51 之后的 17 个会话整理（含 [f0a1f405]、[bb2fc903]、[c486b301]、[135ee6dc]、[e75a340f]、[e07ceb7a]、[24f112ac]、[d0a92b8e]、[a29c6fca]、[551bd490]、[7ffcd559]、[8c7570d5]、[a573577c]、[9ccdac63]、[b36c59be]、[233002b3]、[6e34ad24] 等），与当前代码交叉验证只列最终态。
- "Echo / Aha Moment" 反复改名最终落点为 `Echo`，仅保留高亮色作为子要点。
- 关于"注册密码规范"是问答式咨询，未产生代码改动，未列入。
- 像素级排序/间距微调（如成长洞察标题与搜索框的距离）合并在 🎨 大类，未单列。
