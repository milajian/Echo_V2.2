/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { INSPIRATION_TAG_KEYS, normalizeInspirationTags } from '../constants/inspirationTags';

const apiKey = process.env.DEEPSEEK_API_KEY || '';
const apiBaseUrl = process.env.DEEPSEEK_API_BASE_URL || 'https://api.deepseek.com';
const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

function ensureApiKey() {
  if (!apiKey) {
    throw new Error('Missing DEEPSEEK_API_KEY. Please set it in .env.local and restart the dev server.');
  }
}

type ChatRole = 'system' | 'user' | 'assistant';
type OutputLanguage = 'zh' | 'en';

interface ChatMessage {
  role: ChatRole;
  content: string;
}

async function callDeepSeek(messages: ChatMessage[], temperature = 0.7) {
  ensureApiKey();
  const response = await fetch(`${apiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      stream: false,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `DeepSeek API error (${response.status})`;
    throw new Error(message);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('DeepSeek returned an empty response.');
  }

  return content;
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error('AI returned non-JSON output.');
  }
}

function inferFallbackTags(content: string) {
  const text = content.toLowerCase();
  const rules: Array<{ key: string; keywords: string[] }> = [
    { key: 'relationship', keywords: ['关系', '相处', '沟通', '朋友', '同事', '伴侣', '父母', '家人', 'ta', '他', '她', '恋爱'] },
    { key: 'career', keywords: ['工作', '职业', '面试', '升职', '跳槽', '项目', '领导', '老板', '加班', '薪资'] },
    { key: 'emotion', keywords: ['喜欢', '爱', '难过', '心动', '失落', '焦虑', '孤独', '委屈', '委屈', '分手', '感情'] },
    { key: 'family', keywords: ['家庭', '父母', '母亲', '父亲', '孩子', '婚姻', '家里'] },
    { key: 'friendship', keywords: ['朋友', '友谊', '闺蜜', '兄弟'] },
    { key: 'growth', keywords: ['成长', '改变', '突破', '疗愈', '觉察', '自我'] },
    { key: 'learning', keywords: ['学习', '读书', '考试', '知识', '技能', '课程'] },
    { key: 'health', keywords: ['健康', '睡眠', '身体', '运动', '焦虑', '疲惫'] },
    { key: 'finance', keywords: ['钱', '金钱', '工资', '收入', '支出', '预算', '财务'] },
    { key: 'creativity', keywords: ['创意', '灵感', '写作', '设计', '艺术', '想法'] },
    { key: 'pressure', keywords: ['压力', '紧张', '崩溃', '疲惫', 'deadline', '截止'] },
    { key: 'future', keywords: ['未来', '规划', '方向', '期待', '目标'] },
    { key: 'choice', keywords: ['选择', '抉择', '决定', '犹豫', '取舍'] },
    { key: 'self', keywords: ['我', '自己', '内心', '边界', '习惯', '认同'] },
    { key: 'life', keywords: ['人生', '生活', '意义', '日常', '存在'] },
  ];

  const matched = rules.filter((rule) => rule.keywords.some((keyword) => text.includes(keyword.toLowerCase()))).map((rule) => rule.key);
  return matched.length > 0 ? Array.from(new Set(matched)).slice(0, 3) : ['life'];
}

function languageInstruction(lang: OutputLanguage = 'zh') {
  return lang === 'zh'
    ? 'Write every user-facing word in Simplified Chinese. Do not wrap the answer in JSON, code fences, or any structured format unless the prompt explicitly asks for it.'
    : 'Write every user-facing word in clear English. Do not wrap the answer in JSON, code fences, or any structured format unless the prompt explicitly asks for it.';
}

function jsonLanguageInstruction(lang: OutputLanguage = 'zh') {
  return lang === 'zh'
    ? 'Keep every JSON key exactly as specified (in English). Write all string values, titles, summaries, rationales, steps, and markdown sections in Simplified Chinese.'
    : 'Keep every JSON key exactly as specified (in English). Write all string values, titles, summaries, rationales, steps, and markdown sections in clear English.';
}

function stripChatWrapping(text: string): string {
  if (!text) return text;
  let out = text.trim();
  const fenceMatch = out.match(/^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (fenceMatch) out = fenceMatch[1].trim();
  if (out.startsWith('{') && out.endsWith('}')) {
    try {
      const parsed = JSON.parse(out);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const stringValues = Object.values(parsed).filter(
          (v): v is string => typeof v === 'string' && v.trim().length > 0,
        );
        if (stringValues.length > 0) return stringValues.join('\n\n').trim();
      }
    } catch {
      // not actually JSON; fall through and return as-is
    }
  }
  return out;
}

export async function getAIInsight(content: string, lang: OutputLanguage = 'zh') {
  try {
    const text = await callDeepSeek([
      {
        role: 'system',
        content:
          `You are a personal growth assistant. ${jsonLanguageInstruction(lang)} Return strictly valid JSON with keys: title, insight, goalSuggestion. ` +
          `The insight should be expansive and multi-layered: explain the core meaning, emotional subtext, cognitive pattern, blind spots, and a practical growth direction. ` +
          `The goalSuggestion should be concrete and behaviorally specific, not generic.`,
      },
      {
        role: 'user',
        content: `Analyze this thought and return JSON only.\n\nThought: "${content}"`,
      },
    ], 0.5);

    return tryParseJson(text);
  } catch (error) {
    console.error('AI Insight Error:', error);
    throw error;
  }
}

export async function getAIInspirationTags(content: string) {
  try {
    const text = await callDeepSeek([
      {
        role: 'system',
        content:
          `You are a classification assistant for personal reflections. Return strictly valid JSON with a single key: tags. ` +
          `tags must be an array of 1-3 strings chosen from this canonical taxonomy: ${INSPIRATION_TAG_KEYS.join(', ')}. ` +
          `Prefer the most specific tags. Do not include any extra text.`,
      },
      {
        role: 'user',
        content: `Classify this thought.

Thought: "${content}"`,
      },
    ], 0.2);

    const parsed = tryParseJson(text) as { tags?: unknown };
    return normalizeInspirationTags(parsed?.tags, inferFallbackTags(content));
  } catch (error) {
    console.error('AI Tagging Error:', error);
    return inferFallbackTags(content);
  }
}

export async function summarizeWeek(inspirations: string[] = [], lang: OutputLanguage = 'zh') {
  try {
    const text = await callDeepSeek([
      {
        role: 'system',
        content:
          `You are Echo, a reflective writing companion. ${languageInstruction(lang)} Write concise but vivid markdown.`,
      },
      {
        role: 'user',
        content: `Create a "Weekly Narrative" in Markdown based on these inspirations.\n\nRequirements:\n- Use a poetic H2 title\n- One atmospheric opening paragraph\n- "## Recurring Motifs" with bullet points\n- "## The Horizon" with growth directions\n- End with a concise cinematic "Film Narrative" paragraph\n\nInspirations:\n${(inspirations || []).map((ins, i) => `${i + 1}. ${ins}`).join('\n')}`,
      },
    ], 0.8);

    return text || 'The narrative remains unwritten.';
  } catch (error) {
    console.error('Weekly Summary Error:', error);
    throw error;
  }
}

export async function getAIOverview(inspirations: string[] = [], existingThemes: string[] = [], lang: OutputLanguage = 'zh') {
  try {
    const isZh = lang === 'zh';
    const sectionLabels = isZh
      ? {
          conflict: '核心冲突（一句话）',
          thoughts: '关键自动思维',
          patterns: '情绪与行为模式',
          biases: '认知偏差',
          resources: '已有资源（优势）',
          leverage: '关键杠杆（最重要）',
          reframe: '替代视角（重构一句话）',
          emotion: '情绪',
          behavior: '行为',
        }
      : {
          conflict: 'Core Conflict (one sentence)',
          thoughts: 'Key Automatic Thoughts',
          patterns: 'Emotion & Behavior Patterns',
          biases: 'Cognitive Distortions',
          resources: 'Existing Resources (Strengths)',
          leverage: 'Key Leverage (Most Important)',
          reframe: 'Alternative Perspective (Reframe in one sentence)',
          emotion: 'Emotions',
          behavior: 'Behaviors',
        };

    const lengthRule = isZh
      ? '总长度严格控制在 400-600 个汉字之间。'
      : 'Total length must stay within 400-600 words.';

    const summaryTemplate = isZh
      ? `summary 必须是一段 markdown 文本，按以下顺序使用 \`### 【小标题】\` 形式分段。每个小标题下面必须是一小段连贯的话（1-3 句），不要使用 bullet point / 列表 / 子条目 / 加粗子项，也不要长段堆砌或重复：
1. ### 【${sectionLabels.conflict}】 — 用 1-2 句话概括最本质的心理矛盾或主题。
2. ### 【${sectionLabels.thoughts}】 — 用一小段话（1-3 句）描述最有影响力的负性/限制性思维，自然衔接，不分条。
3. ### 【${sectionLabels.patterns}】 — 用一小段话（2-3 句）说明 2-4 个核心情绪以及 1-2 种典型反应模式（如回避、过度规划等），融合在同一段里叙述，不要拆成"情绪/行为"两条。
4. ### 【${sectionLabels.biases}】 — 用一小段话（1-3 句）指出 1-2 个最关键的认知扭曲类型（如全或无思维、应当化、灾难化等）并简要说明其表现。
5. ### 【${sectionLabels.resources}】 — 用一小段话（1-2 句）提炼用户已经具备的能力或信念。
6. ### 【${sectionLabels.leverage}】 — 用一小段话（1-2 句）指出最值得改变的 1-2 个关键点（优先级最高）。
7. ### 【${sectionLabels.reframe}】 — 用一句更健康、有力量的认知替代表达。`
      : `summary must be a single markdown string with the following sections in order, each as \`### [Title]\`. Under each heading write one short coherent paragraph (1-3 sentences) — never use bullet points, lists, sub-items, or bolded sub-labels. Avoid long paragraphs, repetition, and theory dumping:
1. ### [${sectionLabels.conflict}] — A short paragraph (1-2 sentences) summarizing the most essential psychological tension or theme.
2. ### [${sectionLabels.thoughts}] — A short paragraph (1-3 sentences) describing the most influential negative/limiting thoughts in flowing prose — do not split into a list.
3. ### [${sectionLabels.patterns}] — A short paragraph (2-3 sentences) covering 2-4 core emotions together with 1-2 typical response patterns (e.g., avoidance, over-planning), woven into the same paragraph rather than split into emotion/behavior bullets.
4. ### [${sectionLabels.biases}] — A short paragraph (1-3 sentences) calling out 1-2 most critical cognitive distortions (e.g., all-or-nothing, shoulds, catastrophizing) with a brief description of how they show up.
5. ### [${sectionLabels.resources}] — A short paragraph (1-2 sentences) on capabilities/beliefs the user already has.
6. ### [${sectionLabels.leverage}] — A short paragraph (1-2 sentences) on the 1-2 highest-priority change points.
7. ### [${sectionLabels.reframe}] — One healthier, more empowering alternative thought.`;

    const text = await callDeepSeek([
      {
        role: 'system',
        content:
          `You are Echo, a CBT-grounded reflective coach. ${jsonLanguageInstruction(lang)} Apply Cognitive Behavioral Therapy strictly: identify automatic thoughts, cognitive distortions, emotions, behaviors, and leverage points. Base every conclusion only on the provided inspirations — never invent facts. Prefer merging into existing themes when meaning overlaps. The output must be a structured, concise insight report — focused on insight and structure, not exhaustive enumeration. Return strictly valid JSON only.`,
      },
      {
        role: 'user',
        content: `Generate a structured, concise CBT insight report. Return JSON only (no explanatory text).

Required top-level keys:
- title: a short descriptive title.
- summary: ${summaryTemplate}
- insights: array of 1-3 objects {theme, cognitivePattern, emotionalSignal, behavioralPattern, examples: [indices], alternativePerspective}. Keep each field to one short sentence.
- recurringThemes: array of 1-3 objects {theme, examples: [indices], meaning}. One sentence per meaning.
- recommendedActions: array of 1-2 short, CBT-style actions {objective, stepByStep (2-3 brief steps), measurement}. The action should target the "Key Leverage" identified in summary.

Hard constraints:
- ${lengthRule}
- Under each \`### [Title]\` write one short coherent paragraph (1-3 sentences). Do NOT use bullet points, numbered lists, sub-items, or bolded sub-labels under section headings.
- Each section keeps only the 1-3 most critical points, expressed as flowing prose.
- Avoid: long explanations, repetition, excessive theory.
- Focus on insight and structure, not exhaustive coverage.
- If evidence is ambiguous, say so briefly instead of forcing a conclusion.

Existing themes to merge into when relevant (prefer reuse over duplication):
${(existingThemes || []).map((t, idx) => `${idx + 1}. ${t}`).join('\n') || 'None'}

Use only the following inspirations as evidence:
${(inspirations || []).map((i, idx) => `${idx + 1}. ${i}`).join('\n')}`,
      },
    ], 0.5);

    return tryParseJson(text);
  } catch (error) {
    console.error('AI Overview Error:', error);
    throw error;
  }
}

