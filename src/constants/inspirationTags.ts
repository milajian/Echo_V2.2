export interface InspirationTagDefinition {
  key: string;
  zh: string;
  en: string;
}

export const INSPIRATION_TAGS: InspirationTagDefinition[] = [
  { key: 'relationship', zh: '关系', en: 'Relationship' },
  { key: 'career', zh: '职业', en: 'Career' },
  { key: 'emotion', zh: '感情', en: 'Emotion' },
  { key: 'life', zh: '人生', en: 'Life' },
  { key: 'family', zh: '家庭', en: 'Family' },
  { key: 'friendship', zh: '友情', en: 'Friendship' },
  { key: 'growth', zh: '成长', en: 'Growth' },
  { key: 'learning', zh: '学习', en: 'Learning' },
  { key: 'health', zh: '健康', en: 'Health' },
  { key: 'finance', zh: '金钱', en: 'Finance' },
  { key: 'creativity', zh: '创意', en: 'Creativity' },
  { key: 'pressure', zh: '压力', en: 'Pressure' },
  { key: 'future', zh: '未来', en: 'Future' },
  { key: 'choice', zh: '抉择', en: 'Choice' },
  { key: 'self', zh: '自我', en: 'Self' },
  { key: 'echo', zh: 'Echo', en: 'Echo' },
];

export const AHA_MOMENT_TAG_KEY = 'echo';

export function isAhaMomentTag(tag: string) {
  return tag === AHA_MOMENT_TAG_KEY;
}

export const INSPIRATION_TAG_KEYS = INSPIRATION_TAGS.map((tag) => tag.key);

export function canonicalizeInspirationTag(tag: string) {
  const normalized = tag.trim().toLowerCase();
  const match = INSPIRATION_TAGS.find((entry) => {
    return [entry.key, entry.zh, entry.en].some((value) => value.toLowerCase() === normalized);
  });

  return match?.key || '';
}

export function normalizeInspirationTags(tags: unknown, fallback: string[] = ['life']) {
  if (!Array.isArray(tags)) {
    return fallback;
  }

  const normalized = tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => canonicalizeInspirationTag(tag))
    .filter(Boolean);

  const unique = Array.from(new Set(normalized)).slice(0, 3);
  return unique.length > 0 ? unique : fallback;
}

export function getInspirationTagLabel(tag: string, lang: 'zh' | 'en' = 'zh') {
  return INSPIRATION_TAGS.find((entry) => entry.key === tag)?.[lang] || tag;
}