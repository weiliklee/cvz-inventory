import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ms from './locales/ms.json';
import zhCN from './locales/zh-CN.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ms', label: 'Bahasa Malaysia' },
  { code: 'zh-CN', label: '简体中文' },
];

const STORAGE_KEY = 'cvz-language';
const DEFAULT_LANGUAGE = 'en';

function readStoredLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED_LANGUAGES.some(l => l.code === stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function persistLanguage(code) {
  try { localStorage.setItem(STORAGE_KEY, code); } catch { /* storage unavailable, ignore */ }
}

i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ms: { translation: ms },
    'zh-CN': { translation: zhCN },
  },
  lng: readStoredLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
});

export default i18next;
