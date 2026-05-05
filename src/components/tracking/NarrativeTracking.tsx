/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  CalendarDays,
  Search,
  X,
  ChevronRight,
  MessageSquare,
  Lightbulb,
  Compass,
  TrendingUp,
  Heart,
  ListChecks,
  ChevronDown,
  FileText,
  BrainCircuit,
  Users,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCollection, deleteDocument } from '../../hooks/useFirebase';
import {
  ConversationSeed,
  GrowthReport,
  GrowthReportConversation,
  GrowthReportInspiration,
  Inspiration,
} from '../../types';
import { format, parseISO } from 'date-fns';
import {
  canonicalizeInspirationTag,
  getInspirationTagLabel,
  isAhaMomentTag,
} from '../../constants/inspirationTags';
import { shortenText } from '../../lib/textPromotions';
import { getMockGrowthReports } from '../../lib/mockGrowthReports';

interface NarrativeTrackingProps {
  lang?: 'zh' | 'en';
  onStartConversation?: (seed: Omit<ConversationSeed, 'id'>) => void;
  pendingReportTag?: { tag: string; nonce: number } | null;
  onPendingReportTagConsumed?: () => void;
}

interface ConversationListItem {
  id: string;
  title: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

type KindFilter = 'all' | 'weekly' | 'monthly';

const PREVIEW_LIMIT = 3;

export default function NarrativeTracking({
  lang = 'zh',
  onStartConversation,
  pendingReportTag,
  onPendingReportTagConsumed,
}: NarrativeTrackingProps) {
  const isZh = lang === 'zh';
  const { data: inspirations } = useCollection<Inspiration>('inspirations');
  const { data: conversations } = useCollection<ConversationListItem>('conversations');
  const { data: savedReports, loading: savedReportsLoading, error: savedReportsError } =
    useCollection<any>('insightReports');

  const [reports] = useState<GrowthReport[]>(() => getMockGrowthReports());

  const [searchQuery, setSearchQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');

  const [selectedReport, setSelectedReport] = useState<GrowthReport | null>(null);
  const [showAllInspirations, setShowAllInspirations] = useState(false);
  const [showAllConversations, setShowAllConversations] = useState(false);
  const [showAllWeekly, setShowAllWeekly] = useState(false);
  const [showAllMonthly, setShowAllMonthly] = useState(false);

  // Saved AI insight reports archive (legacy reports kept here for review).
  const [archiveQuery, setArchiveQuery] = useState('');
  const [archiveTagFilter, setArchiveTagFilter] = useState<string>('all');
  const [selectedArchive, setSelectedArchive] = useState<any | null>(null);

  const growthRef = useRef<HTMLDivElement | null>(null);
  const archiveRef = useRef<HTMLDivElement | null>(null);

  // Honor a pending tag jump from the inspiration hub: it targets the
  // historical AI report archive (which is keyed by inspiration tag).
  useEffect(() => {
    if (!pendingReportTag) return;
    const tag = pendingReportTag.tag;
    setArchiveTagFilter(tag && tag !== 'all' ? canonicalizeInspirationTag(tag) || 'all' : 'all');
    setArchiveQuery('');
    setSelectedArchive(null);
    onPendingReportTagConsumed?.();
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        archiveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [pendingReportTag]);

  // Reset preview expansion when opening a different report.
  useEffect(() => {
    setShowAllInspirations(false);
    setShowAllConversations(false);
  }, [selectedReport?.id]);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => (r.tags || []).forEach((t) => t && set.add(t)));
    return Array.from(set).sort();
  }, [reports]);

  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return reports
      .filter((r) => {
        if (kindFilter !== 'all' && r.kind !== kindFilter) return false;
        if (tagFilter !== 'all' && !(r.tags || []).includes(tagFilter)) return false;
        if (!q) return true;
        const blob = [
          r.title,
          r.headline,
          r.summary,
          (r.highlights || []).join(' '),
          (r.themes || []).map((t) => `${t.name} ${t.description || ''}`).join(' '),
          (r.tags || []).join(' '),
        ]
          .join(' ')
          .toLowerCase();
        return blob.includes(q);
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [reports, searchQuery, kindFilter, tagFilter]);

  const weeklyReports = filteredReports.filter((r) => r.kind === 'weekly');
  const monthlyReports = filteredReports.filter((r) => r.kind === 'monthly');

  // When the modal opens, lookup the *real* inspirations and conversations
  // referenced by the report so click-throughs and live data work.
  const resolveInspiration = (item: GrowthReportInspiration) => {
    if (item.id) {
      const real = (inspirations || []).find((i) => i.id === item.id);
      if (real) {
        return {
          ...item,
          content: real.content,
          tags: real.tags,
          createdAt: real.createdAt,
          isReal: true as const,
        };
      }
    }
    return { ...item, isReal: false as const };
  };

  const resolveConversation = (item: GrowthReportConversation) => {
    if (item.id) {
      const real = (conversations || []).find((c) => c.id === item.id);
      if (real) {
        return { ...item, title: real.title, createdAt: real.updatedAt, isReal: true as const };
      }
    }
    return { ...item, isReal: false as const };
  };

  const handleChatAboutReport = (report: GrowthReport) => {
    const ctxParts = [
      report.title,
      report.headline,
      report.summary,
      report.highlights?.length
        ? `${isZh ? '亮点' : 'Highlights'}: ${report.highlights.join('; ')}`
        : '',
    ].filter(Boolean);
    const ctx = ctxParts.join('\n\n');
    const seedTitle =
      (report.title.length <= 24 ? report.title : `${report.title.slice(0, 24)}…`) ||
      (isZh ? '新对话' : 'New chat');
    onStartConversation?.({
      title: seedTitle,
      question: isZh ? '帮我聊聊这份成长洞察报告' : "Let's discuss this growth report",
      content: ctx,
      tags: report.tags,
    });
    setSelectedReport(null);
  };

  const formatPeriod = (report: GrowthReport) => {
    try {
      const start = parseISO(report.periodStart);
      const end = parseISO(report.periodEnd);
      if (report.kind === 'monthly') {
        return format(start, isZh ? 'yyyy 年 M 月' : 'MMMM yyyy');
      }
      return `${format(start, isZh ? 'M 月 d 日' : 'MMM d')} – ${format(end, isZh ? 'M 月 d 日' : 'MMM d')}`;
    } catch {
      return `${report.periodStart} → ${report.periodEnd}`;
    }
  };

  // ──────────── Saved AI insight reports (legacy archive) ────────────
  const decoratedSavedReports = useMemo(() => {
    return (savedReports || []).map((rec: any) => {
      const r = rec.report || rec;
      const themes = Array.isArray(r.recurringThemes) ? r.recurringThemes : [];
      const rawTag = (rec.scope?.tag ?? r.scope?.tag ?? '').toString();
      const tag =
        rawTag === 'all'
          ? 'composite'
          : rawTag
            ? canonicalizeInspirationTag(rawTag)
            : '';
      const blob = [
        r.title || rec.title || '',
        r.summary || rec.summary || '',
        themes.map((t: any) => t.theme || t).join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return { rec, r, themes, tag, blob };
    });
  }, [savedReports]);

  const availableArchiveTags = useMemo(() => {
    return Array.from(
      new Set(
        decoratedSavedReports
          .map((entry: any) => entry.tag)
          .filter((t: string) => t && t !== 'composite'),
      ),
    ).sort();
  }, [decoratedSavedReports]);

  const hasCompositeArchive = decoratedSavedReports.some((entry: any) => entry.tag === 'composite');

  const filteredArchive = useMemo(() => {
    const q = archiveQuery.trim().toLowerCase();
    return decoratedSavedReports
      .filter(({ blob, tag }: any) => {
        const matchesQuery = !q || blob.includes(q);
        const matchesTag = archiveTagFilter === 'all' || tag === archiveTagFilter;
        return matchesQuery && matchesTag;
      })
      .sort((a: any, b: any) => (b.rec.createdAt || 0) - (a.rec.createdAt || 0));
  }, [decoratedSavedReports, archiveQuery, archiveTagFilter]);

  const handleDeleteArchive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm(isZh ? '删除这份 AI 洞察报告吗？' : 'Delete this AI insight report?')) return;
    await deleteDocument('insightReports', id);
    if (selectedArchive?.id === id) setSelectedArchive(null);
  };

