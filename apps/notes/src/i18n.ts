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
      'common.cancel': '取消',
      'common.save': '保存',
      'common.delete': '删除',
      'common.close': '关闭',

      'notes.title': '笔记',
      'notes.new': '新建笔记',
      'notes.empty': '暂无笔记',
      'notes.untitled': '未命名笔记',
      'notes.titlePlaceholder': '标题',
      'notes.bodyPlaceholder': '以 Markdown 记录…',
      'notes.preview': '预览',
      'notes.edit': '编辑',
      'notes.priorityLabel': '优先级',
      'notes.tagsLabel': '标签',
      'notes.tagInputPlaceholder': '输入后回车添加',
      'notes.tagHint': '最多 {{max}} 个，每个 ≤{{length}} 字符',
      'notes.tagRemove': '移除标签 {{tag}}',
      'notes.deleted': '笔记已删除',
      'notes.deleteConfirm': '再次点击确认删除',
      'notes.updatedAt': '更新于 {{when}}',

      'notes.saveState.saved': '已保存',
      'notes.saveState.saving': '保存中…',
      'notes.saveState.failed': '保存失败',
      'notes.saveState.retry': '重试',
      'notes.conflict': '该笔记已在别处修改，请刷新后重试',

      'notes.filter.tags': '标签',
      'notes.filter.noTags': '暂无标签',
      'notes.filter.priorities': '优先级',
      'notes.filter.clear': '清除筛选',

      'notes.priority.none': '无',
      'notes.priority.low': '低',
      'notes.priority.medium': '中',
      'notes.priority.high': '高',

      'error.NETWORK': '网络错误，请稍后重试',
      'error.UNKNOWN': '出错了，请稍后重试',
      'error.VALIDATION_ERROR': '输入有误，请检查表单',
      'error.CONCURRENT_MODIFICATION': '该笔记已被其他人修改，请刷新后重试',
      'error.NOTE_NOT_FOUND': '笔记不存在',
    },
  },
  en: {
    translation: {
      'common.loading': 'Loading…',
      'common.retry': 'Retry',
      'common.cancel': 'Cancel',
      'common.save': 'Save',
      'common.delete': 'Delete',
      'common.close': 'Close',

      'notes.title': 'Notes',
      'notes.new': 'New note',
      'notes.empty': 'No notes yet',
      'notes.untitled': 'Untitled note',
      'notes.titlePlaceholder': 'Title',
      'notes.bodyPlaceholder': 'Write in Markdown…',
      'notes.preview': 'Preview',
      'notes.edit': 'Edit',
      'notes.priorityLabel': 'Priority',
      'notes.tagsLabel': 'Tags',
      'notes.tagInputPlaceholder': 'Press Enter to add',
      'notes.tagHint': 'At most {{max}} tags, each ≤{{length}} characters',
      'notes.tagRemove': 'Remove tag {{tag}}',
      'notes.deleted': 'Note deleted',
      'notes.deleteConfirm': 'Click again to confirm deletion',
      'notes.updatedAt': 'Updated {{when}}',

      'notes.saveState.saved': 'Saved',
      'notes.saveState.saving': 'Saving…',
      'notes.saveState.failed': 'Save failed',
      'notes.saveState.retry': 'Retry',
      'notes.conflict': 'This note was modified elsewhere; reload before saving',

      'notes.filter.tags': 'Tags',
      'notes.filter.noTags': 'No tags yet',
      'notes.filter.priorities': 'Priorities',
      'notes.filter.clear': 'Clear filters',

      'notes.priority.none': 'None',
      'notes.priority.low': 'Low',
      'notes.priority.medium': 'Medium',
      'notes.priority.high': 'High',

      'error.NETWORK': 'Network error, please try again later',
      'error.UNKNOWN': 'Something went wrong, please try again',
      'error.VALIDATION_ERROR': 'Invalid input, please check the form',
      'error.CONCURRENT_MODIFICATION': 'This note was modified elsewhere; reload before saving',
      'error.NOTE_NOT_FOUND': 'Note not found',
    },
  },
  de: {
    translation: {
      'common.loading': 'Laden…',
      'common.retry': 'Erneut versuchen',
      'common.cancel': 'Abbrechen',
      'common.save': 'Speichern',
      'common.delete': 'Löschen',
      'common.close': 'Schließen',

      'notes.title': 'Notizen',
      'notes.new': 'Neue Notiz',
      'notes.empty': 'Noch keine Notizen',
      'notes.untitled': 'Unbenannte Notiz',
      'notes.titlePlaceholder': 'Titel',
      'notes.bodyPlaceholder': 'In Markdown schreiben…',
      'notes.preview': 'Vorschau',
      'notes.edit': 'Bearbeiten',
      'notes.priorityLabel': 'Priorität',
      'notes.tagsLabel': 'Tags',
      'notes.tagInputPlaceholder': 'Mit Enter hinzufügen',
      'notes.tagHint': 'Maximal {{max}} Tags, je ≤{{length}} Zeichen',
      'notes.tagRemove': 'Tag {{tag}} entfernen',
      'notes.deleted': 'Notiz gelöscht',
      'notes.deleteConfirm': 'Erneut klicken zum Löschen',
      'notes.updatedAt': 'Aktualisiert {{when}}',

      'notes.saveState.saved': 'Gespeichert',
      'notes.saveState.saving': 'Wird gespeichert…',
      'notes.saveState.failed': 'Speichern fehlgeschlagen',
      'notes.saveState.retry': 'Erneut versuchen',
      'notes.conflict': 'Die Notiz wurde anderweitig geändert; bitte neu laden',

      'notes.filter.tags': 'Tags',
      'notes.filter.noTags': 'Noch keine Tags',
      'notes.filter.priorities': 'Prioritäten',
      'notes.filter.clear': 'Filter zurücksetzen',

      'notes.priority.none': 'Keine',
      'notes.priority.low': 'Niedrig',
      'notes.priority.medium': 'Mittel',
      'notes.priority.high': 'Hoch',

      'error.NETWORK': 'Netzwerkfehler, bitte später erneut versuchen',
      'error.UNKNOWN': 'Etwas ist schiefgelaufen, bitte erneut versuchen',
      'error.VALIDATION_ERROR': 'Ungültige Eingabe, bitte das Formular prüfen',
      'error.CONCURRENT_MODIFICATION': 'Die Notiz wurde anderweitig geändert; bitte neu laden',
      'error.NOTE_NOT_FOUND': 'Notiz nicht gefunden',
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
