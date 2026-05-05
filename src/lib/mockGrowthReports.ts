/**
 * Mock weekly and monthly growth reports used while the AI generation
 * pipeline is being wired up. They are intentionally rich so the page
 * can be designed against realistic content.
 */

import { GrowthReport } from '../types';

const day = 24 * 60 * 60 * 1000;

const now = Date.now();
const todayStart = new Date(now);
todayStart.setHours(0, 0, 0, 0);
const todayMs = todayStart.getTime();

const fmtDate = (ms: number) => {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const weekRange = (offset: number) => {
  const end = todayMs - offset * 7 * day;
  const start = end - 6 * day;
  return { periodStart: fmtDate(start), periodEnd: fmtDate(end), createdAt: end + 18 * 60 * 60 * 1000 };
};

const monthRange = (offset: number) => {
  const ref = new Date(todayMs);
  ref.setDate(1);
  ref.setMonth(ref.getMonth() - offset);
  const start = new Date(ref);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  return { periodStart: fmtDate(start.getTime()), periodEnd: fmtDate(end.getTime()), createdAt: end.getTime() };
};

export const MOCK_GROWTH_REPORTS: GrowthReport[] = [
  // ───────────── Weekly #1 (this week) ─────────────
  (() => {
    const r = weekRange(0);
    return {
      id: 'mock-w-001',
      kind: 'weekly',
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      createdAt: r.createdAt,
      source: 'mock',
      title: '这一周：在不确定中找节奏',
      headline: '你正在学习把"模糊感"切成可执行的一小步。',
      summary:
        '本周你在工作选择和亲密关系两条线上都出现了反复。Echo 注意到，每当你把焦虑写下来，会很快主动收敛到"下一步可以做什么"。你不是被困住，你只是希望先确认方向。',
      highlights: [
        '主动把"要不要换组"这件事拆成 3 个调研动作，并完成了 2 个',
        '在和伴侣的争执后，第二天主动开启了一次复盘对话',
        '本周新增 9 条灵感，其中 4 条与"自我边界"相关',
      ],
      themes: [
        { name: '自我边界', description: '你开始用更具体的语言描述"我能接受到哪里"。' },
        { name: '职业方向', description: '焦虑明显，但每次都会落地到一个可验证的小动作。' },
      ],
      emotionalTone: '焦虑偏多，但伴随明显的自我安抚倾向。',
      tags: ['career', 'emotion', 'self'],
      inspirations: [
        {
          id: 'mock-ins-w1-1',
          content:
            '今天又被拉去做不属于我的事情。我没拒绝，但整晚都在反刍。也许下次我可以先说"我先看一下我手头的优先级"，而不是立刻答应。',
          tags: ['career', 'self'],
          createdAt: r.createdAt - 2 * day,
        },
        {
          id: 'mock-ins-w1-2',
          content:
            '我们吵架的真正原因不是那件事本身，而是我没有被听到。下次我想先描述感受，再说事实。',
          tags: ['emotion', 'relationship'],
          createdAt: r.createdAt - 3 * day,
        },
        {
          id: 'mock-ins-w1-3',
          content: '我发现我害怕"做选择"，但其实我只是害怕"做错"。',
          tags: ['self', 'choice'],
          createdAt: r.createdAt - 4 * day,
        },
        {
          id: 'mock-ins-w1-4',
          content: '把"换组"拆成：找 A 聊、看 JD、问 mentor。今天先做第一项。',
          tags: ['career'],
          createdAt: r.createdAt - 5 * day,
        },
      ],
      conversations: [
        {
          id: 'mock-conv-w1-1',
          title: '为什么我总是先说好',
          preview:
            '我知道我应该拒绝，但每次都会先说"好"。这周我想试着停 3 秒再回复...',
          createdAt: r.createdAt - 2 * day + 3 * 60 * 60 * 1000,
        },
        {
          id: 'mock-conv-w1-2',
          title: '换组之前需要确认什么',
          preview: '帮我把这个决定的关键变量列出来：影响范围、可逆性、机会成本...',
          createdAt: r.createdAt - 4 * day,
        },
      ],
    };
  })(),

  // ───────────── Weekly #2 (last week) ─────────────
  (() => {
    const r = weekRange(1);
    return {
      id: 'mock-w-002',
      kind: 'weekly',
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      createdAt: r.createdAt,
      source: 'mock',
      title: '上周：被打断也能回到自己',
      headline: '这周的关键词是"恢复"——你比想象的更快回到了状态。',
      summary:
        '上周开头你被一次会议打乱，整整两天处于内耗。但你在第三天主动把节奏调回来——下班去爬山、关掉群聊、把 to-do 改成 3 项。',
      highlights: [
        '识别出"内耗的入口"是在被否定后立刻打开手机',
        '尝试了一种新的断点：早晨先写 5 行才开始处理消息',
        '第一次在记录里写下"我做得已经够多了"',
      ],
      themes: [
        { name: '注意力管理', description: '你开始保护早晨的第一小时。' },
        { name: '自我接纳' },
      ],
      emotionalTone: '从挫败回到自我同情。',
      tags: ['self', 'pressure', 'growth'],
      inspirations: [
        {
          id: 'mock-ins-w2-1',
          content: '今天那场会让我整个人很紧。我意识到，我不需要在被否定的那一刻就给出反应。',
          tags: ['emotion', 'pressure'],
          createdAt: r.createdAt - 6 * day,
        },
        {
          id: 'mock-ins-w2-2',
          content: '关掉群聊一小时，世界并不会塌。',
          tags: ['self'],
          createdAt: r.createdAt - 5 * day,
        },
        {
          id: 'mock-ins-w2-3',
          content: '我做得已经够多了。',
          tags: ['self', 'growth'],
          createdAt: r.createdAt - 3 * day,
        },
      ],
      conversations: [
        {
          id: 'mock-conv-w2-1',
          title: '怎么不让一句话毁掉一整天',
          preview: '我想找一个方法在被否定的瞬间不立刻反弹...',
          createdAt: r.createdAt - 5 * day,
        },
      ],
    };
  })(),

  // ───────────── Weekly #3 (two weeks ago) ─────────────
  (() => {
    const r = weekRange(2);
    return {
      id: 'mock-w-003',
      kind: 'weekly',
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      createdAt: r.createdAt,
      source: 'mock',
      title: '两周前：第一次主动求助',
      headline: '你打破了"什么都自己扛"的旧模式。',
      summary:
        '这一周你做了一件以前不会做的事：主动跟朋友说"我最近不太好"。这个动作之后，你的灵感记录从"分析"变成了"感受"。',
      highlights: [
        '主动联系了一个许久未见的朋友',
        '记录开始出现身体感受：肩膀紧、胃口差',
        '把"要不要去看心理咨询"具体到了"先约一次咨询师"',
      ],
      themes: [
        { name: '求助的能力' },
        { name: '身心觉察' },
      ],
      emotionalTone: '低落但开始流动。',
      tags: ['emotion', 'friendship', 'health'],
      inspirations: [
        {
          id: 'mock-ins-w3-1',
          content: '"你最近怎么样？" 我居然认真回答了，没有说"还行"。',
          tags: ['friendship', 'emotion'],
          createdAt: r.createdAt - 4 * day,
        },
        {
          id: 'mock-ins-w3-2',
          content: '这周我的肩膀一直是紧的。也许身体比我先知道。',
          tags: ['health', 'self'],
          createdAt: r.createdAt - 2 * day,
        },
      ],
      conversations: [
        {
          id: 'mock-conv-w3-1',
          title: '我是不是该找咨询师聊聊',
          preview: '我不知道这个状态算不算需要专业帮助...',
          createdAt: r.createdAt - 3 * day,
        },
        {
          id: 'mock-conv-w3-2',
          title: '怎么和朋友开口说"我最近不好"',
          preview: '我想说，但又不想被当作脆弱...',
          createdAt: r.createdAt - 5 * day,
        },
      ],
    };
  })(),

  // ───────────── Monthly #1 (this month) ─────────────
  (() => {
    const r = monthRange(0);
    return {
      id: 'mock-m-001',
      kind: 'monthly',
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      createdAt: r.createdAt,
      source: 'mock',
      title: '本月成长地图：从"对抗"到"共处"',
      headline: '这一个月你最大的变化是：不再要求自己快速好起来。',
      summary:
        '过去四周，你的语言里出现了一个明显的转变。月初你常用"我应该"、"我必须"，到了月底变成"我注意到"、"也许"。Echo 在你身上看到一个低调但稳定的趋势：你开始允许情绪存在，而不是赶走它。',
      highlights: [
        '本月共记录 31 条灵感，其中 12 条围绕"自我边界"',
        '与"职业焦虑"相关的灵感数量从月初的 9 条降到月末的 3 条',
        '主动开启的对话数量翻倍（从 4 → 9）',
        '出现 3 次"今天我做得已经够好了"这一类的自我肯定语句',
      ],
      themes: [
        { name: '自我边界', description: '从描述别人，到描述自己——你的语言重心在内移。' },
        { name: '职业认同', description: '焦虑还在，但从"被评价"转向"被定义"。' },
        { name: '亲密关系', description: '冲突变少不是因为压抑，而是因为你更早地表达感受。' },
      ],
      emotionalTone: '从紧绷向松弛过渡，仍有反复，但底色更稳。',
      growthAreas: [
        '允许"完成度 70%" 也算完成',
        '识别"我现在不想说话"并坦然表达',
        '把对自己的评价权从老板/伴侣手里收回来',
      ],
      tags: ['self', 'career', 'emotion', 'growth'],
      inspirations: [
        {
          id: 'mock-ins-m1-1',
          content: '我注意到，我现在能在被否定的时候停 3 秒了。这 3 秒很重要。',
          tags: ['self', 'growth'],
          createdAt: r.createdAt - 5 * day,
        },
        {
          id: 'mock-ins-m1-2',
          content: '"做得不够好"和"还不够多"是两种不同的焦虑。我以前一直把它们混在一起。',
          tags: ['career', 'self'],
          createdAt: r.createdAt - 12 * day,
        },
        {
          id: 'mock-ins-m1-3',
          content: '我想被看见，但不想被评价。原来这两件事可以分开。',
          tags: ['emotion', 'relationship'],
          createdAt: r.createdAt - 18 * day,
        },
        {
          id: 'mock-ins-m1-4',
          content: '今天我没有写完，我也没有补救。我只是关掉电脑去散步。',
          tags: ['self', 'growth'],
          createdAt: r.createdAt - 22 * day,
        },
        {
          id: 'mock-ins-m1-5',
          content: '我开始接受：有些事我就是没那么想做，不是懒，是真的不想。',
          tags: ['self'],
          createdAt: r.createdAt - 26 * day,
        },
      ],
      conversations: [
        {
          id: 'mock-conv-m1-1',
          title: '我是不是太容易自我攻击',
          preview: '每次出错我都先骂自己一遍。我想换一种方式...',
          createdAt: r.createdAt - 6 * day,
        },
        {
          id: 'mock-conv-m1-2',
          title: '帮我把"要不要换工作"拆开',
          preview: '我想看清楚这是逃避还是合理选择...',
          createdAt: r.createdAt - 14 * day,
        },
        {
          id: 'mock-conv-m1-3',
          title: '怎么和伴侣谈"我需要空间"',
          preview: '我担心他会觉得我在拉远距离...',
          createdAt: r.createdAt - 20 * day,
        },
      ],
    };
  })(),

  // ───────────── Monthly #2 (last month) ─────────────
  (() => {
    const r = monthRange(1);
    return {
      id: 'mock-m-002',
      kind: 'monthly',
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      createdAt: r.createdAt,
      source: 'mock',
      title: '上月成长地图：从"忍耐"到"识别"',
      headline: '上个月，你完成了从"我没事"到"我有点事"的诚实。',
      summary:
        '上一个月的关键转变是：你停止使用"还好"作为默认答案。你的灵感里第一次大量出现"其实……"开头的句子。这是一次诚实的扩张。',
      highlights: [
        '"还好/没事/挺好的"在记录中出现频次下降 60%',
        '出现 7 次以"其实"开头的反思',
        '第一次主动写下"我害怕"',
      ],
      themes: [
        { name: '诚实', description: '对自己的语言变直接了。' },
        { name: '羞耻', description: '开始辨认羞耻和内疚的差别。' },
      ],
      emotionalTone: '低落但不再压抑。',
      growthAreas: [
        '继续练习区分"事实"和"自我评价"',
        '在表达脆弱后，不立刻开玩笑化解',
      ],
      tags: ['self', 'emotion', 'growth'],
      inspirations: [
        {
          id: 'mock-ins-m2-1',
          content: '其实我不是不想去，我是怕去了被忽视。',
          tags: ['emotion', 'friendship'],
          createdAt: r.createdAt - 8 * day,
        },
        {
          id: 'mock-ins-m2-2',
          content: '我害怕。今天就让自己写下来这两个字。',
          tags: ['self', 'emotion'],
          createdAt: r.createdAt - 16 * day,
        },
      ],
      conversations: [
        {
          id: 'mock-conv-m2-1',
          title: '羞耻和内疚有什么区别',
          preview: '我想搞清楚，到底是哪一种在折磨我...',
          createdAt: r.createdAt - 10 * day,
        },
      ],
    };
  })(),
];

export function getMockGrowthReports(): GrowthReport[] {
  return MOCK_GROWTH_REPORTS.slice().sort((a, b) => b.createdAt - a.createdAt);
}
