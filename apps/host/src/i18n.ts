import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const LANGUAGE_STORAGE_KEY = 'chpli2-language';
export const LANGUAGE_CHANGED_EVENT = 'chpli2-language-changed';
export const SUPPORTED_LANGUAGES = ['zh-CN', 'en', 'de'] as const;

const resources = {
  'zh-CN': {
    translation: {
      'nav.home': '首页',
      'nav.travel': '行程',
      'nav.calendar': '日历',
      'language.label': '语言',
      'home.welcome': '欢迎使用 CHPLI',
      'home.hint': '从左侧导航选择一个模块开始使用。',
      'common.loading': '加载中…',
      'loadError.title': '模块加载失败',
      'loadError.message':
        '无法加载 {{module}} 模块。请确认对应服务已启动（{{url}}）后点击重试。',
      'loadError.retry': '重试',
    },
  },
  en: {
    translation: {
      'nav.home': 'Home',
      'nav.travel': 'Travel',
      'nav.calendar': 'Calendar',
      'language.label': 'Language',
      'home.welcome': 'Welcome to CHPLI',
      'home.hint': 'Choose a module from the navigation to get started.',
      'common.loading': 'Loading…',
      'loadError.title': 'Module failed to load',
      'loadError.message':
        'Could not load the {{module}} module. Make sure its dev server is running ({{url}}) and retry.',
      'loadError.retry': 'Retry',
    },
  },
  de: {
    translation: {
      'nav.home': 'Startseite',
      'nav.travel': 'Reisen',
      'nav.calendar': 'Kalender',
      'language.label': 'Sprache',
      'home.welcome': 'Willkommen bei CHPLI',
      'home.hint': 'Wähle ein Modul in der Navigation, um loszulegen.',
      'common.loading': 'Wird geladen…',
      'loadError.title': 'Modul konnte nicht geladen werden',
      'loadError.message':
        'Das Modul {{module}} konnte nicht geladen werden. Stelle sicher, dass sein Entwicklungsserver läuft ({{url}}), und versuche es erneut.',
      'loadError.retry': 'Erneut versuchen',
    },
  },
};

function getInitialLanguage(): string {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)) {
      return stored;
    }
  } catch {
    /* localStorage may be unavailable; fall through to default */
  }
  return 'zh-CN';
}

const instance = i18n.createInstance();

void instance.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

if (typeof window !== 'undefined') {
  window.addEventListener(LANGUAGE_CHANGED_EVENT, (event) => {
    const language = (event as CustomEvent<{ language: string }>).detail?.language;
    if (language && language !== instance.language) {
      void instance.changeLanguage(language);
    }
  });
  window.addEventListener('storage', (event) => {
    if (
      event.key === LANGUAGE_STORAGE_KEY &&
      event.newValue &&
      event.newValue !== instance.language
    ) {
      void instance.changeLanguage(event.newValue);
    }
  });
}

export default instance;