  const handleChatAboutArchive = (rec: any) => {
    const r = rec.report || rec;
    const ctx = (r.summary || rec.summary || r.title || '').toString();
    if (!ctx) return;
    const reportTitle = (r.title || rec.title || '').toString();
    const titleBase = reportTitle || ctx;
    const title =
      (titleBase.length <= 20 ? titleBase : titleBase.slice(0, 20) + '…') ||
      (isZh ? '新对话' : 'New chat');
    onStartConversation?.({
      title,
      question: isZh ? '帮我深入聊聊这份报告' : "Let's dive deeper into this report",
      content: ctx,
    });
    setSelectedArchive(null);
  };

  return (
    <div className="px-3 sm:px-4 md:px-12 py-6 md:py-8 space-y-6 md:space-y-10 pb-40">
      {/* Hero header */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-1">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.32em] text-stone-300 mb-1.5">
              {isZh ? '洞察' : 'Insights'}
            </div>
            <h1 className="text-3xl md:text-4xl font-serif text-stone-800 tracking-tight">
              {isZh ? '成长洞察' : 'Growth Insights'}
            </h1>
            <p className="mt-1.5 text-stone-500 text-sm leading-snug max-w-2xl">
              {isZh
                ? '每周和每月，Echo 会基于你新增的灵感和对话，自动生成一份成长报告。在这里翻看你走过的节奏。'
                : 'Each week and month, Echo synthesizes a growth report from the inspirations and conversations you added. Browse the rhythm of your journey.'}
            </p>
          </div>
        </div>
      </section>

      {/* Search + filter bar */}
      <section ref={growthRef} className="scroll-mt-24 -mt-5 md:-mt-8">
        <div className="rounded-[2rem] border border-stone-100 bg-white/85 backdrop-blur-sm shadow-[0_22px_55px_-32px_rgba(28,25,23,0.22)] p-3 md:p-4 space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isZh ? '搜索标题、亮点、主题或关键词...' : 'Search title, highlights, themes, or keywords...'}
              className="w-full pl-10 pr-10 py-3 rounded-2xl border border-stone-100 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/5"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-stone-400 hover:text-stone-700"
                aria-label={isZh ? '清除搜索' : 'Clear search'}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <KindChip
              active={kindFilter === 'all'}
              onClick={() => setKindFilter('all')}
              label={isZh ? '全部' : 'All'}
            />
            <KindChip
              active={kindFilter === 'weekly'}
              onClick={() => setKindFilter('weekly')}
              label={isZh ? '周报告' : 'Weekly'}
              accent="emerald"
            />
            <KindChip
              active={kindFilter === 'monthly'}
              onClick={() => setKindFilter('monthly')}
              label={isZh ? '月度报告' : 'Monthly'}
              accent="amber"
            />
          </div>

          {availableTags.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1">
              <button
                type="button"
                onClick={() => setTagFilter('all')}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.18em] transition-all ${
                  tagFilter === 'all'
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'bg-stone-50 text-stone-500 border border-stone-100 hover:text-stone-800'
                }`}
              >
                {isZh ? '全部主题' : 'All tags'}
              </button>
              {availableTags.map((t) => {
                const isAha = isAhaMomentTag(t);
                const isActive = tagFilter === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTagFilter(t)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.18em] transition-all ${
                      isActive
                        ? isAha
                          ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30'
                          : 'bg-stone-900 text-white shadow-sm'
                        : isAha
                          ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                          : 'bg-stone-50 text-stone-500 border border-stone-100 hover:text-stone-800'
                    }`}
                  >
                    {getInspirationTagLabel(t, lang)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Empty state */}
      {filteredReports.length === 0 && (
        <div className="rounded-[2rem] border border-dashed border-stone-200 bg-white/70 p-12 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-stone-50 border border-stone-100 flex items-center justify-center text-stone-300 mb-4">
            <Sparkles size={22} />
          </div>
          <p className="text-stone-700 font-serif text-lg">
            {isZh ? '没有匹配的成长洞察' : 'No matching growth reports'}
          </p>
          <p className="mt-2 text-stone-400 text-sm">
            {isZh ? '试试清除筛选条件，或更换搜索关键词。' : 'Try clearing the filters or rephrasing the search.'}
          </p>
        </div>
      )}

      {/* Weekly reports — horizontal swipe carousel (latest first), with view-all toggle */}
      {weeklyReports.length > 0 && (
        <section className="space-y-5">
          <SectionDivider
            label={isZh ? '周报告' : 'Weekly Reports'}
            sublabel={isZh ? '七天的节奏切片' : 'Seven-day slices'}
          />
          <SectionToggleBar
            total={weeklyReports.length}
            showAll={showAllWeekly}
            onToggle={() => setShowAllWeekly((v) => !v)}
            isZh={isZh}
            hint={
              !showAllWeekly && weeklyReports.length > 1
                ? isZh
                  ? '左滑查看更多 →'
                  : 'Swipe left for more →'
                : undefined
            }
          />
          {showAllWeekly ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {weeklyReports.map((r) => (
                <WeeklyCard
                  key={r.id}
                  report={r}
                  isZh={isZh}
                  periodLabel={formatPeriod(r)}
                  onOpen={() => setSelectedReport(r)}
                />
              ))}
            </div>
          ) : (
            <div className="-mx-3 sm:-mx-4 md:-mx-12 px-3 sm:px-4 md:px-12 overflow-x-auto snap-x snap-mandatory scroll-smooth scrollbar-hide">
              <div className="flex gap-4 pb-2">
                {weeklyReports.map((r) => (
                  <div
                    key={r.id}
                    className="snap-start shrink-0 w-[88%] sm:w-[60%] md:w-[420px] lg:w-[460px]"
                  >
                    <WeeklyCard
                      report={r}
                      isZh={isZh}
                      periodLabel={formatPeriod(r)}
                      onOpen={() => setSelectedReport(r)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Monthly reports — horizontal swipe carousel (latest first), with view-all toggle */}
      {monthlyReports.length > 0 && (
        <section className="space-y-5">
          <SectionDivider
            label={isZh ? '月度报告' : 'Monthly Reports'}
            sublabel={isZh ? '一个月的轨迹与脉络' : 'A month, in arc form'}
          />
          <SectionToggleBar
            total={monthlyReports.length}
            showAll={showAllMonthly}
            onToggle={() => setShowAllMonthly((v) => !v)}
            isZh={isZh}
            hint={
              !showAllMonthly && monthlyReports.length > 1
                ? isZh
                  ? '左滑查看更多 →'
                  : 'Swipe left for more →'
                : undefined
            }
          />
          {showAllMonthly ? (
            <div className="grid grid-cols-1 gap-5">
              {monthlyReports.map((r) => (
                <MonthlyCard
                  key={r.id}
                  report={r}
                  isZh={isZh}
                  periodLabel={formatPeriod(r)}
                  onOpen={() => setSelectedReport(r)}
                />
              ))}
            </div>
          ) : (
            <div className="-mx-3 sm:-mx-4 md:-mx-12 px-3 sm:px-4 md:px-12 overflow-x-auto snap-x snap-mandatory scroll-smooth scrollbar-hide">
              <div className="flex gap-5 pb-2">
                {monthlyReports.map((r) => (
                  <div
                    key={r.id}
                    className="snap-start shrink-0 w-[92%] sm:w-[88%] lg:w-[760px] xl:w-[860px]"
                  >
                    <MonthlyCard
                      report={r}
                      isZh={isZh}
                      periodLabel={formatPeriod(r)}
                      onOpen={() => setSelectedReport(r)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* AI insight reports archive (legacy) */}
      <section ref={archiveRef} className="space-y-5 scroll-mt-24">
        <SectionDivider
          label={isZh ? 'AI 洞察报告归档' : 'AI Insight Archive'}
          sublabel={isZh ? '历史生成的洞察报告' : 'Previously generated reports'}
        />

        <div className="rounded-[2rem] border border-stone-100 bg-white/85 backdrop-blur-sm shadow-[0_22px_55px_-32px_rgba(28,25,23,0.22)] p-4 md:p-6 space-y-4">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <p className="text-stone-500 text-sm leading-relaxed max-w-xl">
              {isZh
                ? '此前在灵感页面生成的 AI 洞察报告会自动归档于此，可随时回看。'
                : 'AI insight reports generated from the Inspiration Hub are archived here for review.'}
            </p>
            <span className="text-xs uppercase tracking-[0.28em] text-stone-300">
              {(savedReports || []).length} {isZh ? '份归档' : 'archived'}
            </span>
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={archiveQuery}
              onChange={(e) => setArchiveQuery(e.target.value)}
              placeholder={isZh ? '搜索归档报告标题、摘要或课题...' : 'Search archived reports...'}
              className="w-full pl-10 pr-10 py-3 rounded-2xl border border-stone-100 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/5"
            />
            {archiveQuery && (
              <button
                type="button"
                onClick={() => setArchiveQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-stone-400 hover:text-stone-700"
                aria-label={isZh ? '清除搜索' : 'Clear search'}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {(availableArchiveTags.length > 0 || hasCompositeArchive) && (
            <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1">
              <button
                type="button"
                onClick={() => setArchiveTagFilter('all')}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.18em] transition-all ${
                  archiveTagFilter === 'all'
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'bg-stone-50 text-stone-500 border border-stone-100 hover:text-stone-800'
                }`}
              >
                {isZh ? '全部' : 'All'}
              </button>
              {hasCompositeArchive && (
                <button
                  type="button"
                  onClick={() => setArchiveTagFilter('composite')}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.18em] transition-all ${
                    archiveTagFilter === 'composite'
                      ? 'bg-stone-900 text-white shadow-sm'
                      : 'bg-stone-50 text-stone-500 border border-stone-100 hover:text-stone-800'
                  }`}
                >
                  {isZh ? '综合' : 'Composite'}
                </button>
              )}
              {availableArchiveTags.map((tagKey) => {
                const isAha = isAhaMomentTag(tagKey);
                const isActive = archiveTagFilter === tagKey;
                return (
                  <button
                    key={tagKey}
                    type="button"
                    onClick={() => setArchiveTagFilter(tagKey)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.18em] transition-all ${
                      isActive
                        ? isAha
                          ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30'
                          : 'bg-stone-900 text-white shadow-sm'
                        : isAha
                          ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                          : 'bg-stone-50 text-stone-500 border border-stone-100 hover:text-stone-800'
                    }`}
                  >
                    {getInspirationTagLabel(tagKey, lang)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {savedReportsLoading && (savedReports || []).length === 0 ? (
          <div className="rounded-[1.8rem] border border-dashed border-stone-100 bg-white/70 p-10 text-center text-stone-400 text-sm">
            {isZh ? '加载中...' : 'Loading...'}
          </div>
        ) : (savedReports || []).length === 0 ? (
          <div className="rounded-[1.8rem] border border-dashed border-stone-100 bg-white/70 p-10 text-center text-stone-400 text-sm">
            {savedReportsError && /unauthor/i.test(String(savedReportsError))
              ? isZh
                ? '请先登录以查看归档报告。'
                : 'Sign in to view archived reports.'
              : isZh
                ? '还没有归档的 AI 洞察报告。'
                : 'No AI insight reports archived yet.'}
          </div>
        ) : filteredArchive.length === 0 ? (
          <div className="rounded-[1.8rem] border border-dashed border-stone-100 bg-white/70 p-10 text-center text-stone-400 text-sm">
            {isZh ? '没有匹配的归档报告。' : 'No archived reports match your search.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredArchive.map(({ rec, r, themes }: any, index: number) => {
              const insightCount = Array.isArray(r.insights) ? r.insights.length : 0;
              const sourceCount = Array.isArray(rec.sourceIds) ? rec.sourceIds.length : 0;
              const reportType =
                rec.reportType ||
                (r.themeProgress
                  ? 'life_theme'
                  : themes.length > 0
                    ? 'life_theme'
                    : 'inspiration_overview');
              const cardScope = rec.scope || r.scope;
              const cardScopeTagRaw =
                cardScope?.tag && cardScope.tag !== 'all' ? cardScope.tag : '';
              const cardScopeTagLabel = cardScopeTagRaw
                ? getInspirationTagLabel(cardScopeTagRaw, lang)
                : '';
              const cardBadgeLabel = cardScopeTagLabel
                ? isZh
                  ? `${cardScopeTagLabel}洞察`
                  : `${cardScopeTagLabel} Insights`
                : cardScope?.tag === 'all'
                  ? isZh
                    ? '综合洞察'
                    : 'Composite Insights'
                  : reportType === 'life_theme'
                    ? isZh
                      ? '人生课题'
                      : 'Life Theme'
                    : isZh
                      ? '灵感洞察'
                      : 'Inspiration';

              return (
                <motion.button
                  key={rec.id}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  onClick={() => setSelectedArchive(rec)}
                  className="text-left rounded-[1.8rem] border border-stone-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(249,248,246,0.98)_100%)] p-5 shadow-[0_20px_50px_-28px_rgba(28,25,23,0.22)] hover:shadow-[0_28px_70px_-30px_rgba(28,25,23,0.28)] transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-stone-900 text-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em]">
                          <FileText size={11} />
                          {cardBadgeLabel}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.24em] text-stone-300">
                          <CalendarDays size={11} />
                          {format(rec.createdAt, 'MMM dd, yyyy · HH:mm')}
                        </span>
                      </div>
                      <div className="text-xl font-serif text-stone-800 leading-tight line-clamp-2">
                        {r.title || rec.title || (isZh ? '未命名报告' : 'Untitled report')}
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-stone-500 line-clamp-3">
                        {r.summary || rec.summary || (isZh ? '没有摘要内容。' : 'No summary.')}
                      </p>
                      <div className="mt-4 flex items-center gap-3 flex-wrap text-[10px] uppercase tracking-[0.24em] text-stone-400">
                        {themes.length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <BrainCircuit size={11} />
                            {themes.length} {isZh ? '课题' : 'themes'}
                          </span>
                        )}
                        {insightCount > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Sparkles size={11} />
                            {insightCount} {isZh ? '洞察' : 'insights'}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Users size={11} />
                          {sourceCount} {isZh ? '来源' : 'sources'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteArchive(e, rec.id)}
                      className="shrink-0 p-2 rounded-2xl text-stone-300 hover:text-red-500 hover:bg-red-50 transition-all"
                      title={isZh ? '删除报告' : 'Delete report'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </section>

      {/* Detail modal */}
      <AnimatePresence>
        {selectedReport && (
          <ReportDetailModal
            report={selectedReport}
            isZh={isZh}
            periodLabel={formatPeriod(selectedReport)}
            showAllInspirations={showAllInspirations}
            showAllConversations={showAllConversations}
            onToggleAllInspirations={() => setShowAllInspirations((v) => !v)}
            onToggleAllConversations={() => setShowAllConversations((v) => !v)}
            onClose={() => setSelectedReport(null)}
            onChatAbout={() => handleChatAboutReport(selectedReport)}
            resolveInspiration={resolveInspiration}
            resolveConversation={resolveConversation}
          />
        )}
      </AnimatePresence>

      {/* Archive (saved AI report) detail modal */}
      <AnimatePresence>
        {selectedArchive && (
          <ArchiveDetailModal
            rec={selectedArchive}
            isZh={isZh}
            lang={lang}
            inspirations={inspirations}
            onClose={() => setSelectedArchive(null)}
            onDelete={(e) => handleDeleteArchive(e, selectedArchive.id)}
            onChatAbout={() => handleChatAboutArchive(selectedArchive)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* Subcomponents                                                          */
/* ────────────────────────────────────────────────────────────────────── */

function SectionDivider({ label, sublabel }: { label: string; sublabel?: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-px flex-1 bg-stone-100" />
      <div className="flex flex-col items-center text-center">
        <span className="text-[10px] uppercase font-bold tracking-[0.4em] text-stone-300">{label}</span>
        {sublabel && <span className="text-xs font-serif italic text-stone-400 mt-1">{sublabel}</span>}
      </div>
      <div className="h-px flex-1 bg-stone-100" />
    </div>
  );
}

function SectionToggleBar({
  total,
  showAll,
  onToggle,
  isZh,
  hint,
}: {
  total: number;
  showAll: boolean;
  onToggle: () => void;
  isZh: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 -mt-1">
      <span className="text-[11px] uppercase tracking-[0.24em] text-stone-300">
        {hint ?? (showAll ? (isZh ? `共 ${total} 份` : `${total} total`) : '')}
      </span>
      {total > 1 && (
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.2em] bg-stone-50 text-stone-600 border border-stone-100 hover:bg-stone-900 hover:text-white hover:border-stone-900 transition-all"
        >
          {showAll
            ? isZh
              ? '只看最新'
              : 'Latest only'
            : `${isZh ? '查看全部' : 'View all'} (${total})`}
        </button>
      )}
    </div>
  );
}

function KindChip({
  active,
  onClick,
  label,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  accent?: 'emerald' | 'amber';
}) {
  const accentClass = !active
    ? 'bg-stone-50 text-stone-500 border border-stone-100 hover:text-stone-800'
    : accent === 'emerald'
      ? 'bg-emerald-600 text-white shadow-sm'
      : accent === 'amber'
        ? 'bg-amber-600 text-white shadow-sm'
        : 'bg-stone-900 text-white shadow-sm';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-[0.2em] transition-all ${accentClass}`}
    >
      {label}
    </button>
  );
}

function MonthlyCard({
  report,
  isZh,
  periodLabel,
  onOpen,
}: {
  report: GrowthReport;
  isZh: boolean;
  periodLabel: string;
  onOpen: () => void;
}) {
  const themes = (report.themes || []).slice(0, 4);
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="group relative w-full text-left overflow-hidden rounded-[2.5rem] border border-amber-100/70 bg-[linear-gradient(135deg,#fff8ec_0%,#fff_45%,#fdf3e0_100%)] shadow-[0_30px_70px_-32px_rgba(180,83,9,0.28)] hover:shadow-[0_40px_90px_-32px_rgba(180,83,9,0.38)] transition-all"
    >
      <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-amber-200/40 blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

      <div className="relative grid grid-cols-1 lg:grid-cols-[1.4fr_0.9fr] gap-6 p-7 md:p-9">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 text-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em]">
              <Compass size={11} />
              {isZh ? '月度报告' : 'Monthly'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-amber-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-700">
              <CalendarDays size={11} />
              {periodLabel}
            </span>
          </div>

          <h3 className="text-2xl md:text-[1.85rem] font-serif text-stone-800 leading-[1.15] tracking-tight">
            {report.title}
          </h3>
          <p className="mt-3 text-stone-600 italic font-serif text-base leading-relaxed">
            {report.headline}
          </p>
          <p className="mt-4 text-sm text-stone-500 leading-relaxed line-clamp-3">
            {report.summary}
          </p>

          {themes.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {themes.map((t) => (
                <span
                  key={t.name}
                  className="inline-flex items-center rounded-full bg-white/70 border border-amber-100 px-3 py-1 text-[11px] text-amber-800 font-medium"
                >
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="lg:border-l lg:border-amber-100/80 lg:pl-6 flex flex-col justify-between gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat
              icon={<Lightbulb size={14} />}
              label={isZh ? '关联灵感' : 'Inspirations'}
              value={(report.inspirations || []).length}
              tone="amber"
            />
            <Stat
              icon={<MessageSquare size={14} />}
              label={isZh ? '关联对话' : 'Conversations'}
              value={(report.conversations || []).length}
              tone="amber"
            />
            <Stat
              icon={<TrendingUp size={14} />}
              label={isZh ? '亮点' : 'Highlights'}
              value={(report.highlights || []).length}
              tone="amber"
            />
            <Stat
              icon={<ListChecks size={14} />}
              label={isZh ? '成长方向' : 'Growth areas'}
              value={(report.growthAreas || []).length}
              tone="amber"
            />
          </div>

          <div className="flex items-center justify-end gap-2 text-sm font-medium text-amber-700 group-hover:text-amber-900 transition-colors">
            <span>{isZh ? '展开月度报告' : 'Open monthly report'}</span>
            <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function WeeklyCard({
  report,
  isZh,
  periodLabel,
  onOpen,
}: {
  report: GrowthReport;
  isZh: boolean;
  periodLabel: string;
  onOpen: () => void;
}) {
  const insCount = (report.inspirations || []).length;
  const convCount = (report.conversations || []).length;
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="group relative w-full text-left overflow-hidden rounded-[1.75rem] border border-stone-100 bg-white shadow-[0_20px_50px_-30px_rgba(15,118,110,0.25)] hover:shadow-[0_28px_70px_-30px_rgba(15,118,110,0.35)] transition-all"
    >
      <div className="absolute left-0 top-6 bottom-6 w-1 rounded-r-full bg-gradient-to-b from-emerald-300 via-emerald-400 to-teal-300" />

      <div className="relative pl-5 pr-5 py-5 md:py-6 flex flex-col h-full min-h-[16rem]">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em]">
            <CalendarDays size={10} />
            {isZh ? '周报告' : 'Weekly'}
          </span>
          <span className="text-[10px] uppercase tracking-[0.24em] text-stone-300">{periodLabel}</span>
        </div>

        <h3 className="text-lg md:text-xl font-serif text-stone-800 leading-tight tracking-tight line-clamp-2">
          {report.title}
        </h3>
        <p className="mt-2 text-sm text-stone-500 italic line-clamp-2">{report.headline}</p>

        <p className="mt-3 text-[13px] text-stone-500 leading-relaxed line-clamp-3">
          {report.summary}
        </p>

        <div className="mt-auto pt-4 flex items-center justify-between gap-2 text-[11px] text-stone-400">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Lightbulb size={11} /> {insCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare size={11} /> {convCount}
            </span>
            {(report.themes || []).length > 0 && (
              <span className="inline-flex items-center gap-1 text-stone-500">
                <Sparkles size={11} /> {report.themes[0].name}
              </span>
            )}
          </div>
          <ChevronRight
            size={14}
            className="text-stone-300 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all"
          />
        </div>
      </div>
    </motion.button>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'amber' | 'emerald' | 'stone';
}) {
  const wrapper =
    tone === 'amber'
      ? 'bg-white/70 border-amber-100'
      : tone === 'emerald'
        ? 'bg-emerald-50/80 border-emerald-100'
        : 'bg-stone-50 border-stone-100';
  const labelColor =
    tone === 'amber' ? 'text-amber-700' : tone === 'emerald' ? 'text-emerald-700' : 'text-stone-500';
  return (
    <div className={`rounded-2xl border ${wrapper} px-3 py-3`}>
      <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-[0.24em] ${labelColor}`}>
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-serif text-stone-800 leading-none">{value}</div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* Detail modal                                                           */
/* ────────────────────────────────────────────────────────────────────── */

function ReportDetailModal({
  report,
  isZh,
  periodLabel,
  showAllInspirations,
  showAllConversations,
  onToggleAllInspirations,
  onToggleAllConversations,
  onClose,
  onChatAbout,
  resolveInspiration,
  resolveConversation,
}: {
  report: GrowthReport;
  isZh: boolean;
  periodLabel: string;
  showAllInspirations: boolean;
  showAllConversations: boolean;
  onToggleAllInspirations: () => void;
  onToggleAllConversations: () => void;
  onClose: () => void;
  onChatAbout: () => void;
  resolveInspiration: (
    item: GrowthReportInspiration,
  ) => GrowthReportInspiration & { isReal: boolean };
  resolveConversation: (
    item: GrowthReportConversation,
  ) => GrowthReportConversation & { isReal: boolean };
}) {
  const isMonthly = report.kind === 'monthly';

  const allInspirations = (report.inspirations || []).map(resolveInspiration);
  const allConversations = (report.conversations || []).map(resolveConversation);

  const visibleInspirations = showAllInspirations
    ? allInspirations
    : allInspirations.slice(0, PREVIEW_LIMIT);
  const visibleConversations = showAllConversations
    ? allConversations
    : allConversations.slice(0, PREVIEW_LIMIT);

  return (
    <div className="fixed inset-0 z-[450] flex items-stretch md:items-center justify-center p-0 md:p-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-stone-950/45 backdrop-blur-md"
      />
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        className="relative w-full md:max-w-4xl h-full md:h-auto md:max-h-[92vh] bg-white md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div
          className={`relative sticky top-0 z-10 px-5 sm:px-7 md:px-10 pt-6 md:pt-8 pb-5 md:pb-6 border-b border-stone-100 ${
            isMonthly
              ? 'bg-[linear-gradient(135deg,#fff8ec_0%,#fff_55%,#fdf3e0_100%)]'
              : 'bg-[linear-gradient(135deg,#ecfdf5_0%,#fff_55%,#f0fdfa_100%)]'
          }`}
        >
          <div
            className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent ${
              isMonthly ? 'via-amber-400' : 'via-emerald-400'
            } to-transparent`}
          />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full ${
                    isMonthly ? 'bg-amber-600' : 'bg-emerald-600'
                  } text-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em]`}
                >
                  {isMonthly ? <Compass size={11} /> : <CalendarDays size={11} />}
                  {isMonthly ? (isZh ? '月度报告' : 'Monthly') : isZh ? '周报告' : 'Weekly'}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.24em] text-stone-500">
                  {periodLabel}
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-serif text-stone-800 leading-tight tracking-tight">
                {report.title}
              </h2>
              <p className="mt-2 text-stone-600 italic font-serif">{report.headline}</p>
              {report.tags && report.tags.length > 0 && (
                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  {report.tags.map((t) => (
                    <span
                      key={t}
                      className={`text-[10px] uppercase tracking-[0.24em] rounded-full px-2.5 py-1 ${
                        isAhaMomentTag(t)
                          ? 'text-amber-800 bg-amber-100 border border-amber-300'
                          : 'text-stone-400 bg-white/70 border border-stone-100'
                      }`}
                    >
                      {getInspirationTagLabel(t, isZh ? 'zh' : 'en')}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-2 sm:p-3 bg-white/70 hover:bg-white border border-stone-100 rounded-2xl text-stone-500 hover:text-stone-900 transition-all"
              aria-label={isZh ? '关闭' : 'Close'}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 sm:p-7 md:p-10 space-y-6 pb-24 md:pb-10">
          {/* Summary */}
          <div className="rounded-[1.5rem] border border-stone-100 bg-stone-50/70 p-5 md:p-6">
            <SectionLabel label={isZh ? '总结' : 'Summary'} />
            <p className="mt-3 text-base leading-relaxed text-stone-700 whitespace-pre-wrap">
              {report.summary}
            </p>
          </div>

          {/* Highlights */}
          {report.highlights && report.highlights.length > 0 && (
            <div className="rounded-[1.5rem] border border-stone-100 bg-white p-5 md:p-6">
              <SectionLabel label={isZh ? '本期亮点' : 'Highlights'} icon={<TrendingUp size={12} />} />
              <ul className="mt-3 space-y-2.5">
                {report.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-3 text-stone-700 text-[15px] leading-relaxed">
                    <span
                      className={`mt-2 h-1.5 w-1.5 rounded-full shrink-0 ${
                        isMonthly ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                    />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Themes */}
          {report.themes && report.themes.length > 0 && (
            <div className="rounded-[1.5rem] border border-stone-100 bg-white p-5 md:p-6">
              <SectionLabel label={isZh ? '关键主题' : 'Themes'} icon={<Sparkles size={12} />} />
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {report.themes.map((t) => (
                  <div
                    key={t.name}
                    className={`rounded-2xl border p-4 ${
                      isMonthly ? 'bg-amber-50/60 border-amber-100' : 'bg-emerald-50/60 border-emerald-100'
                    }`}
                  >
                    <div className="text-[15px] font-serif text-stone-800">{t.name}</div>
                    {t.description && (
                      <p className="mt-1 text-sm text-stone-600 leading-relaxed">{t.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Emotional tone + Growth areas */}
          {(report.emotionalTone || (report.growthAreas && report.growthAreas.length > 0)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.emotionalTone && (
                <div className="rounded-[1.5rem] border border-stone-100 bg-white p-5 md:p-6">
                  <SectionLabel label={isZh ? '情绪基调' : 'Emotional tone'} icon={<Heart size={12} />} />
                  <p className="mt-3 text-stone-700 leading-relaxed">{report.emotionalTone}</p>
                </div>
              )}
              {report.growthAreas && report.growthAreas.length > 0 && (
                <div className="rounded-[1.5rem] border border-stone-100 bg-white p-5 md:p-6">
                  <SectionLabel label={isZh ? '成长方向' : 'Growth areas'} icon={<ListChecks size={12} />} />
                  <ul className="mt-3 space-y-2">
                    {report.growthAreas.map((g, i) => (
                      <li key={i} className="text-stone-700 leading-relaxed flex items-start gap-2">
                        <span className="mt-2 h-1 w-1 rounded-full bg-stone-400 shrink-0" />
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Linked inspirations */}
          {allInspirations.length > 0 && (
            <div className="rounded-[1.5rem] border border-stone-100 bg-white p-5 md:p-6">
              <div className="flex items-center justify-between gap-3">
                <SectionLabel
                  label={`${isZh ? '关联灵感' : 'Linked Inspirations'} · ${allInspirations.length}`}
                  icon={<Lightbulb size={12} />}
                />
                {allInspirations.length > PREVIEW_LIMIT && (
                  <button
                    type="button"
                    onClick={onToggleAllInspirations}
                    className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors"
                  >
                    {showAllInspirations
                      ? isZh
                        ? '收起'
                        : 'Collapse'
                      : `${isZh ? '查看全部' : 'View all'} (${allInspirations.length})`}
                    <ChevronDown
                      size={12}
                      className={`transition-transform ${showAllInspirations ? 'rotate-180' : ''}`}
                    />
                  </button>
                )}
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {visibleInspirations.map((item, idx) => (
                  <div
                    key={item.id || `mock-${idx}`}
                    className="rounded-2xl border border-stone-100 bg-stone-50/70 p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] uppercase tracking-[0.24em] text-stone-300">
                        {format(item.createdAt, isZh ? 'M 月 d 日 HH:mm' : 'PPpp')}
                      </span>
                      {!item.isReal && (
                        <span className="text-[10px] uppercase tracking-[0.18em] text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-1.5 py-0.5">
                          {isZh ? '示例' : 'Sample'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-stone-700 leading-relaxed">
                      {shortenText(item.content, 160)}
                    </p>
                    {item.tags && item.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className={`text-[10px] rounded-full px-2 py-0.5 ${
                              isAhaMomentTag(t)
                                ? 'text-amber-800 bg-amber-100 border border-amber-300'
                                : 'text-stone-500 bg-white border border-stone-100'
                            }`}
                          >
                            {getInspirationTagLabel(t, isZh ? 'zh' : 'en')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linked conversations */}
          {allConversations.length > 0 && (
            <div className="rounded-[1.5rem] border border-stone-100 bg-white p-5 md:p-6">
              <div className="flex items-center justify-between gap-3">
                <SectionLabel
                  label={`${isZh ? '关联对话' : 'Linked Conversations'} · ${allConversations.length}`}
                  icon={<MessageSquare size={12} />}
                />
                {allConversations.length > PREVIEW_LIMIT && (
                  <button
                    type="button"
                    onClick={onToggleAllConversations}
                    className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors"
                  >
                    {showAllConversations
                      ? isZh
                        ? '收起'
                        : 'Collapse'
                      : `${isZh ? '查看全部' : 'View all'} (${allConversations.length})`}
                    <ChevronDown
                      size={12}
                      className={`transition-transform ${showAllConversations ? 'rotate-180' : ''}`}
                    />
                  </button>
                )}
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {visibleConversations.map((item, idx) => (
                  <div
                    key={item.id || `mockc-${idx}`}
                    className="rounded-2xl border border-stone-100 bg-stone-50/70 p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] uppercase tracking-[0.24em] text-stone-300">
                        {format(item.createdAt, isZh ? 'M 月 d 日 HH:mm' : 'PPpp')}
                      </span>
                      {!item.isReal && (
                        <span className="text-[10px] uppercase tracking-[0.18em] text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-1.5 py-0.5">
                          {isZh ? '示例' : 'Sample'}
                        </span>
                      )}
                    </div>
                    <div className="text-[15px] font-serif text-stone-800 leading-snug">
                      {item.title}
                    </div>
                    <p className="mt-1 text-sm text-stone-500 leading-relaxed line-clamp-2">
                      {item.preview}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onChatAbout}
              className={`inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-md transition-all ${
                isMonthly ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <MessageSquare size={16} />
              {isZh ? '聊聊这份报告' : 'Chat about this report'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function SectionLabel({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-stone-400">
      {icon}
      {label}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* Saved AI insight report detail modal (legacy archive)                  */
/* ────────────────────────────────────────────────────────────────────── */

function ArchiveDetailModal({
  rec,
  isZh,
  lang,
  inspirations,
  onClose,
  onDelete,
  onChatAbout,
}: {
  rec: any;
  isZh: boolean;
  lang: 'zh' | 'en';
  inspirations: Inspiration[];
  onClose: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onChatAbout: () => void;
}) {
  const r = rec.report || rec;
  const themes = Array.isArray(r.recurringThemes) ? r.recurringThemes : [];
  const reportInsights = Array.isArray(r.insights) ? r.insights : [];
  const actions = Array.isArray(r.recommendedActions) ? r.recommendedActions : [];
  const sourceIds: string[] = Array.isArray(rec.sourceIds)
    ? rec.sourceIds
    : Array.isArray(r.sourceIds)
      ? r.sourceIds
      : [];
  const reportType =
    rec.reportType ||
    (r.themeProgress ? 'life_theme' : themes.length > 0 ? 'life_theme' : 'inspiration_overview');
  const scope = rec.scope || r.scope;
  const scopeTagRaw = scope?.tag && scope.tag !== 'all' ? scope.tag : '';
  const scopeTagLabel = scopeTagRaw ? getInspirationTagLabel(scopeTagRaw, lang) : '';
  const badgeLabel = scopeTagLabel
    ? isZh
      ? `${scopeTagLabel}洞察`
      : `${scopeTagLabel} Insights`
    : scope?.tag === 'all'
      ? isZh
        ? '综合洞察'
        : 'Composite Insights'
      : reportType === 'life_theme'
        ? isZh
          ? '人生课题'
          : 'Life Theme'
        : isZh
          ? '灵感洞察'
          : 'Inspiration';

  return (
    <div className="fixed inset-0 z-[455] flex items-stretch md:items-center justify-center p-0 md:p-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-stone-950/45 backdrop-blur-md"
      />
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        className="relative w-full md:max-w-4xl h-full md:h-auto md:max-h-[92vh] bg-white md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm p-5 sm:p-7 md:p-8 border-b border-stone-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-stone-900 text-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em]">
                <FileText size={11} />
                {badgeLabel}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.28em] text-stone-400">
                <CalendarDays size={11} />
                {format(rec.createdAt, 'PPpp')}
              </span>
            </div>
            <h3 className="text-2xl md:text-3xl font-serif text-stone-800 leading-tight tracking-tight">
              {r.title || rec.title || (isZh ? '未命名报告' : 'Untitled report')}
            </h3>
            {scope && (
              <div className="mt-2 text-xs text-stone-400">
                {scope.count || sourceIds.length || 0} {isZh ? '条记录' : 'records'}
                {scopeTagLabel
                  ? ` · ${scopeTagLabel}`
                  : scope.tag === 'all'
                    ? ` · ${isZh ? '综合' : 'Composite'}`
                    : ''}
                {scope.query ? ` · "${scope.query}"` : ''}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onDelete}
              className="p-2 sm:p-3 bg-stone-50 hover:bg-red-50 rounded-xl sm:rounded-2xl text-stone-400 hover:text-red-500 transition-all"
              title={isZh ? '删除报告' : 'Delete report'}
            >
              <Trash2 size={18} />
            </button>
            <button
              onClick={onClose}
              className="p-2 sm:p-3 bg-stone-50 hover:bg-stone-100 rounded-xl sm:rounded-2xl text-stone-400 hover:text-stone-900 transition-all"
              title={isZh ? '关闭' : 'Close'}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-7 md:p-10 overflow-y-auto space-y-5 sm:space-y-6 pb-24 md:pb-10">
          {(r.summary || rec.summary) && (
            <div className="rounded-[1.5rem] border border-stone-100 bg-stone-50/70 p-5 md:p-6">
              <SectionLabel label={isZh ? '总结' : 'Summary'} />
              <p className="mt-3 text-base leading-relaxed text-stone-700 whitespace-pre-wrap">
                {r.summary || rec.summary}
              </p>
            </div>
          )}

          {rec.reportType === 'life_theme' && themes.length > 0 && (
            <div className="rounded-[1.5rem] border border-stone-100 bg-white p-5 md:p-6">
              <SectionLabel
                label={isZh ? '人生课题' : 'Recurring Themes'}
                icon={<BrainCircuit size={12} />}
              />
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {themes.map((th: any, i: number) => (
                  <div key={i} className="rounded-2xl bg-stone-50 border border-stone-100 p-4">
                    <div className="text-base font-serif text-stone-800 leading-snug">
                      {th.theme || th}
                    </div>
                    {Array.isArray(th.examples) && th.examples.length > 0 && (
                      <div className="mt-2 text-[10px] uppercase tracking-[0.24em] text-stone-400">
                        {th.examples.length} {isZh ? '条线索' : 'signals'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {reportInsights.length > 0 && (
            <div className="rounded-[1.5rem] border border-stone-100 bg-white p-5 md:p-6">
              <SectionLabel
                label={isZh ? '结构化洞察' : 'Structured Insights'}
                icon={<Sparkles size={12} />}
              />
              <div className="mt-3 space-y-3">
                {reportInsights.map((item: any, i: number) => (
                  <div key={i} className="rounded-2xl bg-stone-50 border border-stone-100 p-4">
                    <div className="text-sm font-medium text-stone-800">
                      {item.theme ||
                        item.cognitivePattern ||
                        `${isZh ? '洞察' : 'Insight'} ${i + 1}`}
                    </div>
                    {item.cognitivePattern && item.theme && (
                      <div className="mt-2 text-sm text-stone-600 leading-relaxed">
                        <span className="text-[10px] uppercase tracking-[0.24em] text-stone-400 mr-2">
                          {isZh ? '认知' : 'Pattern'}
                        </span>
                        {item.cognitivePattern}
                      </div>
                    )}
                    {item.emotionalSignal && (
                      <div className="mt-2 text-sm text-stone-600 leading-relaxed">
                        <span className="text-[10px] uppercase tracking-[0.24em] text-stone-400 mr-2">
                          {isZh ? '情绪' : 'Signal'}
                        </span>
                        {item.emotionalSignal}
                      </div>
                    )}
                    {Array.isArray(item.cbtInterventions) &&
                      item.cbtInterventions.length > 0 && (
                        <div className="mt-2 text-sm text-stone-600 leading-relaxed">
                          <span className="text-[10px] uppercase tracking-[0.24em] text-stone-400 mr-2">
                            {isZh ? '干预' : 'CBT'}
                          </span>
                          {item.cbtInterventions.join('；')}
                        </div>
                      )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {actions.length > 0 && (
            <div className="rounded-[1.5rem] border border-stone-100 bg-white p-5 md:p-6">
              <SectionLabel
                label={isZh ? '建议行动' : 'Recommended Actions'}
                icon={<ListChecks size={12} />}
              />
              <div className="mt-3 space-y-3">
                {actions.map((action: any, i: number) => (
                  <div key={i} className="rounded-2xl bg-stone-50 border border-stone-100 p-4">
                    <div className="text-sm font-medium text-stone-800">
                      {typeof action === 'string'
                        ? action
                        : action.objective || `${isZh ? '行动' : 'Action'} ${i + 1}`}
                    </div>
                    {typeof action === 'object' && action?.rationale && (
                      <div className="mt-2 text-sm text-stone-500 leading-relaxed">
                        {action.rationale}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sourceIds.length > 0 && (
            <div className="rounded-[1.5rem] border border-stone-100 bg-white p-5 md:p-6">
              <SectionLabel
                label={`${isZh ? '来源记录' : 'Source Records'} · ${sourceIds.length}`}
                icon={<Lightbulb size={12} />}
              />
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {sourceIds.map((sid) => {
                  const ins = (inspirations || []).find((i) => i.id === sid);
                  if (!ins) {
                    return (
                      <div
                        key={sid}
                        className="rounded-2xl border border-dashed border-stone-100 bg-white p-3 text-xs text-stone-300"
                      >
                        {isZh ? '已删除的记录' : 'Removed record'}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={sid}
                      className="rounded-2xl border border-stone-100 bg-stone-50 p-4"
                    >
                      <div className="text-sm text-stone-700 leading-relaxed line-clamp-3">
                        {shortenText(ins.content, 120)}
                      </div>
                      <div className="mt-2 text-[10px] uppercase tracking-[0.24em] text-stone-300">
                        {format(ins.createdAt, 'PPpp')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onChatAbout}
              className="inline-flex items-center gap-2 px-5 py-3 bg-stone-900 text-white rounded-2xl text-sm font-semibold hover:bg-black transition-all"
            >
              <MessageSquare size={16} />
              {isZh ? '基于此报告聊聊' : 'Chat about this report'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
