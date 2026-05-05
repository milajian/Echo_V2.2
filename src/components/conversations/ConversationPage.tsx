/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Send, Trash2, MessageSquare, Bot, User as UserIcon, Loader2, ChevronLeft, Pencil, Check, X, Sparkles, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { continueChat, getAIInspirationTags } from '../../services/gemini';
import { addDocument } from '../../hooks/useFirebase';
import { buildInspirationPayload } from '../../lib/textPromotions';
import { ConversationSeed } from '../../types';
import { getInspirationTagLabel, isAhaMomentTag } from '../../constants/inspirationTags';

interface Conversation {
  id: string;
  title: string;
  tags?: string[];
  inspirationId?: string;
  createdAt: number;
  updatedAt: number;
}

const getConversationTagLabel = (tag: string, lang: 'zh' | 'en') => {
  if (tag === 'composite') return lang === 'zh' ? '综合' : 'Composite';
  return getInspirationTagLabel(tag, lang);
};

interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'model';
  content: string;
  createdAt: number;
}

const markdownComponents = {
  p: ({ node, ...props }: any) => <p className="mb-2 last:mb-0" {...props} />,
  ul: ({ node, ...props }: any) => <ul className="list-disc pl-5 mb-2 last:mb-0 space-y-1" {...props} />,
  ol: ({ node, ...props }: any) => <ol className="list-decimal pl-5 mb-2 last:mb-0 space-y-1" {...props} />,
  li: ({ node, ...props }: any) => <li className="leading-relaxed" {...props} />,
  code: ({ node, className, children, ...props }: any) => {
    const isInline = !className;
    if (isInline) return <code className="px-1 py-0.5 rounded bg-stone-100 text-stone-800" {...props}>{children}</code>;
    return (
      <pre className="bg-stone-900 text-stone-100 rounded-xl p-3 overflow-x-auto text-xs mb-2 last:mb-0">
        <code className={className} {...props}>{children}</code>
      </pre>
    );
  },
};

async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new CustomEvent('auth-unauthorized'));
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

interface ConversationPageProps {
  lang?: 'zh' | 'en';
  pendingSeed?: ConversationSeed | null;
  onSeedConsumed?: () => void;
  activeId?: string | null;
  onActiveIdChange?: (id: string | null) => void;
  onOpenInspiration?: (inspirationId: string) => void;
}

