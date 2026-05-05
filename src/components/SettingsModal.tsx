/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bell, Languages, LogOut, Sun, Moon } from 'lucide-react';

type Lang = 'zh' | 'en';
type Theme = 'light' | 'dark';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  onLogout: () => void;
  username: string;
}

interface Prefs {
  notifications: boolean;
  sound: boolean;
  theme: Theme;
}

const PREFS_KEY = 'echo.settings.prefs';

const defaultPrefs: Prefs = {
  notifications: true,
  sound: true,
  theme: 'light',
};

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.dataset.theme = theme;
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return defaultPrefs;
    return { ...defaultPrefs, ...JSON.parse(raw) };
  } catch {
    return defaultPrefs;
  }
}

function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // ignore storage failures
  }
}

export default function SettingsModal({ open, onClose, lang, onLangChange, onLogout, username }: SettingsModalProps) {
  const isZh = lang === 'zh';
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());

  useEffect(() => {
    applyTheme(prefs.theme);
  }, [prefs.theme]);

  useEffect(() => {
    if (open) setPrefs(loadPrefs());
  }, [open]);

  const updatePref = <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    savePrefs(next);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-stone-900/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-100 overflow-hidden max-h-[90vh] flex flex-col"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 sm:px-6 pt-5 sm:pt-6 pb-4 shrink-0">
              <div>
                <h2 className="text-xl font-medium text-stone-800">{isZh ? '设置' : 'Settings'}</h2>
                <p className="text-xs text-stone-400 mt-1">{isZh ? `已登录为 ${username}` : `Signed in as ${username}`}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                aria-label={isZh ? '关闭' : 'Close'}
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-6 overflow-y-auto flex-1 min-h-0">
              <Section icon={<Languages size={16} />} title={isZh ? '语言' : 'Language'}>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onLangChange('zh')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isZh ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                    }`}
                  >
                    中文
                  </button>
                  <button
                    onClick={() => onLangChange('en')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      !isZh ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                    }`}
                  >
                    EN
                  </button>
                </div>
              </Section>

              <Section icon={<Bell size={16} />} title={isZh ? '通知' : 'Notifications'}>
                <ToggleRow
                  label={isZh ? '启用通知' : 'Enable notifications'}
                  description={isZh ? '接收新对话和提醒的提示。' : 'Get alerts for new conversations and reminders.'}
                  checked={prefs.notifications}
                  onChange={(v) => updatePref('notifications', v)}
                />
                <ToggleRow
                  label={isZh ? '提示音' : 'Sound'}
                  description={isZh ? '通知到达时播放提示音。' : 'Play a sound when a notification arrives.'}
                  checked={prefs.sound}
                  onChange={(v) => updatePref('sound', v)}
                />
              </Section>

              <Section icon={<Moon size={16} />} title={isZh ? '外观' : 'Appearance'}>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updatePref('theme', 'light')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      prefs.theme === 'light' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                    }`}
                  >
                    <Sun size={16} />
                    {isZh ? '浅色' : 'Light'}
                  </button>
                  <button
                    onClick={() => updatePref('theme', 'dark')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      prefs.theme === 'dark' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                    }`}
                  >
                    <Moon size={16} />
                    {isZh ? '深色' : 'Dark'}
                  </button>
                </div>
              </Section>

              <div className="pt-2 border-t border-stone-100">
                <button
                  onClick={() => {
                    onClose();
                    onLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors text-sm font-medium"
                >
                  <LogOut size={18} />
                  {isZh ? '退出登录' : 'Log Out'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-stone-500 mb-3">
        <span className="text-stone-400">{icon}</span>
        <h3 className="text-xs font-semibold uppercase tracking-wider">{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-4 p-3 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors text-left"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-stone-800">{label}</p>
        {description && <p className="text-xs text-stone-400 mt-0.5">{description}</p>}
      </div>
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-stone-900' : 'bg-stone-300'
        }`}
        aria-hidden
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
          style={{ backgroundColor: '#ffffff' }}
        />
      </span>
    </button>
  );
}
