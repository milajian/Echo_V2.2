/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, Mic, Sparkles, X, ChevronRight, Users, MessageSquare, Trash2, Tag, Calendar, SlidersHorizontal, LayoutGrid, LayoutList, ArrowUp, ArrowDown, List } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { useCollection, addDocument, deleteDocument, updateDocument } from '../../hooks/useFirebase';
import { ConversationSeed, Inspiration, Person } from '../../types';
import { getAIInsight, getAIInspirationTags, getAIOverview } from '../../services/gemini';
import { format } from 'date-fns';
import { INSPIRATION_TAGS, getInspirationTagLabel, isAhaMomentTag, normalizeInspirationTags } from '../../constants/inspirationTags';
import { buildGoalPayload, buildInspirationPayload, buildThemeReportPayload } from '../../lib/textPromotions';

const reportMarkdownComponents = {
  h1: ({ node, ...props }: any) => <h3 className="mt-4 first:mt-0 mb-2 text-base font-semibold text-stone-800" {...props} />,
  h2: ({ node, ...props }: any) => <h3 className="mt-4 first:mt-0 mb-2 text-base font-semibold text-stone-800" {...props} />,
  h3: ({ node, ...props }: any) => <h3 className="mt-4 first:mt-0 mb-2 text-base font-semibold text-stone-800" {...props} />,
  h4: ({ node, ...props }: any) => <h4 className="mt-3 first:mt-0 mb-1.5 text-sm font-semibold text-stone-800" {...props} />,
  p: ({ node, ...props }: any) => <p className="mb-2 last:mb-0 leading-relaxed text-stone-700" {...props} />,
  ul: ({ node, ...props }: any) => <ul className="list-disc pl-5 mb-2 last:mb-0 space-y-1" {...props} />,
  ol: ({ node, ...props }: any) => <ol className="list-decimal pl-5 mb-2 last:mb-0 space-y-1" {...props} />,
  li: ({ node, ...props }: any) => <li className="leading-relaxed text-stone-700" {...props} />,
  strong: ({ node, ...props }: any) => <strong className="font-semibold text-stone-800" {...props} />,
};

interface InspirationHubProps {
  lang?: 'zh' | 'en';
  onStartConversation: (seed: Omit<ConversationSeed, 'id'>) => void;
  onOpenExistingConversation?: (conversationId: string) => void;
  onViewReportsForTag?: (tag: string) => void;
  pendingFocusInspiration?: { id: string; nonce: number } | null;
  onPendingFocusInspirationConsumed?: () => void;
}

interface ConversationSummary {
  id: string;
  inspirationId?: string | null;
}

type InspirationSection = { key: string; label: string; items: Inspiration[] };

function groupInspirationsByPrimaryTag(items: Inspiration[], lang: 'zh' | 'en', sortOrder: 'newest' | 'oldest'): InspirationSection[] {
  const map = new Map<string, Inspiration[]>();
  for (const ins of items) {
    const tagKeys = normalizeInspirationTags(ins.tags, []);
    let primary: string | null = null;
    for (const def of INSPIRATION_TAGS) {
      if (tagKeys.includes(def.key)) {
        primary = def.key;
        break;
      }
    }
    if (!primary) {
      primary = tagKeys[0] ?? '__untagged__';
    }
    if (!map.has(primary)) map.set(primary, []);
    map.get(primary)!.push(ins);
  }
  // items are pre-sorted by sortOrder, so items[0] is the leading (newest or oldest) card per group.
  // Order sections by that leading card's createdAt, following the same direction as sortOrder.
  const orderedKeys = Array.from(map.keys()).sort((a, b) => {
    const at = map.get(a)![0].createdAt;
    const bt = map.get(b)![0].createdAt;
    return sortOrder === 'newest' ? bt - at : at - bt;
  });
  return orderedKeys.map((tagKey) => ({
    key: tagKey,
    label: tagKey === '__untagged__' ? (lang === 'zh' ? '未分类' : 'Uncategorized') : getInspirationTagLabel(tagKey, lang),
    items: map.get(tagKey)!,
  }));
}