export default function ConversationPage({ lang = 'zh', pendingSeed, onSeedConsumed, activeId, onActiveIdChange, onOpenInspiration }: ConversationPageProps) {
  const isZh = lang === 'zh';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const setActiveId = (id: string | null) => onActiveIdChange?.(id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [selectionText, setSelectionText] = useState('');
  const [selectionPosition, setSelectionPosition] = useState<{ x: number, y: number } | null>(null);
  const [isDistilling, setIsDistilling] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selectionHintDismissed, setSelectionHintDismissed] = useState(true);
  const selectionMenuRef = useRef<HTMLDivElement | null>(null);
  const seedHandledRef = useRef<string | null>(null);
  const [pendingContext, setPendingContext] = useState<{ conversationId: string; content: string; label: string } | null>(null);

  useEffect(() => {
    try {
      setSelectionHintDismissed(localStorage.getItem('echo:selection-hint-dismissed') === '1');
    } catch {
      setSelectionHintDismissed(false);
    }
  }, []);

  const dismissSelectionHint = () => {
    setSelectionHintDismissed(true);
    try { localStorage.setItem('echo:selection-hint-dismissed', '1'); } catch {}
  };

  const loadConversations = async (skipAutoActivate = false) => {
    try {
      const list = await api<Conversation[]>('/api/conversations');
      setConversations(list);
      if (activeId === undefined && !skipAutoActivate && list.length > 0) setActiveId(list[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingList(false);
    }
  };

  const loadMessages = async (id: string) => {
    try {
      const list = await api<Message[]>(`/api/conversations/${id}/messages`);
      setMessages(list);
    } catch (err) {
      console.error(err);
      setMessages([]);
    }
  };

  const persistMessage = async (conversationId: string, role: 'user' | 'model', content: string) => {
    return api<{ id: string; createdAt: number }>(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ role, content }),
    });
  };

  useEffect(() => { loadConversations(!!pendingSeed); }, []);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
    else setMessages([]);
  }, [activeId]);

  useEffect(() => {
    if (!pendingSeed) return;
    if (seedHandledRef.current === pendingSeed.id) return;
    seedHandledRef.current = pendingSeed.id;

    const seed = pendingSeed;
    const fallbackTitle = isZh ? '新对话' : 'New chat';
    const title = (seed.title || '').trim() || fallbackTitle;
    const autoSend = seed.autoSend !== false;

    const buildUserText = () => {
      const q = (seed.question || '').trim();
      const c = (seed.content || '').trim();
      if (!c || c === q) return q || c;
      if (!q) return c;
      return `${q}\n\n${c}`;
    };

    (async () => {
      if (autoSend) setIsSending(true);
      try {
        const created = await api<{ id: string; title: string; tags?: string[]; inspirationId?: string; createdAt: number; updatedAt: number }>(
          '/api/conversations',
          { method: 'POST', body: JSON.stringify({ title, tags: seed.tags || [], inspirationId: seed.inspirationId }) }
        );
        const conv: Conversation = {
          id: created.id,
          title: created.title,
          tags: created.tags || seed.tags || [],
          inspirationId: created.inspirationId ?? seed.inspirationId,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        };
        setConversations(prev => [conv, ...prev]);

        if (!autoSend) {
          setActiveId(conv.id);
          setMessages([]);
          const ctx = (seed.content || '').trim();
          if (ctx) {
            setPendingContext({ conversationId: conv.id, content: ctx, label: title });
          }
          setTimeout(() => inputRef.current?.focus(), 0);
          return;
        }

        const userText = buildUserText();
        const savedUser = await persistMessage(conv.id, 'user', userText);
        const userMsg: Message = {
          id: savedUser.id,
          conversationId: conv.id,
          role: 'user',
          content: userText,
          createdAt: savedUser.createdAt,
        };

        setActiveId(conv.id);
        setMessages([userMsg]);

        const reply = await continueChat([], userText, lang);
        const savedReply = await persistMessage(conv.id, 'model', reply);
        const modelMsg: Message = {
          id: savedReply.id,
          conversationId: conv.id,
          role: 'model',
          content: reply,
          createdAt: savedReply.createdAt,
        };
        setMessages(prev => (prev.some(m => m.id === modelMsg.id) ? prev : [...prev, modelMsg]));

        setConversations(prev => {
          const updated = prev.map(c => (c.id === conv.id ? { ...c, updatedAt: Date.now() } : c));
          return [...updated].sort((a, b) => b.updatedAt - a.updatedAt);
        });
      } catch (err: any) {
        console.error('Failed to seed conversation', err);
      } finally {
        if (autoSend) setIsSending(false);
        onSeedConsumed?.();
      }
    })();
  }, [pendingSeed]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isSending]);

  const createConversation = async () => {
    const created = await api<{ id: string; title: string; createdAt: number; updatedAt: number }>(
      '/api/conversations',
      { method: 'POST', body: JSON.stringify({ title: isZh ? '新对话' : 'New chat' }) }
    );
    const conv: Conversation = { id: created.id, title: created.title, createdAt: created.createdAt, updatedAt: created.updatedAt };
    setConversations(prev => [conv, ...prev]);
    setActiveId(conv.id);
    setMessages([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const deleteConversation = async (id: string) => {
    const ok = window.confirm(isZh ? '确认删除这个对话？此操作无法撤销。' : 'Delete this conversation? This cannot be undone.');
    if (!ok) return;
    await api(`/api/conversations/${id}`, { method: 'DELETE' });
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
  };

  const renameConversation = async (id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    await api(`/api/conversations/${id}`, { method: 'PUT', body: JSON.stringify({ title: trimmed }) });
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title: trimmed, updatedAt: Date.now() } : c));
    setRenamingId(null);
  };

  const clearSelection = () => {
    setSelectionText('');
    setSelectionPosition(null);
  };

  useEffect(() => {
    if (!selectionPosition) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (selectionMenuRef.current && target && selectionMenuRef.current.contains(target)) return;
      clearSelection();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [selectionPosition]);

  const handleMessagesMouseUp = () => {
    window.requestAnimationFrame(() => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() || '';
      if (!sel || !text || text.length <= 5) {
        clearSelection();
        return;
      }
      const range = sel.getRangeAt(0);
      let node: Node | null = range.startContainer;
      let inModelMessage = false;
      while (node) {
        if (node instanceof HTMLElement && node.dataset.messageRole === 'model') {
          inModelMessage = true;
          break;
        }
        node = node.parentNode;
      }
      if (!inModelMessage) {
        clearSelection();
        return;
      }
      const rect = range.getBoundingClientRect();
      setSelectionText(text);
      setSelectionPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
      });
    });
  };

  const distillSelectionAsInspiration = async () => {
    const text = selectionText.trim();
    if (!text || isDistilling) return;
    setIsDistilling(true);
    try {
      const aiTags = await getAIInspirationTags(text);
      const tags = Array.from(new Set(['echo', ...(aiTags || [])])).slice(0, 4);
      await addDocument('inspirations', {
        ...buildInspirationPayload(text),
        tags,
        userId: '',
      });
      setToast(isZh ? '已沉淀到灵感' : 'Saved to inspirations');
      setTimeout(() => setToast(null), 2000);
      window.getSelection()?.removeAllRanges();
      clearSelection();
    } catch (err: any) {
      console.error(err);
      setToast(isZh ? '保存失败，请重试' : 'Failed to save, please retry');
      setTimeout(() => setToast(null), 2500);
    } finally {
      setIsDistilling(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    let convId = activeId;
    let isFirstMessage = false;

    if (!convId) {
      const created = await api<{ id: string; title: string; createdAt: number; updatedAt: number }>(
        '/api/conversations',
        { method: 'POST', body: JSON.stringify({ title: isZh ? '新对话' : 'New chat' }) }
      );
      const conv: Conversation = { id: created.id, title: created.title, createdAt: created.createdAt, updatedAt: created.updatedAt };
      setConversations(prev => [conv, ...prev]);
      setActiveId(conv.id);
      convId = conv.id;
      isFirstMessage = true;
    } else {
      isFirstMessage = messages.length === 0;
    }

    setInput('');
    setIsSending(true);

    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      conversationId: convId,
      role: 'user',
      content: text,
      createdAt: Date.now(),
    };
    const contextForThisSend = pendingContext && pendingContext.conversationId === convId ? pendingContext : null;
    const contextPreamble: { role: 'user' | 'model'; text: string }[] = contextForThisSend
      ? [
          {
            role: 'user',
            text: isZh
              ? `参考报告「${contextForThisSend.label}」：\n\n${contextForThisSend.content}`
              : `Reference report "${contextForThisSend.label}":\n\n${contextForThisSend.content}`,
          },
          {
            role: 'model',
            text: isZh
              ? '收到，我会基于这份报告的内容来回应你接下来的问题。'
              : 'Got it. I will draw on this report when responding to your next message.',
          },
        ]
      : [];
    const historyForAI = [...contextPreamble, ...messages.map(m => ({ role: m.role, text: m.content }))];
    if (contextForThisSend) setPendingContext(null);
    setMessages(prev => [...prev, userMsg]);

    try {
      const savedUser = await persistMessage(convId, 'user', text);
      setMessages(prev => prev.map(m => m.id === userMsg.id ? { ...m, id: savedUser.id, createdAt: savedUser.createdAt } : m));

      if (isFirstMessage) {
        const autoTitle = text.slice(0, 20) + (text.length > 20 ? '…' : '');
        await renameConversation(convId, autoTitle).catch(() => {});
      }

      const reply = await continueChat(historyForAI, text, lang);
      const savedReply = await persistMessage(convId, 'model', reply);
      const modelMsg: Message = {
        id: savedReply.id,
        conversationId: convId,
        role: 'model',
        content: reply,
        createdAt: savedReply.createdAt,
      };
      setMessages(prev => [...prev, modelMsg]);
      setConversations(prev => {
        const updated = prev.map(c => c.id === convId ? { ...c, updatedAt: Date.now() } : c);
        return [...updated].sort((a, b) => b.updatedAt - a.updatedAt);
      });
    } catch (err: any) {
      console.error(err);
      const errMsg: Message = {
        id: `err-${Date.now()}`,
        conversationId: convId!,
        role: 'model',
        content: isZh ? `抱歉，我刚刚处理这条消息时遇到了一点问题。${err?.message ? `（${err.message}）` : ''}` : `Sorry, I had trouble responding. ${err?.message || ''}`,
        createdAt: Date.now(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString(isZh ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
  };

  const activeConv = conversations.find(c => c.id === activeId) || null;

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden">
      <div className="lg:grid lg:grid-cols-[300px_1fr] lg:h-screen">
        {/* Sidebar: conversation list */}
        <aside className={`border-r border-stone-100 bg-white/60 lg:flex lg:flex-col ${activeId ? 'hidden lg:flex' : 'flex flex-col min-h-screen lg:min-h-0'}`}>
          <div className="p-6 lg:p-5 border-b border-stone-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-2xl text-stone-800">{isZh ? '对话' : 'Conversations'}</h2>
              <button
                onClick={createConversation}
                className="p-2 bg-stone-900 text-white rounded-xl hover:bg-black transition-all shadow-sm"
                aria-label={isZh ? '新对话' : 'New chat'}
              >
                <Plus size={18} />
              </button>
            </div>
            <p className="text-xs text-stone-400">{isZh ? '与 Echo 自由对谈，所有记录会被保存。' : 'Chat freely with Echo. Every message is saved.'}</p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-hide">
            {loadingList ? (
              <div className="text-center text-stone-400 text-xs py-6">{isZh ? '加载中…' : 'Loading…'}</div>
            ) : conversations.length === 0 ? (
              <div className="text-center text-stone-400 text-xs py-12 px-4">
                {isZh ? '还没有对话。点击右上角 + 开始一次新的对谈。' : 'No conversations yet. Tap + above to start one.'}
              </div>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`group rounded-2xl px-4 py-3 cursor-pointer transition-all ${
                    activeId === conv.id ? 'bg-stone-900 text-white' : 'hover:bg-stone-100 text-stone-700'
                  }`}
                  onClick={() => setActiveId(conv.id)}
                >
                  <div className="flex items-start gap-3">
                    <MessageSquare size={16} className="mt-0.5 flex-shrink-0 opacity-70" />
                    <div className="flex-1 min-w-0">
                      {renamingId === conv.id ? (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <input
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') renameConversation(conv.id, renameValue);
                              if (e.key === 'Escape') setRenamingId(null);
                            }}
                            autoFocus
                            className="flex-1 bg-white text-stone-800 text-sm px-2 py-1 rounded-lg outline-none border border-stone-200"
                          />
                          <button onClick={() => renameConversation(conv.id, renameValue)} className="p-1 hover:opacity-70"><Check size={14} /></button>
                          <button onClick={() => setRenamingId(null)} className="p-1 hover:opacity-70"><X size={14} /></button>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-medium truncate">{conv.title}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className={`text-[10px] ${activeId === conv.id ? 'text-stone-300' : 'text-stone-400'}`}>{formatTime(conv.updatedAt)}</span>
                            {conv.tags && conv.tags.length > 0 && conv.tags.map(tag => {
                              const isAha = isAhaMomentTag(tag);
                              const isActive = activeId === conv.id;
                              return (
                                <span
                                  key={tag}
                                  className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                                    isActive
                                      ? isAha
                                        ? 'bg-amber-400 text-stone-900'
                                        : 'bg-white/15 text-stone-100'
                                      : isAha
                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                        : 'bg-stone-100 text-stone-500'
                                  }`}
                                >
                                  {getConversationTagLabel(tag, isZh ? 'zh' : 'en')}
                                </span>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                    {renamingId !== conv.id && (
                      <div className={`flex items-center gap-1 ${activeId === conv.id ? 'opacity-80' : 'opacity-0 group-hover:opacity-60'} transition-opacity`}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setRenamingId(conv.id); setRenameValue(conv.title); }}
                          className="p-1 hover:opacity-100"
                          aria-label={isZh ? '重命名' : 'Rename'}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                          className="p-1 hover:opacity-100"
                          aria-label={isZh ? '删除' : 'Delete'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Main: chat panel */}
        <section className={`lg:flex lg:flex-col lg:h-screen ${activeId ? 'flex flex-col min-h-screen' : 'hidden lg:flex'}`}>
          {/* Mobile header with back button */}
          <div className="lg:hidden sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-stone-100 px-4 py-3 flex items-center gap-3">
            <button onClick={() => setActiveId(null)} className="p-2 -ml-2 rounded-xl hover:bg-stone-100">
              <ChevronLeft size={20} className="text-stone-600" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-800 truncate">{activeConv?.title || (isZh ? '新对话' : 'New chat')}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[10px] uppercase tracking-widest text-stone-400">Echo Dialogue</span>
                {activeConv?.tags?.map(tag => (
                  <span
                    key={tag}
                    className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                      isAhaMomentTag(tag)
                        ? 'bg-amber-400 text-stone-900 border border-amber-500 shadow-sm shadow-amber-500/30'
                        : 'bg-amber-50 text-amber-700 border border-amber-100'
                    }`}
                  >
                    {getConversationTagLabel(tag, isZh ? 'zh' : 'en')}
                  </span>
                ))}
              </div>
            </div>
            {activeConv?.inspirationId && onOpenInspiration && (
              <button
                onClick={() => onOpenInspiration(activeConv.inspirationId!)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-medium whitespace-nowrap transition-colors"
                aria-label={isZh ? '相关灵感' : 'Source inspiration'}
              >
                <Sparkles size={14} className="text-amber-500" />
                {isZh ? '相关灵感' : 'Source'}
              </button>
            )}
          </div>

          {/* Desktop header */}
          <div className="hidden lg:flex items-center gap-3 px-8 py-5 border-b border-stone-100">
            <div className="w-10 h-10 bg-stone-900 rounded-2xl flex items-center justify-center shadow-md">
              <Bot size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-medium text-stone-800 truncate">{activeConv?.title || (isZh ? '开始一次新的对谈' : 'Start a new chat')}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[10px] uppercase tracking-widest text-stone-400">Echo Dialogue</span>
                {activeConv?.tags?.map(tag => (
                  <span
                    key={tag}
                    className={`text-[11px] px-2 py-0.5 rounded-md ${
                      isAhaMomentTag(tag)
                        ? 'bg-amber-400 text-stone-900 border border-amber-500 shadow-sm shadow-amber-500/30'
                        : 'bg-amber-50 text-amber-700 border border-amber-100'
                    }`}
                  >
                    {getConversationTagLabel(tag, isZh ? 'zh' : 'en')}
                  </span>
                ))}
              </div>
            </div>
            {activeConv?.inspirationId && onOpenInspiration && (
              <button
                onClick={() => onOpenInspiration(activeConv.inspirationId!)}
                className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-2xl text-xs font-bold uppercase tracking-widest transition-colors whitespace-nowrap"
              >
                <Sparkles size={14} className="text-amber-500" />
                {isZh ? '相关灵感' : 'Source Inspiration'}
              </button>
            )}
          </div>

          {/* Messages */}
          <div ref={scrollRef} onMouseUp={handleMessagesMouseUp} onTouchEnd={handleMessagesMouseUp} className="flex-1 overflow-y-auto px-3 sm:px-4 lg:px-8 py-6 pb-44 lg:pb-6 scrollbar-hide chat-fade-bottom">
            <div className="max-w-3xl mx-auto space-y-5">
              {messages.length === 0 && !isSending && (
                <div className="text-center py-16 text-stone-400">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-stone-100 flex items-center justify-center">
                    <Bot size={28} className="text-stone-400" />
                  </div>
                  <p className="text-sm font-serif italic">
                    {isZh ? '想聊点什么？把心里的事写下来，让它流动。' : 'What’s on your mind? Let it flow.'}
                  </p>
                </div>
              )}

              <AnimatePresence initial={false}>
                {messages.map(m => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center ${
                      m.role === 'user' ? 'bg-stone-100' : 'bg-stone-900'
                    }`}>
                      {m.role === 'user' ? <UserIcon size={14} className="text-stone-600" /> : <Bot size={14} className="text-white" />}
                    </div>
                    <div
                      data-message-role={m.role}
                      className={`max-w-[88%] sm:max-w-[85%] lg:max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      m.role === 'user'
                        ? 'bg-stone-900 text-white rounded-tr-sm'
                        : 'bg-white border border-stone-100 text-stone-700 shadow-sm rounded-tl-sm'
                    }`}>
                      {m.role === 'model' ? (
                        <ReactMarkdown components={markdownComponents}>
                          {m.content}
                        </ReactMarkdown>
                      ) : (
                        m.content
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isSending && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                  <div className="w-8 h-8 rounded-xl bg-stone-900 flex items-center justify-center flex-shrink-0">
                    <Loader2 size={14} className="text-white animate-spin" />
                  </div>
                  <div className="bg-white border border-stone-100 px-4 py-3 rounded-2xl rounded-tl-sm text-stone-400 text-sm italic shadow-sm">
                    {isZh ? '思考中…' : 'Reflecting…'}
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Input */}
          <div className="chat-input-anchor px-4 lg:px-8 lg:py-5 lg:border-t lg:border-stone-100 lg:bg-white">
            <div className="max-w-3xl mx-auto">
              {pendingContext && pendingContext.conversationId === activeId && (
                <div className="mb-2 flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50/70 px-3 py-2 text-xs text-stone-600">
                  <FileText size={13} className="mt-0.5 flex-shrink-0 text-amber-500" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-stone-700 truncate">
                      {isZh ? '已附加报告作为上下文：' : 'Report attached as context: '}
                      <span className="text-stone-900">{pendingContext.label}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-stone-500 line-clamp-2 whitespace-pre-wrap">
                      {pendingContext.content}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingContext(null)}
                    aria-label={isZh ? '移除附加上下文' : 'Remove attached context'}
                    className="p-1 -m-1 text-stone-400 hover:text-stone-700 transition-colors flex-shrink-0"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              {messages.some(m => m.role === 'model') && !selectionHintDismissed && (
                <div className="flex items-center gap-1.5 mb-2 px-2 text-[11px] text-stone-400">
                  <Sparkles size={11} className="text-amber-400 flex-shrink-0" />
                  <span className="flex-1">
                    {isZh
                      ? '提示：选中 AI 回复中的任意片段，可一键沉淀为灵感'
                      : 'Tip: select any part of Echo’s reply to save it as an inspiration.'}
                  </span>
                  <button
                    type="button"
                    onClick={dismissSelectionHint}
                    aria-label={isZh ? '不再提示' : 'Dismiss'}
                    className="p-1 -m-1 hover:text-stone-600 transition-colors flex-shrink-0"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              <div className="bg-white lg:bg-stone-50 border border-stone-200 rounded-3xl shadow-lg lg:shadow-none p-2 flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  placeholder={isZh ? '问 Echo 一个问题…（Enter 发送，Shift+Enter 换行）' : 'Ask Echo something… (Enter to send, Shift+Enter for newline)'}
                  className="flex-1 bg-transparent resize-none px-3 py-2 text-sm outline-none placeholder:text-stone-400 max-h-40"
                  style={{ minHeight: '40px' }}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = 'auto';
                    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isSending}
                  className="p-2.5 bg-stone-900 text-white rounded-2xl hover:bg-black transition-all disabled:opacity-40 disabled:scale-95 flex-shrink-0"
                  aria-label={isZh ? '发送' : 'Send'}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectionPosition && (
            <div
              ref={selectionMenuRef}
              onMouseDown={(e) => e.preventDefault()}
              style={{
                position: 'fixed',
                left: selectionPosition.x,
                top: selectionPosition.y,
                transform: 'translate(-50%, -100%)',
                zIndex: 9999,
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                className="rounded-2xl bg-stone-900 text-white shadow-2xl ring-2 ring-white/20 overflow-hidden"
              >
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={distillSelectionAsInspiration}
                  disabled={isDistilling}
                  className="px-4 py-2.5 flex items-center gap-2 text-sm font-medium hover:bg-stone-800 disabled:opacity-60 transition-colors"
                >
                  {isDistilling ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-amber-300" />}
                  <span>{isDistilling ? (isZh ? '正在沉淀…' : 'Distilling…') : (isZh ? '沉淀Echo' : 'Save as inspiration')}</span>
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-8 right-8 z-[9999] bg-stone-900 text-white px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium flex items-center gap-2"
            >
              <Sparkles size={14} className="text-amber-300" />
              {toast}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
