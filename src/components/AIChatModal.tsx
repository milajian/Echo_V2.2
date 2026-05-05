import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Send, X, Sparkles, User, Bot, Loader2, Tag } from 'lucide-react';
import { continueChat } from '../services/gemini';
import { addDocument } from '../hooks/useFirebase';
import { buildGoalPayload, buildInspirationPayload, buildThemeReportPayload } from '../lib/textPromotions';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialContext?: string;
  initialQuestion?: string;
  lang?: 'zh' | 'en';
  onComplete?: (conversationText: string) => void;
}

export default function AIChatModal({ isOpen, onClose, initialContext, initialQuestion, lang = 'zh', onComplete }: AIChatModalProps) {
  const isZh = lang === 'zh';
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectionText, setSelectionText] = useState('');
  const [selectionPosition, setSelectionPosition] = useState<{ x: number, y: number } | null>(null);
  const selectionMenuRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && initialContext) {
      const initialMsgs: Message[] = [
        { role: 'model', text: isZh ? `我正在分析你的想法：“${initialContext.slice(0, 50)}...”。你想从哪个角度继续深入？` : `I'm analyzing your thought: "${initialContext.slice(0, 50)}...". How can I help you explore this further?` }
      ];
      if (initialQuestion) {
        initialMsgs.push({ role: 'user', text: initialQuestion });
        setMessages(initialMsgs);
        handleChatMessage(initialQuestion, initialMsgs);
      } else {
        setMessages(initialMsgs);
      }
    }
  }, [isOpen, initialContext, initialQuestion, isZh]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const clearSelection = () => {
    setSelectionText('');
    setSelectionPosition(null);
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

  const handleChatMouseUp = () => {
    window.requestAnimationFrame(() => {
      const selection = window.getSelection()?.toString().trim();
      if (selection && selection.length > 5) {
        setSelectionText(selection);
        const range = window.getSelection()?.getRangeAt(0);
        const rect = range?.getBoundingClientRect();
        if (rect) {
          setSelectionPosition({
            x: rect.left + rect.width / 2,
            y: rect.top + window.scrollY - 40,
          });
        }
      } else {
        clearSelection();
      }
    });
  };

  const promoteSelectionToGoal = async () => {
    if (!selectionText.trim()) return;
    await addDocument('goals', {
      ...buildGoalPayload(selectionText, isZh ? 'AI 对话' : 'AI chat'),
      userId: '',
    });
    clearSelection();
  };

  const promoteSelectionToInspiration = async () => {
    if (!selectionText.trim()) return;
    await addDocument('inspirations', {
      ...buildInspirationPayload(selectionText),
      userId: '',
    });
    clearSelection();
  };

  const promoteSelectionToTheme = async () => {
    if (!selectionText.trim()) return;
    await addDocument('insightReports', buildThemeReportPayload(selectionText, isZh ? 'AI 对话' : 'AI chat'));
    clearSelection();
  };

  const handleChatMessage = async (msg: string, currentMsgs: Message[]) => {
    setIsLoading(true);
    try {
      const response = await continueChat(currentMsgs.map(m => ({ role: m.role, text: m.text })), msg, lang);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (error) {
       setMessages(prev => [...prev, { role: 'model', text: isZh ? '抱歉，我刚刚处理这条消息时遇到了一点问题。' : 'Sorry, I had some trouble processing that.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const onSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const newMsg: Message = { role: 'user', text: input };
    const newMessages = [...messages, newMsg];
    setMessages(newMessages);
    setInput('');
    handleChatMessage(input, newMessages);
  };

  const tryDetectCompletion = (text: string) => {
    const doneRegex = /(完成|已完成|完成了|done|finished)/i;
    return doneRegex.test(text);
  };

  const handleCompleteClick = () => {
    const convo = messages.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.text}`).join('\n');
    if (tryDetectCompletion('完成')) {
      if (typeof onComplete === 'function') onComplete(convo);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-2 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-xl h-[85vh] sm:h-[600px] max-h-[600px] bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center shadow-lg">
                  <Sparkles size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-serif text-lg text-stone-800 leading-tight">Echo Dialogue</h3>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400">{isZh ? '深度追问' : 'Deep Inquiry'}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-xl transition-colors">
                <X size={20} className="text-stone-400" />
              </button>
            </div>

            {/* Chat Area */}
            <div ref={scrollRef} onMouseUp={handleChatMouseUp} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6 scrollbar-hide">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center ${
                    m.role === 'user' ? 'bg-stone-100' : 'bg-stone-900'
                  }`}>
                    {m.role === 'user' ? <User size={14} className="text-stone-600" /> : <Bot size={14} className="text-white" />}
                  </div>
                  <div className={`max-w-[85%] sm:max-w-[80%] p-3 sm:p-4 rounded-2xl text-sm leading-relaxed break-words ${
                    m.role === 'user' 
                      ? 'bg-stone-100 text-stone-800 rounded-tr-none' 
                      : 'bg-white border border-stone-100 text-stone-700 shadow-sm rounded-tl-none'
                  }`}>
                    {m.role === 'model' ? (
                      <ReactMarkdown
                        components={{
                          p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                          ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-2 last:mb-0 space-y-1" {...props} />,
                          ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-2 last:mb-0 space-y-1" {...props} />,
                          li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
                          code: ({ node, className, children, ...props }) => {
                            const isInline = !className;
                            if (isInline) {
                              return (
                                <code className="px-1 py-0.5 rounded bg-stone-100 text-stone-800" {...props}>
                                  {children}
                                </code>
                              );
                            }
                            return (
                              <pre className="bg-stone-900 text-stone-100 rounded-xl p-3 overflow-x-auto text-xs mb-2 last:mb-0">
                                <code className={className} {...props}>{children}</code>
                              </pre>
                            );
                          },
                        }}
                      >
                        {m.text}
                      </ReactMarkdown>
                    ) : (
                      m.text
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-xl bg-stone-900 flex items-center justify-center">
                    <Loader2 size={14} className="text-white animate-spin" />
                  </div>
                  <div className="bg-stone-50 p-4 rounded-2xl rounded-tl-none text-stone-400 text-sm italic">
                    {isZh ? '思考中...' : 'Reflecting...'}
                  </div>
                </div>
              )}
              {messages.length <= 1 && !isLoading && (
                <div className="ml-12 -mt-2 flex items-center gap-2 text-[11px] text-stone-400">
                  <Sparkles size={12} className="text-amber-400" />
                  <span>
                    {isZh
                      ? '提示：选中 AI 回复中的任意片段，即可沉淀为灵感 / 课题 / 目标'
                      : 'Tip: select any part of Echo’s reply to save it as an inspiration, theme, or goal.'}
                  </span>
                </div>
              )}
            </div>

            {typeof document !== 'undefined' && createPortal(
              <AnimatePresence>
                {selectionPosition && (
                  <motion.div
                    ref={selectionMenuRef}
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    style={{
                      position: 'fixed',
                      left: selectionPosition.x,
                      top: selectionPosition.y,
                      transform: 'translateX(-50%)',
                    }}
                    className="z-[9999] rounded-2xl bg-black text-white shadow-2xl ring-4 ring-white overflow-hidden"
                  >
                    <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2 bg-black/90 text-xs font-medium">
                      <Tag size={14} className="text-amber-400" />
                      <span>{isZh ? '选中的文字' : 'Selected text'}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-white/10 text-xs font-medium">
                      <button
                        onClick={clearSelection}
                        className="px-4 py-3 bg-black hover:bg-stone-900 text-left transition-colors"
                      >
                        {isZh ? '取消' : 'Cancel'}
                      </button>
                      <button
                        onClick={promoteSelectionToInspiration}
                        className="px-4 py-3 bg-black hover:bg-stone-900 text-left transition-colors"
                      >
                        {isZh ? '沉淀为灵感' : 'Save as inspiration'}
                      </button>
                      <button
                        onClick={promoteSelectionToTheme}
                        className="px-4 py-3 bg-black hover:bg-stone-900 text-left transition-colors"
                      >
                        {isZh ? '沉淀为人生课题' : 'Save as theme'}
                      </button>
                      <button
                        onClick={promoteSelectionToGoal}
                        className="px-4 py-3 bg-black hover:bg-stone-900 text-left transition-colors"
                      >
                        {isZh ? '加入目标档案' : 'Save as goal'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>,
              document.body
            )}

            {/* Input */}
            <form onSubmit={onSend} className="p-4 sm:p-6 bg-stone-50 border-t border-stone-100">
              <div className="flex items-center gap-2 mb-3 text-[11px] text-stone-400">
                <Sparkles size={12} className="text-amber-400 flex-shrink-0" />
                <span>
                  {isZh
                    ? '选中 AI 回复中的任意片段，可沉淀为灵感 / 课题 / 目标'
                    : 'Select any part of Echo’s reply to save it as an inspiration, theme, or goal.'}
                </span>
              </div>
              <div className="relative flex items-center">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={isZh ? '问 Echo 一个问题...' : 'Ask Echo something...'}
                  className="w-full bg-white border border-stone-200 rounded-2xl px-5 py-3 pr-14 text-sm focus:outline-none focus:border-stone-400 transition-all placeholder:text-stone-400"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 p-2 bg-stone-900 text-white rounded-xl hover:bg-black transition-all disabled:opacity-50 disabled:scale-95"
                >
                  <Send size={18} />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-3 flex-wrap">
                <button type="button" onClick={handleCompleteClick} className="px-4 py-2 bg-emerald-500 text-white rounded-2xl text-sm">{isZh ? '我已完成' : 'I finished'}</button>
                <span className="text-xs text-stone-400">{isZh ? '完成后点击结束并生成下一步建议' : 'Click when finished to end and generate next step'}</span>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