function groupInspirationsByDate(items: Inspiration[], lang: 'zh' | 'en'): InspirationSection[] {
  const map = new Map<string, { label: string; items: Inspiration[] }>();
  for (const ins of items) {
    const d = new Date(ins.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = format(d, lang === 'zh' ? 'yyyy年M月' : 'MMMM yyyy');
    if (!map.has(key)) map.set(key, { label, items: [] });
    map.get(key)!.items.push(ins);
  }
  return Array.from(map.entries()).map(([key, val]) => ({ key, label: val.label, items: val.items }));
}

export default function InspirationHub({ lang = 'zh', onStartConversation, onOpenExistingConversation, onViewReportsForTag, pendingFocusInspiration, onPendingFocusInspirationConsumed }: InspirationHubProps) {
  const isZh = lang === 'zh';
  const { data: inspirations, loading } = useCollection<Inspiration>('inspirations');
  const { data: people } = useCollection<Person>('people');
  const { data: insightReports } = useCollection<any>('insightReports');
  const { data: conversations } = useCollection<ConversationSummary>('conversations', 'updatedAt');

  const conversationByInspirationId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of conversations) {
      if (c?.inspirationId && !map[c.inspirationId]) map[c.inspirationId] = c.id;
    }
    return map;
  }, [conversations]);
  const [optimisticInspirations, setOptimisticInspirations] = useState<Array<Inspiration & { optimistic?: boolean }>>([]);
  const [content, setContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState('all');
  const [viewMode, setViewMode] = useState<'gallery' | 'list'>('gallery');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [groupBy, setGroupBy] = useState<'none' | 'tag' | 'date'>('none');
  const [viewSettingsOpen, setViewSettingsOpen] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [insights, setInsights] = useState<Record<string, any>>({});
  const [aiError, setAiError] = useState<string>('');
  
  const [selectedIns, setSelectedIns] = useState<Inspiration | null>(null);
  
  // Card Expansion State for long text
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const taggingQueueRef = useRef(new Set<string>());

  const [selectionPosition, setSelectionPosition] = useState<{ x: number, y: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const selectionMenuRef = useRef<HTMLDivElement | null>(null);
  const [aiInsightOpen, setAiInsightOpen] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [aiReport, setAiReport] = useState<any | null>(null);

  const normalizeInsightReport = (report: any, sourceInspirations: Inspiration[], scopeTag: string) => ({
    title: report?.title || (isZh ? 'AI 洞察报告' : 'AI Insight Report'),
    summary: report?.summary || report?.insight || (isZh ? '暂时没有可展示的总结内容。' : 'No summary is available yet.'),
    insights: Array.isArray(report?.insights) ? report.insights : [],
    recurringThemes: Array.isArray(report?.recurringThemes) ? report.recurringThemes : [],
    recommendedActions: Array.isArray(report?.recommendedActions) ? report.recommendedActions : [],
    sourceIds: sourceInspirations.map((item) => item.id),
    scope: {
      tag: scopeTag,
      query: searchQuery,
      count: sourceInspirations.length,
    },
    createdAt: Date.now(),
  });

  function aggregateContext() {
    // Prefer selected detail's AI insight if available, otherwise aggregate visible inspirations
    if (selectedIns && insights[selectedIns.id]) {
      return insights[selectedIns.id].insight || selectedIns.content;
    }

    const items = (visibleInspirations || []).slice(0, 8).map((i) => i.content);
    return items.join('\n\n');
  }

  const generateReport = async () => {
    setIsGeneratingReport(true);
    setAiReport(null);
    try {
      const items = visibleInspirations.map((i) => i.content);
      const report = normalizeInsightReport(await getAIOverview(items, [], lang), visibleInspirations, activeTag);
      setAiReport(report);

      // persist report to server with source ids
      try {
        await addDocument('insightReports', {
          reportType: 'inspiration_overview',
          title: report.title,
          summary: report.summary,
          report,
          sourceIds: report.sourceIds,
          scope: report.scope,
          createdAt: report.createdAt,
        });
      } catch (err) {
        console.error('Failed to save report to DB', err);
      }
    } catch (err) {
      console.error('Report generation failed', err);
      setAiReport({ error: '生成失败，请稍后重试。' });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    window.requestAnimationFrame(() => {
      const selection = window.getSelection()?.toString().trim();
      if (selection && selection.length > 5) {
        setSelectedText(selection);
        const range = window.getSelection()?.getRangeAt(0);
        const rect = range?.getBoundingClientRect();
        if (rect) {
          setSelectionPosition({
            x: rect.left + rect.width / 2,
            y: rect.top + window.scrollY - 40,
          });
        }
      } else {
        setSelectionPosition(null);
      }
    });
  };

  const truncateTitle = (text: string, n = 20) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return '';
    return trimmed.length <= n ? trimmed : trimmed.slice(0, n) + '…';
  };

  const startConversation = (content: string, question: string, titleSource?: string, tags?: string[], inspirationId?: string) => {
    const titleBase = titleSource ?? content ?? question ?? '';
    const title = truncateTitle(titleBase) || (isZh ? '新对话' : 'New chat');
    onStartConversation({ title, question, content, tags: tags && tags.length > 0 ? tags : undefined, inspirationId });
    setSelectedIns(null);
    setAiInsightOpen(false);
    clearSelection();
  };

  const continueConversation = (conversationId: string) => {
    onOpenExistingConversation?.(conversationId);
    setSelectedIns(null);
    setAiInsightOpen(false);
    clearSelection();
  };

  const aggregateScopeTags = (): string[] => {
    if (selectedIns?.tags && selectedIns.tags.length > 0) return selectedIns.tags;
    if (activeTag && activeTag !== 'all') return [activeTag];
    return ['composite'];
  };

  const clearSelection = () => {
    setSelectionPosition(null);
    setSelectedText('');
  };

  useEffect(() => {
    if (!selectionPosition) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (selectionMenuRef.current && target && selectionMenuRef.current.contains(target)) {
        return;
      }
      clearSelection();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [selectionPosition]);

  const promoteSelectionToGoal = async () => {
    if (!selectedText.trim()) return;
    await addDocument('goals', {
      ...buildGoalPayload(selectedText, isZh ? '灵感页面' : 'Inspiration page'),
      userId: '',
    });
    clearSelection();
  };

  const promoteSelectionToInspiration = async () => {
    if (!selectedText.trim()) return;
    await addDocument('inspirations', {
      ...buildInspirationPayload(selectedText),
      userId: '',
    });
    clearSelection();
  };

  const promoteSelectionToTheme = async () => {
    if (!selectedText.trim()) return;
    await addDocument('insightReports', buildThemeReportPayload(selectedText, isZh ? '灵感页面' : 'Inspiration page'));
    clearSelection();
  };

  useEffect(() => {
    if (!inspirations || inspirations.length === 0) return;
    setInsights((prev) => {
      let changed = false;
      const next = { ...prev };
      inspirations.forEach((ins) => {
        if (ins.aiInsight && !next[ins.id]) {
          next[ins.id] = ins.aiInsight;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [inspirations]);

  useEffect(() => {
    if (!pendingFocusInspiration) return;
    const all = [...optimisticInspirations, ...(inspirations || [])];
    const found = all.find((ins) => ins.id === pendingFocusInspiration.id);
    if (!found) return;
    setSelectedIns(found);
    onPendingFocusInspirationConsumed?.();
  }, [pendingFocusInspiration, inspirations, optimisticInspirations]);

  useEffect(() => {
    const missingTagInspirations = (inspirations || []).filter((ins) => {
      return normalizeInspirationTags(ins.tags, []).length === 0 && !taggingQueueRef.current.has(ins.id);
    });

    missingTagInspirations.forEach(async (ins) => {
      taggingQueueRef.current.add(ins.id);
      try {
        const tags = await getAIInspirationTags(ins.content);
        await updateDocument('inspirations', ins.id, { tags });
      } catch (error) {
        console.error('Failed to backfill inspiration tags:', error);
      } finally {
        taggingQueueRef.current.delete(ins.id);
      }
    });
  }, [inspirations]);

  const handleAdd = async () => {
    if (!content.trim()) return;

    const draftId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setOptimisticInspirations((prev) => [
      {
        id: draftId,
        content,
        type: 'text',
        tags: [],
        userId: '',
        createdAt: Date.now(),
        optimistic: true,
      },
      ...prev,
    ]);

    try {
      const created = await addDocument('inspirations', {
        content,
        type: 'text',
        tags: [],
        personId: null,
      });

      if (created?.id) {
        setOptimisticInspirations((prev) =>
          prev.map((item) => (item.id === draftId ? { ...item, id: created.id } : item))
        );
      }
    } catch (error) {
      console.error('Failed to add inspiration:', error);
      setOptimisticInspirations((prev) => prev.filter((item) => item.id !== draftId));
      return;
    }

    setContent('');
    setIsExpanding(false);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Permanently remove this spark?')) {
      await deleteDocument('inspirations', id);
    }
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAIAnalyze = async (id: string, text: string) => {
    setIsAnalyzing(id);
    setAiError('');
    try {
      const insight = await getAIInsight(text, lang);
      if (!insight) {
        setAiError(isZh ? 'AI 返回为空，请重试。' : 'AI returned an empty result. Please try again.');
        return;
      }

      try {
        await updateDocument('inspirations', id, { aiInsight: insight });
      } catch (persistError: any) {
        console.error('Failed to persist AI insight:', persistError);
        setAiError(
          isZh
            ? `分析已完成但保存失败，请重试：${persistError?.message || ''}`
            : `Analysis complete but save failed, please retry: ${persistError?.message || ''}`,
        );
        return;
      }

      setInsights(prev => ({ ...prev, [id]: insight }));
      setExpandedCards(prev => ({ ...prev, [id]: true }));
    } catch (error: any) {
      console.error(error);
      setAiError(error?.message || (isZh ? '分析失败，请检查 AI 配置后重试。' : 'Analyze failed. Please check AI configuration and retry.'));
    } finally {
      setIsAnalyzing(null);
    }
  };

  const mergedInspirations = [...optimisticInspirations, ...(inspirations || [])];
  const uniqueInspirations = mergedInspirations.filter((ins, index, self) => self.findIndex((item) => item.id === ins.id) === index);

  const filteredInspirations = uniqueInspirations.filter((ins) => {
    const normalizedTags = normalizeInspirationTags(ins.tags, []);
    const matchesTag = activeTag === 'all' || normalizedTags.includes(activeTag);
    const matchesSearch = !searchQuery.trim()
      || ins.content.toLowerCase().includes(searchQuery.trim().toLowerCase())
      || normalizedTags.some((tag) => getInspirationTagLabel(tag, lang).toLowerCase().includes(searchQuery.trim().toLowerCase()));

    return matchesTag && matchesSearch;
  });

  const visibleInspirations = useMemo(() => {
    return [...filteredInspirations].sort((a, b) =>
      sortOrder === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt
    );
  }, [filteredInspirations, sortOrder]);

  const tagCounts = INSPIRATION_TAGS.reduce<Record<string, number>>((counts, tag) => {
    counts[tag.key] = (inspirations || []).filter((ins) => normalizeInspirationTags(ins.tags, []).includes(tag.key)).length;
    return counts;
  }, {});

  const inspirationSections = useMemo(
    () => {
      if (groupBy === 'none') return [];
      return groupBy === 'date'
        ? groupInspirationsByDate(visibleInspirations, lang)
        : groupInspirationsByPrimaryTag(visibleInspirations, lang, sortOrder);
    },
    [visibleInspirations, groupBy, lang, sortOrder],
  );

  const showSections = groupBy === 'date' || (groupBy === 'tag' && activeTag === 'all');

  const existingReportForTag = useMemo(() => {
    if (!Array.isArray(insightReports) || insightReports.length === 0) return null;
    const matches = insightReports.filter((rec: any) => {
      const scopeTag = rec?.scope?.tag ?? rec?.report?.scope?.tag;
      return (scopeTag || 'all') === activeTag;
    });
    if (matches.length === 0) return null;
    return matches.reduce((latest: any, rec: any) => {
      const t = rec.createdAt || rec.report?.createdAt || 0;
      const lt = latest.createdAt || latest.report?.createdAt || 0;
      return t > lt ? rec : latest;
    }, matches[0]);
  }, [insightReports, activeTag]);

  const hasNewInspirationsSinceReport = useMemo(() => {
    if (!existingReportForTag) return false;
    const reportSourceIds: string[] = Array.isArray(existingReportForTag.sourceIds)
      ? existingReportForTag.sourceIds
      : (Array.isArray(existingReportForTag.report?.sourceIds) ? existingReportForTag.report.sourceIds : []);
    const reportIdSet = new Set(reportSourceIds);
    return visibleInspirations.some((ins) => !reportIdSet.has(ins.id));
  }, [existingReportForTag, visibleInspirations]);

  const aiInsightButtonClass =
    'inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500 text-white font-bold hover:bg-amber-600 transition-all shadow-sm';

  const renderInspirationCard = (ins: Inspiration) => {
    const tagKeys = normalizeInspirationTags(ins.tags, []);
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => setSelectedIns(ins)}
        className="bg-white border border-stone-200 p-6 md:p-8 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all group flex flex-col h-64 relative cursor-pointer active:scale-95"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-[0.16em] font-semibold text-stone-500 drop-shadow-[0_0.4px_0.4px_rgba(255,255,255,0.35)]">
              {format(ins.createdAt, 'MMM dd, HH:mm')}
            </span>
            {ins.personId && (
              <span className="text-[10px] font-bold text-stone-400 flex items-center gap-1 mt-1">
                <Users size={10} />
                {people.find((p) => p.id === ins.personId)?.name || (isZh ? '已关联人物' : 'Linked Person')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-all">
            <button
              type="button"
              onClick={(e) => handleDelete(ins.id, e)}
              className="p-2 text-stone-200 hover:text-red-400 rounded-xl hover:bg-red-50 transition-colors"
            >
              <Trash2 size={16} />
            </button>
            {insights[ins.id] && <Sparkles size={16} className="text-amber-500" />}
          </div>
        </div>

        <p className="text-stone-800 font-serif leading-relaxed text-lg line-clamp-4">{ins.content}</p>

        {tagKeys.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {tagKeys.map((tag) => (
              <span
                key={tag}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                  isAhaMomentTag(tag)
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-stone-100 text-stone-500'
                }`}
              >
                {getInspirationTagLabel(tag, lang)}
              </span>
            ))}
          </div>
        )}

        {tagKeys.length === 0 && (
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold uppercase tracking-widest border border-amber-100 w-fit">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            {isZh ? '标签生成中' : 'Tagging...'}
          </div>
        )}

        <div className="mt-auto pt-4 flex items-center justify-between">
          <span className="text-[10px] font-semibold tracking-[0.14em] text-stone-500 uppercase transition-colors group-hover:text-stone-800">
            {isZh ? '查看详情' : 'View Details'}
          </span>
          <ChevronRight size={14} className="text-stone-400 group-hover:text-stone-900 group-hover:translate-x-1 transition-all" />
        </div>
      </motion.div>
    );
  };

  const renderInspirationListItem = (ins: Inspiration) => {
    const tagKeys = normalizeInspirationTags(ins.tags, []);
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => setSelectedIns(ins)}
        className="bg-white border border-stone-200 px-4 sm:px-5 py-4 rounded-2xl shadow-sm hover:shadow-md transition-all group flex items-center gap-4 cursor-pointer active:scale-[0.99]"
      >
        <div className="flex flex-col shrink-0 w-20 sm:w-28">
          <span className="text-[11px] uppercase tracking-[0.16em] font-semibold text-stone-500">
            {format(ins.createdAt, 'MMM dd')}
          </span>
          <span className="text-[10px] text-stone-400 mt-0.5">
            {format(ins.createdAt, 'HH:mm')}
          </span>
          {ins.personId && (
            <span className="text-[10px] font-bold text-stone-400 flex items-center gap-1 mt-1">
              <Users size={10} />
              <span className="truncate">{people.find((p) => p.id === ins.personId)?.name || (isZh ? '人物' : 'Person')}</span>
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-stone-800 font-serif leading-snug text-base line-clamp-2 break-words">{ins.content}</p>
          {tagKeys.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tagKeys.map((tag) => (
                <span
                  key={tag}
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    isAhaMomentTag(tag)
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  {getInspirationTagLabel(tag, lang)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {insights[ins.id] && <Sparkles size={14} className="text-amber-500" />}
          <button
            type="button"
            onClick={(e) => handleDelete(ins.id, e)}
            className="p-2 text-stone-200 hover:text-red-400 rounded-xl hover:bg-red-50 transition-colors md:opacity-0 md:group-hover:opacity-100"
          >
            <Trash2 size={16} />
          </button>
          <ChevronRight size={16} className="text-stone-300 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all" />
        </div>
      </motion.div>
    );
  };

  const renderInspirationItems = (items: Inspiration[]) => (
    viewMode === 'gallery' ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {items.map((ins) => (
          <React.Fragment key={ins.id}>{renderInspirationCard(ins)}</React.Fragment>
        ))}
      </div>
    ) : (
      <div className="flex flex-col gap-3">
        {items.map((ins) => (
          <React.Fragment key={ins.id}>{renderInspirationListItem(ins)}</React.Fragment>
        ))}
      </div>
    )
  );

  const optionBtnClass = (active: boolean) =>
    `flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
      active ? 'bg-stone-900 text-white border-stone-900 shadow-sm' : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400 hover:text-stone-800'
    }`;

  const emptyListHint = isZh ? '暂无符合条件的灵感。' : 'No inspirations match your filters.';

  return (
    <div className="px-3 sm:px-4 md:px-12 py-6 md:py-8 space-y-3 pb-32">
      <div className="space-y-3">
        <div className="shrink-0">
          <h2 className="text-2xl md:text-3xl font-serif text-stone-800 tracking-tight">{isZh ? '记下这一刻' : 'Inspiration Hub'}</h2>
          <p className="text-stone-400 text-sm mt-1 italic">{isZh ? '捕捉成长中的微光瞬间。' : 'Catch the whispers of your evolution.'}</p>
        </div>

        {/* Input Stage */}
        <motion.div
          layout
          className={`bg-white border border-stone-200 rounded-3xl sm:rounded-[2.5rem] shadow-xl overflow-hidden transition-all duration-500 ease-in-out ${
            isExpanding ? 'p-5 sm:p-8 ring-4 ring-stone-900/5' : 'p-4'
          }`}
        >
        {!isExpanding ? (
          <div className="flex items-center gap-4 cursor-text" onClick={() => setIsExpanding(true)}>
            <div className="w-12 h-12 bg-stone-50 rounded-2xl flex items-center justify-center text-stone-300">
              <Plus size={24} />
            </div>
            <span className="text-stone-300 font-serif italic text-lg">{isZh ? '最近有什么新的感受？' : "What's the latest whisper?"}</span>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400">{isZh ? '新灵感' : 'New Spark'}</span>
              <button onClick={() => setIsExpanding(false)} className="text-stone-300 hover:text-stone-600"><X size={20} /></button>
            </div>
            <textarea 
              autoFocus
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={isZh ? '你在想什么？把它记录下来...' : "What's on your mind? Capture the spark..."}
              className="w-full h-32 text-lg font-light text-stone-700 bg-transparent focus:outline-none resize-none"
            />
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between pt-4 border-t border-stone-50">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button className="p-2 text-stone-400 hover:bg-stone-50 rounded-lg"><Mic size={20} /></button>
              </div>
              <button 
                onClick={handleAdd}
                disabled={!content.trim()}
                className="w-full sm:w-auto bg-stone-900 text-stone-50 px-8 py-3 rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-stone-800 disabled:opacity-20 transition-all shadow-lg"
              >
                <Sparkles size={18} />
                {isZh ? '保存灵感' : 'Preserve'}
              </button>
            </div>
          </motion.div>
        )}
        </motion.div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTag('all')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all border ${
              activeTag === 'all'
                ? 'bg-stone-900 text-white border-stone-900 shadow-lg'
                : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400 hover:text-stone-800'
            }`}
          >
            <Tag size={12} />
            {isZh ? '全部' : 'All'}
          </button>
          {INSPIRATION_TAGS.map((tag) => {
            const count = tagCounts[tag.key] || 0;
            if (count === 0) return null;
            const isAha = isAhaMomentTag(tag.key);
            const isActive = activeTag === tag.key;

            return (
              <button
                key={tag.key}
                onClick={() => setActiveTag(tag.key)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all border ${
                  isActive
                    ? isAha
                      ? 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/30'
                      : 'bg-stone-900 text-white border-stone-900 shadow-lg'
                    : isAha
                      ? 'bg-amber-100 text-amber-800 border-amber-300 hover:border-amber-500 hover:bg-amber-200'
                      : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400 hover:text-stone-800'
                }`}
              >
                {getInspirationTagLabel(tag.key, lang)}
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${isActive ? 'bg-white/15' : isAha ? 'bg-amber-50 text-amber-700' : 'bg-stone-100'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Grid of Cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-64 bg-stone-50 rounded-[2.5rem] animate-pulse" />)}
          </div>
        ) : (
          <div className="pb-20 space-y-4">
          <div className="flex flex-row items-center gap-3 w-full">
            {visibleInspirations.length > 0 && (
              <div className="relative group shrink-0">
                <button type="button" onClick={() => setAiInsightOpen(true)} className={aiInsightButtonClass}>
                  <Sparkles size={16} />
                  {isZh ? 'AI 洞察' : 'AI Insight'}
                </button>
                <div role="tooltip" className="pointer-events-none absolute left-0 top-full mt-2 z-50 w-64 px-3 py-2 rounded-xl bg-stone-900 text-white text-xs leading-relaxed shadow-lg opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 transition-all">
                  {isZh
                    ? `点击「AI 洞察」将针对当前所选标签「${activeTag === 'all' ? '全部' : getInspirationTagLabel(activeTag, lang)}」下的灵感内容进行分析与汇总。`
                    : `Click "AI Insight" to analyze and summarize inspirations under the currently selected tag "${activeTag === 'all' ? 'All' : getInspirationTagLabel(activeTag, lang)}".`}
                  <span className="absolute -top-1 left-6 w-2 h-2 bg-stone-900 rotate-45" />
                </div>
              </div>
            )}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
              <input
                type="text"
                placeholder={isZh ? '搜索灵感...' : 'Search inspirations...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-stone-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/5 transition-all shadow-sm"
              />
            </div>
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setViewSettingsOpen((v) => !v)}
                aria-label={isZh ? '视图设置' : 'View settings'}
                className={`p-2.5 bg-white border rounded-2xl shadow-sm transition-colors ${
                  viewSettingsOpen ? 'border-stone-400 text-stone-900' : 'border-stone-100 text-stone-500 hover:text-stone-900 hover:border-stone-300'
                }`}
              >
                <SlidersHorizontal size={16} />
              </button>
              <AnimatePresence>
                {viewSettingsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setViewSettingsOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 z-50 w-64 bg-white border border-stone-100 rounded-2xl shadow-xl p-4 space-y-4"
                    >
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-2">
                          {isZh ? '显示方式' : 'View'}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => setViewMode('gallery')} className={optionBtnClass(viewMode === 'gallery')}>
                            <LayoutGrid size={14} />
                            {isZh ? '画廊' : 'Gallery'}
                          </button>
                          <button onClick={() => setViewMode('list')} className={optionBtnClass(viewMode === 'list')}>
                            <LayoutList size={14} />
                            {isZh ? '列表' : 'List'}
                          </button>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-2">
                          {isZh ? '排序' : 'Sort'}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => setSortOrder('newest')} className={optionBtnClass(sortOrder === 'newest')}>
                            <ArrowDown size={14} />
                            {isZh ? '从新到旧' : 'Newest'}
                          </button>
                          <button onClick={() => setSortOrder('oldest')} className={optionBtnClass(sortOrder === 'oldest')}>
                            <ArrowUp size={14} />
                            {isZh ? '从旧到新' : 'Oldest'}
                          </button>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-2">
                          {isZh ? '分组' : 'Group by'}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <button onClick={() => setGroupBy('none')} className={optionBtnClass(groupBy === 'none')}>
                            <List size={14} />
                            {isZh ? '无' : 'None'}
                          </button>
                          <button onClick={() => setGroupBy('tag')} className={optionBtnClass(groupBy === 'tag')}>
                            <Tag size={14} />
                            {isZh ? '标签' : 'Tag'}
                          </button>
                          <button onClick={() => setGroupBy('date')} className={optionBtnClass(groupBy === 'date')}>
                            <Calendar size={14} />
                            {isZh ? '日期' : 'Date'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
          {visibleInspirations.length === 0 ? (
            <p className="text-center text-stone-400 py-12">{emptyListHint}</p>
          ) : showSections ? (
            <div className="space-y-10 md:space-y-12">
              {inspirationSections.map(({ key, label, items }) => (
                <div key={key} className="space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">
                    {label}
                  </p>
                  {renderInspirationItems(items)}
                </div>
              ))}
            </div>
          ) : (
            renderInspirationItems(visibleInspirations)
          )}
        </div>
      )}
      </div>

      {/* Detail View Overlay */}
      <AnimatePresence>
        {selectedIns && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-0 md:p-12">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedIns(null)}
              className="absolute inset-0 bg-stone-950/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full h-full md:max-w-4xl md:h-auto md:max-h-[85vh] bg-white md:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden overflow-y-auto scrollbar-hide"
            >
              {/* Header */}
              <div className="sticky top-0 bg-white/90 backdrop-blur-sm p-4 sm:p-6 md:p-10 border-b border-stone-50 flex items-center justify-between gap-3 z-10">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-stone-400">
                    {isZh ? '记录于 ' : 'Captured on '}{format(selectedIns.createdAt, 'PPPP')}
                  </span>
                  {selectedIns.personId && (
                    <div className="flex items-center gap-2 text-stone-900">
                      <Users size={14} />
                      <span className="text-sm font-medium">{people.find(p => p.id === selectedIns.personId)?.name}</span>
                    </div>
                  )}
                  {normalizeInspirationTags(selectedIns.tags, []).length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {normalizeInspirationTags(selectedIns.tags, []).map((tag) => (
                        <button
                          key={tag}
                          onClick={() => setActiveTag(tag)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors ${
                            isAhaMomentTag(tag)
                              ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                          }`}
                        >
                          {getInspirationTagLabel(tag, lang)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => {
                      handleDelete(selectedIns.id, e);
                      setSelectedIns(null);
                    }}
                    className="p-2 sm:p-3 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-xl sm:rounded-2xl transition-all"
                  >
                    <Trash2 size={20} className="sm:w-6 sm:h-6" />
                  </button>
                  <button
                    onClick={() => setSelectedIns(null)}
                    className="p-2 sm:p-3 bg-stone-50 text-stone-400 hover:text-stone-900 rounded-xl sm:rounded-2xl transition-all"
                  >
                    <X size={20} className="sm:w-6 sm:h-6" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-5 sm:p-8 md:p-16 space-y-8 md:space-y-12">
                <div className="max-w-2xl mx-auto">
                  <p
                    onMouseUp={handleMouseUp}
                    className="text-xl sm:text-2xl md:text-3xl font-serif leading-[1.6] text-stone-800 cursor-text break-words"
                  >
                    {selectedIns.content}
                  </p>
                </div>

                {/* AI Insight Section in Detail */}
                <div className="max-w-2xl mx-auto border-t border-stone-100 pt-8 md:pt-12">
                  {!insights[selectedIns.id] ? (
                    <div className="flex flex-col items-center text-center gap-5 sm:gap-6 p-5 sm:p-8 bg-stone-50 rounded-3xl sm:rounded-[2rem]">
                      <Sparkles size={32} className="text-stone-200" />
                      <div>
                        <p className="text-stone-600 font-medium">{isZh ? '准备好接收 Echo 的洞察了吗？' : "Ready for Echo's reflection?"}</p>
                        <p className="text-stone-400 text-sm mt-1">{isZh ? '深度分析会帮你看见隐藏关联。' : 'Deep analysis reveals hidden connections.'}</p>
                      </div>
                      <button 
                         disabled={isAnalyzing === selectedIns.id}
                         onClick={() => handleAIAnalyze(selectedIns.id, selectedIns.content)}
                         className="px-8 py-3 bg-stone-900 text-white rounded-2xl text-sm font-bold uppercase tracking-widest shadow-lg hover:shadow-xl transition-all flex items-center gap-3 disabled:opacity-50"
                      >
                        {isAnalyzing === selectedIns.id ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Sparkles size={18} />}
                        {isZh ? '分析想法' : 'Analyze Thought'}
                      </button>
                      {aiError && (
                        <p className="text-xs text-red-500 max-w-md leading-relaxed">{aiError}</p>
                      )}
                    </div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-8"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-serif text-amber-800">{isZh ? 'Echo 洞察' : 'Echo Reflection'}</h3>
                        {(() => {
                          const existingConvId = conversationByInspirationId[selectedIns.id];
                          if (existingConvId && onOpenExistingConversation) {
                            return (
                              <button
                                onClick={() => continueConversation(existingConvId)}
                                className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest"
                              >
                                <MessageSquare size={16} />
                                {isZh ? '继续对话' : 'Continue Dialogue'}
                              </button>
                            );
                          }
                          return (
                            <button
                              onClick={() => startConversation(
                                selectedIns.content,
                                isZh ? '帮我深入聊聊这条灵感' : "Let's dive deeper into this inspiration",
                                selectedIns.content,
                                selectedIns.tags,
                                selectedIns.id,
                              )}
                              className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest"
                            >
                              <MessageSquare size={16} />
                              {isZh ? '开启对话' : 'Open Dialogue'}
                            </button>
                          );
                        })()}
                      </div>
                      <div className="p-5 sm:p-8 bg-amber-50/50 rounded-3xl sm:rounded-[2.5rem] border border-amber-100/50">
                        <p className="text-lg text-amber-900/80 italic font-serif leading-relaxed">
                          "{insights[selectedIns.id].insight}"
                        </p>
                      </div>
                      {insights[selectedIns.id].goalSuggestion && (
                         <div className="flex flex-col gap-4 p-6 border border-stone-100 rounded-3xl">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{isZh ? '行为建议' : 'Behavior Suggestion'}</span>
                              <span className="text-stone-800 font-medium">{insights[selectedIns.id].goalSuggestion}</span>
                            </div>
                         </div>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Insight Modal (entry + quick chat options) */}
      <AnimatePresence>
        {aiInsightOpen && (
          <div className="fixed inset-0 z-[450] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setAiInsightOpen(false); setAiReport(null); }}
              className="absolute inset-0 bg-stone-950/40 backdrop-blur-sm"
            />
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-6 md:p-8 max-h-[85vh] overflow-y-auto">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-serif text-amber-800">{isZh ? 'AI 洞察汇总' : 'AI Insights'}</h3>
                  <p className="text-sm text-stone-500 mt-1">{isZh ? '在当前筛选/视图范围内生成整体对话上下文。' : 'Open a contextual chatbot based on current view.'}</p>
                </div>
                <button type="button" onClick={() => { setAiInsightOpen(false); setAiReport(null); }} className="p-2 text-stone-400 hover:text-stone-900 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  {(!aiReport || aiReport?.error || isGeneratingReport) && (!existingReportForTag || hasNewInspirationsSinceReport) && (
                    <button
                      onClick={generateReport}
                      disabled={isGeneratingReport}
                      className="px-4 py-2 bg-stone-900 text-white rounded-2xl font-bold"
                    >
                      {isGeneratingReport ? (isZh ? '生成中...' : 'Generating...') : (isZh ? '生成报告' : 'Generate Report')}
                    </button>
                  )}

                  {!isGeneratingReport && !aiReport && existingReportForTag && onViewReportsForTag && (
                    <button
                      onClick={() => {
                        onViewReportsForTag(activeTag);
                        setAiInsightOpen(false);
                      }}
                      className="px-4 py-2 bg-amber-600 text-white rounded-2xl font-bold"
                    >
                      {isZh ? '查看已有报告' : 'View Existing Reports'}
                    </button>
                  )}

                </div>

                {!isGeneratingReport && !aiReport && existingReportForTag && (
                  <p className="text-xs text-stone-400 leading-relaxed">
                    {hasNewInspirationsSinceReport
                      ? (isZh
                        ? '该标签下已存在报告，且自上次生成后又新增了灵感卡片，可重新生成或查看历史报告。'
                        : 'A report already exists for this tag, and new inspiration cards have been added since. Regenerate or view the existing report.')
                      : (isZh
                        ? '该标签下已有报告，暂无新增灵感卡片。'
                        : 'This tag already has a report — no new inspirations since.')}
                  </p>
                )}

                {isGeneratingReport ? (
                  <div className="mt-4 rounded-2xl border border-stone-100 bg-stone-50 p-5 space-y-4 animate-pulse">
                    <div className="h-5 w-40 rounded bg-stone-200" />
                    <div className="h-4 w-full rounded bg-stone-200" />
                    <div className="h-4 w-5/6 rounded bg-stone-200" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="h-20 rounded-2xl bg-stone-200" />
                      <div className="h-20 rounded-2xl bg-stone-200" />
                    </div>
                  </div>
                ) : aiReport ? (
                  <div className="mt-4 rounded-3xl border border-stone-100 bg-gradient-to-b from-stone-50 to-white p-5 md:p-6 space-y-5">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.28em] text-stone-300">{isZh ? '当前报告' : 'Current Report'}</div>
                      <h4 className="mt-2 text-2xl font-serif text-stone-800">{aiReport.title}</h4>
                      <div className="mt-2 text-xs text-stone-400">
                        {aiReport.scope?.count || 0} {isZh ? '条记录' : 'records'} · {aiReport.scope?.tag || 'all'}
                      </div>
                    </div>

                    <div className="text-sm md:text-base text-stone-700">
                      <ReactMarkdown components={reportMarkdownComponents}>
                        {typeof aiReport.summary === 'string' ? aiReport.summary : ''}
                      </ReactMarkdown>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-2xl border border-stone-100 bg-white p-4">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-stone-400">{isZh ? '洞察' : 'Insights'}</h5>
                        <div className="mt-3 space-y-3">
                          {Array.isArray(aiReport.insights) && aiReport.insights.length > 0 ? aiReport.insights.map((item: any, i: number) => (
                            <div key={i} className="rounded-2xl bg-stone-50 p-3">
                              <div className="font-medium text-stone-800">{item.theme || item.cognitivePattern || `Insight ${i + 1}`}</div>
                              <div className="mt-1 text-sm text-stone-500 whitespace-pre-wrap">
                                {item.cognitivePattern || item.emotionalSignal || item.behavioralPattern || ''}
                              </div>
                            </div>
                          )) : (
                            <p className="text-sm text-stone-400">{isZh ? '当前报告没有拆分出的结构化洞察。' : 'No structured insights were returned.'}</p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-stone-100 bg-white p-4">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-stone-400">{isZh ? '建议行动' : 'Recommended Actions'}</h5>
                        <div className="mt-3 space-y-3">
                          {Array.isArray(aiReport.recommendedActions) && aiReport.recommendedActions.length > 0 ? aiReport.recommendedActions.map((action: any, i: number) => (
                            <div key={i} className="rounded-2xl bg-stone-50 p-3">
                              <div className="text-sm font-medium text-stone-800">{typeof action === 'string' ? action : action.objective || `Action ${i + 1}`}</div>
                              {typeof action === 'object' && action?.rationale && <div className="mt-1 text-sm text-stone-500 whitespace-pre-wrap">{action.rationale}</div>}
                            </div>
                          )) : (
                            <p className="text-sm text-stone-400">{isZh ? '当前报告还没有建议行动。' : 'No recommended actions were returned.'}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap pt-1">
                      <button
                        onClick={() => {
                          const ctx = aiReport?.summary || aiReport?.title || '';
                          const reportScopeTag = aiReport?.scope?.tag;
                          const reportTags = reportScopeTag && reportScopeTag !== 'all' ? [reportScopeTag] : ['composite'];
                          const titleBase = aiReport?.title || ctx;
                          const title = truncateTitle(titleBase) || (isZh ? '新对话' : 'New chat');
                          onStartConversation({
                            title,
                            content: ctx,
                            tags: reportTags,
                            autoSend: false,
                          });
                          setSelectedIns(null);
                          setAiInsightOpen(false);
                          clearSelection();
                        }}
                        className="px-4 py-2 bg-stone-900 text-white rounded-2xl font-bold"
                      >
                        {isZh ? '继续聊聊' : 'Continue Chat'}
                      </button>

                      <button onClick={() => setAiReport(null)} className="px-3 py-2 text-sm text-stone-500">{isZh ? '关闭报告' : 'Close Report'}</button>
                    </div>
                  </div>
                ) : existingReportForTag ? null : (
                  <div className="mt-4 rounded-2xl border border-stone-100 bg-stone-50 p-5 text-sm text-stone-500">
                    {isZh ? '还没有报告。点击“生成报告”后，会基于当前筛选结果显示结构化洞察。' : 'No report yet. Click Generate Report to view structured insights from the current filter.'}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Selection Action */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectionPosition && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              style={{ 
                position: 'fixed',
                left: selectionPosition.x, 
                top: selectionPosition.y,
                transform: 'translateX(-50%)'
              }}
              className="z-[9999] bg-black text-white rounded-2xl shadow-2xl text-xs font-medium overflow-hidden ring-4 ring-white"
            >
              <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2 bg-black/90">
                <Sparkles size={14} className="text-amber-400" />
                <span>{isZh ? '选中文本' : 'Selected text'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-white/10">
                <button
                  onClick={() => {
                    startConversation(
                      selectedText,
                      isZh ? '我们来讨论这段具体想法' : "Let's discuss this specific thought",
                      selectedText,
                      aggregateScopeTags(),
                    );
                  }}
                  className="px-4 py-3 bg-black hover:bg-stone-900 transition-colors text-left"
                >
                  {isZh ? '继续聊聊' : 'Chat'}
                </button>
                <button
                  onClick={promoteSelectionToInspiration}
                  className="px-4 py-3 bg-black hover:bg-stone-900 transition-colors text-left"
                >
                  {isZh ? '沉淀为灵感' : 'Save as inspiration'}
                </button>
                <button
                  onClick={promoteSelectionToTheme}
                  className="px-4 py-3 bg-black hover:bg-stone-900 transition-colors text-left"
                >
                  {isZh ? '沉淀为人生课题' : 'Save as theme'}
                </button>
                <button
                  onClick={promoteSelectionToGoal}
                  className="px-4 py-3 bg-black hover:bg-stone-900 transition-colors text-left"
                >
                  {isZh ? '加入目标档案' : 'Save as goal'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

    </div>
  );
}
