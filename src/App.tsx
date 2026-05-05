/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { getMe, login, register, logout, User } from './lib/localAuth';
import { Sparkles, Network, ScrollText, MessageSquare, Settings as SettingsIcon, User as UserIcon, Lock, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import InspirationHub from './components/inspirations/InspirationHub';
import NarrativeTracking from './components/tracking/NarrativeTracking';
import ConversationPage from './components/conversations/ConversationPage';
import SettingsModal from './components/SettingsModal';
import { ConversationSeed } from './types';

type ActiveTab = 'inspiration' | 'relationships' | 'narrative' | 'conversation';
type Lang = 'zh' | 'en';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('inspiration');
  const [pendingConversationSeed, setPendingConversationSeed] = useState<ConversationSeed | null>(null);
  const [pendingInsightReportTag, setPendingInsightReportTag] = useState<{ tag: string; nonce: number } | null>(null);
  const [pendingInspirationFocus, setPendingInspirationFocus] = useState<{ id: string; nonce: number } | null>(null);
  const [conversationActiveId, setConversationActiveId] = useState<string | null | undefined>(undefined);

  const startConversationFromInsight = (seed: Omit<ConversationSeed, 'id'>) => {
    const id = `seed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setPendingConversationSeed({ ...seed, id });
    setActiveTab('conversation');
  };

  const openExistingConversation = (conversationId: string) => {
    setConversationActiveId(conversationId);
    setActiveTab('conversation');
  };

  const focusInspirationFromConversation = (inspirationId: string) => {
    setPendingInspirationFocus({ id: inspirationId, nonce: Date.now() });
    setActiveTab('inspiration');
  };

  const viewReportsForTag = (tag: string) => {
    setPendingInsightReportTag({ tag, nonce: Date.now() });
    setActiveTab('narrative');
  };
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [lang, setLang] = useState<Lang>('zh');
  const [showSettings, setShowSettings] = useState(false);
  const isZh = lang === 'zh';
  const mobileNavRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!user) return;
    const nav = mobileNavRef.current;
    if (!nav) return;
    const setVar = () => {
      document.documentElement.style.setProperty('--mobile-nav-height', `${nav.offsetHeight}px`);
    };
    setVar();
    const ro = new ResizeObserver(setVar);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [user]);

  useEffect(() => {
    getMe().then(u => {
      setUser(u);
      setLoading(false);
    });

    const handleUnauthorized = () => {
      setUser(null);
    };

    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', handleUnauthorized);
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegistering) {
        const u = await register(username, password);
        setUser(u);
      } else {
        const u = await login(username, password);
        setUser(u);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-stone-400 font-serif italic text-xl"
        >
          Echo
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 p-6">
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-white border border-stone-100 rounded-xl p-1 shadow-sm">
          <button
            onClick={() => setLang('zh')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${isZh ? 'bg-stone-900 text-white' : 'text-stone-500'}`}
          >
            中文
          </button>
          <button
            onClick={() => setLang('en')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${!isZh ? 'bg-stone-900 text-white' : 'text-stone-500'}`}
          >
            EN
          </button>
        </div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="space-y-4">
            <h1 className="text-5xl font-serif font-light text-stone-800 tracking-tight">Echo</h1>
            <p className="text-stone-500 font-sans">{isZh ? '点亮你的成长轨迹，映射你的人际连接。' : 'Illuminate your growth and map your connections.'}</p>
          </div>
          
          <form onSubmit={handleAuth} className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100 space-y-4 text-left">
            <h2 className="text-xl font-medium text-stone-800">{isRegistering ? (isZh ? '创建账号' : 'Create an account') : (isZh ? '欢迎回来' : 'Welcome back')}</h2>
            
            <div className="space-y-4">
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input 
                  type="text" 
                  placeholder={isZh ? '用户名' : 'Username'} 
                  className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-stone-200 outline-none transition-all"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                />
              </div>
              
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isZh ? '密码' : 'Password'}
                  className="w-full pl-12 pr-12 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-stone-200 outline-none transition-all"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                  aria-label={showPassword ? (isZh ? '隐藏密码' : 'Hide password') : (isZh ? '显示密码' : 'Show password')}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

            <button 
              type="submit"
              className="w-full bg-stone-900 text-stone-50 py-4 rounded-xl font-medium hover:bg-stone-800 transition-colors shadow-lg"
            >
              {isRegistering ? (isZh ? '注册' : 'Sign Up') : (isZh ? '登录' : 'Log In')}
            </button>

            <p className="text-center text-sm text-stone-400 mt-4">
              {isRegistering ? (isZh ? '已有账号？' : 'Already have an account?') : (isZh ? '没有账号？' : "Don't have an account?")}{' '}
              <button 
                type="button"
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-stone-800 font-medium hover:underline"
              >
                {isRegistering ? (isZh ? '去登录' : 'Log In') : (isZh ? '去注册' : 'Sign Up')}
              </button>
            </p>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans flex flex-col pb-20 lg:pb-0 lg:pl-64">
      {/* Sidebar - Desktop */}
      <nav className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-stone-200 p-6 hidden lg:flex flex-col">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-stone-900 rounded-xl flex items-center justify-center text-stone-50">
            <Sparkles size={20} />
          </div>
          <span className="text-2xl font-serif font-light">Echo</span>
        </div>

        <div className="flex-1 space-y-2">
          <NavBtn active={activeTab === 'inspiration'} onClick={() => setActiveTab('inspiration')} icon={<Sparkles size={18} />} label={isZh ? '记录' : 'Inspiration Hub'} />

          <NavBtn active={activeTab === 'conversation'} onClick={() => setActiveTab('conversation')} icon={<MessageSquare size={18} />} label={isZh ? '对话' : 'Conversations'} />

          <NavBtn active={activeTab === 'narrative'} onClick={() => setActiveTab('narrative')} icon={<ScrollText size={18} />} label={isZh ? '洞察' : 'Narrative & Goals'} />
        </div>

        <div className="pt-6 border-t border-stone-100 mt-auto">
          <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl mb-4">
            <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-stone-400">
              <UserIcon size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.username}</p>
              <p className="text-xs text-stone-400 truncate">{isZh ? '本地账号' : 'Local Account'}</p>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-50 transition-colors text-sm font-medium"
          >
            <SettingsIcon size={18} />
            {isZh ? '设置' : 'Settings'}
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto overflow-x-hidden relative">
        <AnimatePresence mode="wait">
          {activeTab === 'inspiration' && (
            <motion.div key="inspiration" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <InspirationHub
                lang={lang}
                onStartConversation={startConversationFromInsight}
                onOpenExistingConversation={openExistingConversation}
                onViewReportsForTag={viewReportsForTag}
                pendingFocusInspiration={pendingInspirationFocus}
                onPendingFocusInspirationConsumed={() => setPendingInspirationFocus(null)}
              />
            </motion.div>
          )}
          {activeTab === 'narrative' && (
            <motion.div key="narrative" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <NarrativeTracking
                lang={lang}
                onStartConversation={startConversationFromInsight}
                pendingReportTag={pendingInsightReportTag}
                onPendingReportTagConsumed={() => setPendingInsightReportTag(null)}
              />
            </motion.div>
          )}
          {activeTab === 'conversation' && (
            <motion.div key="conversation" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <ConversationPage
                lang={lang}
                pendingSeed={pendingConversationSeed}
                onSeedConsumed={() => setPendingConversationSeed(null)}
                activeId={conversationActiveId}
                onActiveIdChange={setConversationActiveId}
                onOpenInspiration={focusInspirationFromConversation}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Nav - Mobile (pinned to viewport bottom, full-width) */}
      <nav ref={mobileNavRef} className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-stone-200 px-2 py-1 flex items-center justify-around">
        <MobileNavBtn active={activeTab === 'inspiration'} onClick={() => setActiveTab('inspiration')} icon={<Sparkles size={18} />} label={isZh ? '记录' : 'Sparks'} />
        <MobileNavBtn active={activeTab === 'conversation'} onClick={() => setActiveTab('conversation')} icon={<MessageSquare size={18} />} label={isZh ? '对话' : 'Chat'} />
        <MobileNavBtn active={activeTab === 'narrative'} onClick={() => setActiveTab('narrative')} icon={<ScrollText size={18} />} label={isZh ? '洞察' : 'Story'} />
        <button
          onClick={() => setShowSettings(true)}
          className="flex flex-col items-center justify-center p-1 rounded-2xl text-stone-400 hover:text-stone-600 transition-all font-medium text-[10px] gap-0.5"
        >
          <div className="p-1.5 rounded-2xl transition-all duration-300">
            <SettingsIcon size={18} />
          </div>
          {isZh ? '设置' : 'Settings'}
        </button>
      </nav>

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        lang={lang}
        onLangChange={setLang}
        onLogout={handleLogout}
        username={user.username}
      />
    </div>
  );
}

function NavBtn({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
        active ? 'bg-stone-900 text-stone-50 shadow-lg scale-[1.02]' : 'text-stone-500 hover:bg-stone-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MobileNavBtn({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-1 rounded-2xl transition-all font-medium text-[10px] gap-0.5 ${
        active
          ? 'text-stone-900'
          : 'text-stone-400 hover:text-stone-600'
      }`}
    >
      <div className={`p-1.5 rounded-2xl transition-all duration-300 ${
        active ? 'bg-stone-900 text-stone-50 shadow-md scale-110' : ''
      }`}>
        {icon}
      </div>
      {label}
    </button>
  );
}
