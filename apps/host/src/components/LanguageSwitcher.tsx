import { useTranslation } from 'react-i18next';
import {
  LANGUAGE_CHANGED_EVENT,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
} from '../i18n';

const LANGUAGE_NAMES: Record<string, string> = {
  'zh-CN': '中文',
  en: 'English',
  de: 'Deutsch',
};

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  const changeLanguage = (language: string) => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    void i18n.changeLanguage(language);
    window.dispatchEvent(
      new CustomEvent(LANGUAGE_CHANGED_EVENT, { detail: { language } }),
    );
  };

  return (
    <label className="language-switcher">
      <span className="language-switcher__label">{t('language.label')}</span>
      <select
        aria-label={t('language.label')}
        value={i18n.language}
        onChange={(event) => changeLanguage(event.target.value)}
      >
        {SUPPORTED_LANGUAGES.map((language) => (
          <option key={language} value={language}>
            {LANGUAGE_NAMES[language]}
          </option>
        ))}
      </select>
    </label>
  );
}