export async function getAINextAction(theme: string, report: any, completedAction?: string, conversationNotes?: string, lang: OutputLanguage = 'zh') {
  try {
    const prompt = `You are Echo, a CBT coach. ${jsonLanguageInstruction(lang)} Strictly use CBT reasoning: given the theme "${theme}", the report ${JSON.stringify(report)},` +
      `${completedAction ? ` the user completed: "${completedAction}".` : ''}` +
      `${conversationNotes ? ` conversation notes: "${conversationNotes}".` : ''}` +
      `\nProduce a concise CBT-style next action as JSON: { nextAction: string, rationale: string, steps: [string], measurement: string }.\n- nextAction must be short: 20-30 Chinese characters when in zh mode, or one short English sentence when in en mode.\n- rationale: 1 sentence linking the action to the CBT target (thought/belief/behavior).\n- steps: 2-4 clear step-by-step instructions.\n- measurement: how the user should record progress (e.g., frequency, brief journal prompt).\nReturn JSON only.`;

    const text = await callDeepSeek([
      { role: 'system', content: 'You are a CBT-focused practical coach. Be specific, behavioral, and measurable.' },
      { role: 'user', content: prompt },
    ], 0.5);

    const parsed = tryParseJson(text) as { nextAction?: string };
    return parsed || (typeof text === 'string' ? text : { nextAction: '做一个小而具体的行动' });
  } catch (error) {
    console.error('AI Next Action Error:', error);
    return { nextAction: '做一个小而具体的行动' };
  }
}

