import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const LANGUAGE_STORAGE_KEY = 'chpli2-language';
export const LANGUAGE_CHANGED_EVENT = 'chpli2-language-changed';
export const SUPPORTED_LANGUAGES = ['zh-CN', 'en', 'de'] as const;

const resources = {
  'zh-CN': {
    translation: {
      'common.loading': '加载中…',
      'common.retry': '重试',
      'calendar.title': '日历',
      'calendar.empty': '没有日历事件。',
      'calendar.source.travel': 'Travel',
      'calendar.clickHint': '点击事件可跳转到对应行程。',
      'error.NETWORK': '网络错误，请稍后重试',
      'error.UNKNOWN': '出错了，请稍后重试',
    },
  },
  en: {
    translation: {
      'common.loading': 'Loading…',
      'common.retry': 'Retry',
      'calendar.title': 'Calendar',
      'calendar.empty': 'No calendar events.',
      'calendar.source.travel': 'Travel',
      'calendar.clickHint': 'Click an event to open the related trip.',
      'error.NETWORK': 'Network error, please try again later',
      'error.UNKNOWN': 'Something went wrong, please try again',
    },
  },
  de: {
    translation: {
      'common.loading': 'Wird geladen…',
      'common.retry': 'Erneut versuchen',
      'calendar.title': 'Kalender',
      'calendar.empty': 'Keine Kalenderereignisse.',
      'calendar.source.travel': 'Travel',
      'calendar.clickHint': 'Klicke auf ein Ereignis, um die zugehörige Reise zu öffnen.',
      'error.NETWORK': 'Netzwerkfehler, bitte später erneut versuchen',
      'error.UNKNOWN': 'Etwas ist schiefgelaufen, bitte erneut versuchen',
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
