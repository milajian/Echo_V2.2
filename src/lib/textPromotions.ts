export type PromotedTextKind = 'theme' | 'goal' | 'inspiration';

export function shortenText(text: string, maxLength = 24) {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function buildGoalPayload(text: string, sourceLabel: string) {
  const cleanText = text.trim();
  return {
    title: shortenText(cleanText, 32),
    description: `来源于${sourceLabel}：${cleanText}`,
    status: 'active' as const,
  };
}

export function buildInspirationPayload(text: string) {
  const cleanText = text.trim();
  return {
    content: cleanText,
    type: 'text' as const,
    tags: [],
    personId: null,
  };
}

export function buildThemeReportPayload(text: string, sourceLabel: string) {
  const cleanText = text.trim();
  const title = shortenText(cleanText, 28) || '人生课题';

  return {
    reportType: 'seed_theme',
    title,
    summary: cleanText,
    report: {
      title,
      summary: cleanText,
      seedText: cleanText,
      sourceLabel,
      recurringThemes: [{ theme: title, examples: [] }],
      insights: [],
      recommendedActions: [],
      createdAt: Date.now(),
    },
    sourceIds: [],
    scope: {
      sourceLabel,
      count: 1,
      kind: 'manual_seed',
    },
    createdAt: Date.now(),
  };
}