export async function askAboutText(content: string, question: string, lang: OutputLanguage = 'zh') {
  try {
    const text = await callDeepSeek([
      {
        role: 'system',
        content: `You are a thoughtful personal growth assistant. ${languageInstruction(lang)} Be practical and encouraging.`,
      },
      {
        role: 'user',
        content: `Captured Thought: "${content}"\nQuestion: "${question}"`,
      },
    ], 0.7);

    return text || "I'm sorry, I couldn't process that request.";
  } catch (error) {
    console.error('AI Question Error:', error);
    throw error;
  }
}

export async function continueChat(history: { role: 'user' | 'model', text: string }[] = [], nextMessage: string = '', lang: OutputLanguage = 'zh') {
  try {
    const historyMessages: ChatMessage[] = (history || []).map((h) => ({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: h.text,
    }));

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          `You are Echo, a personal growth companion focused on introspection, clarity, and relationship mapping. ${languageInstruction(lang)} Keep responses concise, poetic yet practical, and focused on the user's evolution.`,
      },
      ...historyMessages,
      {
        role: 'user',
        content: nextMessage,
      },
    ];

    const text = await callDeepSeek(messages, 0.7);
    const cleaned = stripChatWrapping(text);

    return cleaned || "I couldn't generate a response.";
  } catch (error) {
    console.error('AI Chat Error:', error);
    throw error;
  }
}
