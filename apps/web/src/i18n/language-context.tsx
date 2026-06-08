'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import ar from './messages/ar.json';
import de from './messages/de.json';
import en from './messages/en.json';
import es from './messages/es.json';
import fr from './messages/fr.json';
import he from './messages/he.json';
import ja from './messages/ja.json';
import pt from './messages/pt.json';
import zh from './messages/zh.json';

export const LOCALES = ['en', 'he', 'ar', 'es', 'fr', 'de', 'pt', 'ja', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];

type Dictionary = Record<string, unknown>;

const MESSAGES: Record<Locale, Dictionary> = { en, he, ar, es, fr, de, pt, ja, zh };

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  he: 'עברית',
  ar: 'العربية',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  ja: '日本語',
  zh: '中文',
};

interface LanguageState {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageState | null>(null);

export function useI18n(): LanguageState {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useI18n must be used within <LanguageProvider>');
  return ctx;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const saved = window.localStorage.getItem('boosters.locale');
    const browser = window.navigator.language.toLowerCase();
    const candidate = saved || browser.split('-')[0] || 'en';
    setLocaleState(isLocale(candidate) ? candidate : browser.startsWith('zh') ? 'zh' : 'en');
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem('boosters.locale', next);
  };

  const dir: 'ltr' | 'rtl' = locale === 'he' || locale === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [dir, locale]);

  const value = useMemo<LanguageState>(
    () => ({
      locale,
      dir,
      setLocale,
      t: (key: string) => lookup(MESSAGES[locale], key) ?? lookup(en, key) ?? key,
    }),
    [dir, locale],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

function lookup(dict: Dictionary, key: string): string | null {
  let current: unknown = dict;
  for (const part of key.split('.')) {
    if (!current || typeof current !== 'object' || !(part in current)) return null;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : null;
}
