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

      'bm.title': '书签',
      'bm.new': '新建书签',
      'bm.empty': '暂无书签',
      'bm.titlePlaceholder': '名称',
      'bm.urlPlaceholder': 'https://…',
      'bm.descriptionPlaceholder': '描述（可选）',
      'bm.categoriesLabel': '分类',
      'bm.categoryInputPlaceholder': '输入后回车添加',
      'bm.categoryHint': '最多 {{max}} 个，每个 ≤{{length}} 字符',
      'bm.categoryRemove': '移除分类 {{tag}}',
      'bm.cover': '封面图',
      'bm.uploadCover': '上传封面',
      'bm.uploading': '上传中…',
      'bm.coverReplaceHint': '上传新图将替换当前封面',
      'bm.imageTooLarge': '单张图片不能超过 5MB',
      'bm.invalidUrl': '请输入合法的 http(s) 链接',
      'bm.titleRequired': '名称不能为空',
      'bm.open': '打开',
      'bm.edit': '编辑',
      'bm.clickCount': '点击 {{count}} 次',
      'bm.neverClicked': '从未点击',
      'bm.lastClicked': '最近点击 {{when}}',
      'bm.createdAt': '收藏于 {{when}}',

      'bm.view.card': '卡片',
      'bm.view.list': '列表',
      'bm.sort.recent': '最近点击',
      'bm.sort.clicks': '点击最多',
      'bm.sort.title': '按名称',
      'bm.sort.added': '最近收藏',
      'bm.sortLabel': '排序',

      'bm.inactive.section': '不活跃（{{count}}）',
      'bm.inactive.hint': '30 天未点击的书签进入灰色精简列表',
      'bm.inactive.expand': '展开',
      'bm.inactive.collapse': '收起',

      'bm.deleteConfirm': '再次点击确认删除',
      'bm.deleted': '书签已删除',
      'bm.conflict': '该书签已被其他人修改，请刷新后重试',

      'error.NETWORK': '网络错误，请稍后重试',
      'error.UNKNOWN': '出错了，请稍后重试',
      'error.VALIDATION_ERROR': '输入有误，请检查表单',
      'error.CONCURRENT_MODIFICATION': '该书签已被其他人修改，请刷新后重试',
      'error.BOOKMARK_NOT_FOUND': '书签不存在',
      'error.STORAGE_UNAVAILABLE': '存储服务暂不可用，请稍后重试',
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

      'bm.title': 'Bookmarks',
      'bm.new': 'New bookmark',
      'bm.empty': 'No bookmarks yet',
      'bm.titlePlaceholder': 'Name',
      'bm.urlPlaceholder': 'https://…',
      'bm.descriptionPlaceholder': 'Description (optional)',
      'bm.categoriesLabel': 'Categories',
      'bm.categoryInputPlaceholder': 'Press Enter to add',
      'bm.categoryHint': 'At most {{max}}, each ≤{{length}} characters',
      'bm.categoryRemove': 'Remove category {{tag}}',
      'bm.cover': 'Cover image',
      'bm.uploadCover': 'Upload cover',
      'bm.uploading': 'Uploading…',
      'bm.coverReplaceHint': 'Uploading a new image replaces the current cover',
      'bm.imageTooLarge': 'Each image must be 5MB or smaller',
      'bm.invalidUrl': 'Please enter a valid http(s) URL',
      'bm.titleRequired': 'Name is required',
      'bm.open': 'Open',
      'bm.edit': 'Edit',
      'bm.clickCount': '{{count}} clicks',
      'bm.neverClicked': 'Never clicked',
      'bm.lastClicked': 'Last clicked {{when}}',
      'bm.createdAt': 'Saved {{when}}',

      'bm.view.card': 'Cards',
      'bm.view.list': 'List',
      'bm.sort.recent': 'Recently clicked',
      'bm.sort.clicks': 'Most clicked',
      'bm.sort.title': 'By name',
      'bm.sort.added': 'Recently saved',
      'bm.sortLabel': 'Sort',

      'bm.inactive.section': 'Inactive ({{count}})',
      'bm.inactive.hint': 'Bookmarks not clicked for 30 days move to this gray compact list',
      'bm.inactive.expand': 'Expand',
      'bm.inactive.collapse': 'Collapse',

      'bm.deleteConfirm': 'Click again to confirm deletion',
      'bm.deleted': 'Bookmark deleted',
      'bm.conflict': 'This bookmark was modified elsewhere; reload before saving',

      'error.NETWORK': 'Network error, please try again later',
      'error.UNKNOWN': 'Something went wrong, please try again',
      'error.VALIDATION_ERROR': 'Invalid input, please check the form',
      'error.CONCURRENT_MODIFICATION': 'This bookmark was modified elsewhere; reload before saving',
      'error.BOOKMARK_NOT_FOUND': 'Bookmark not found',
      'error.STORAGE_UNAVAILABLE': 'Storage is unavailable; please try again later',
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

      'bm.title': 'Lesezeichen',
      'bm.new': 'Neues Lesezeichen',
      'bm.empty': 'Noch keine Lesezeichen',
      'bm.titlePlaceholder': 'Name',
      'bm.urlPlaceholder': 'https://…',
      'bm.descriptionPlaceholder': 'Beschreibung (optional)',
      'bm.categoriesLabel': 'Kategorien',
      'bm.categoryInputPlaceholder': 'Mit Enter hinzufügen',
      'bm.categoryHint': 'Maximal {{max}}, je ≤{{length}} Zeichen',
      'bm.categoryRemove': 'Kategorie {{tag}} entfernen',
      'bm.cover': 'Titelbild',
      'bm.uploadCover': 'Titelbild hochladen',
      'bm.uploading': 'Wird hochgeladen…',
      'bm.coverReplaceHint': 'Ein neues Bild ersetzt das aktuelle Titelbild',
      'bm.imageTooLarge': 'Jedes Bild darf höchstens 5MB groß sein',
      'bm.invalidUrl': 'Bitte eine gültige http(s)-URL eingeben',
      'bm.titleRequired': 'Name darf nicht leer sein',
      'bm.open': 'Öffnen',
      'bm.edit': 'Bearbeiten',
      'bm.clickCount': '{{count}} Klicks',
      'bm.neverClicked': 'Nie geklickt',
      'bm.lastClicked': 'Zuletzt geklickt {{when}}',
      'bm.createdAt': 'Gespeichert {{when}}',

      'bm.view.card': 'Karten',
      'bm.view.list': 'Liste',
      'bm.sort.recent': 'Zuletzt geklickt',
      'bm.sort.clicks': 'Meiste Klicks',
      'bm.sort.title': 'Nach Name',
      'bm.sort.added': 'Zuletzt gespeichert',
      'bm.sortLabel': 'Sortierung',

      'bm.inactive.section': 'Inaktiv ({{count}})',
      'bm.inactive.hint': 'Lesezeichen ohne Klick seit 30 Tagen erscheinen in dieser grauen Kurzliste',
      'bm.inactive.expand': 'Aufklappen',
      'bm.inactive.collapse': 'Zuklappen',

      'bm.deleteConfirm': 'Erneut klicken zum Löschen',
      'bm.deleted': 'Lesezeichen gelöscht',
      'bm.conflict': 'Das Lesezeichen wurde anderweitig geändert; bitte neu laden',

      'error.NETWORK': 'Netzwerkfehler, bitte später erneut versuchen',
      'error.UNKNOWN': 'Etwas ist schiefgelaufen, bitte erneut versuchen',
      'error.VALIDATION_ERROR': 'Ungültige Eingabe, bitte das Formular prüfen',
      'error.CONCURRENT_MODIFICATION': 'Das Lesezeichen wurde anderweitig geändert; bitte neu laden',
      'error.BOOKMARK_NOT_FOUND': 'Lesezeichen nicht gefunden',
      'error.STORAGE_UNAVAILABLE': 'Speicher ist nicht verfügbar, bitte später erneut versuchen',
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
