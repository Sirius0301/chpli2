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

      'lf.title': '人生文件夹',
      'lf.builtIn': '内置',
      'lf.category.new': '新建分类',
      'lf.category.namePlaceholder': '分类名称',
      'lf.category.parentNone': '（顶级分类）',
      'lf.category.deleteConfirm': '再次点击确认删除分类',
      'lf.category.builtInLocked': '内置分类不可删除',

      'lf.doc.upload': '上传文件',
      'lf.doc.empty': '该分类下暂无文件',
      'lf.doc.titlePlaceholder': '文件标题',
      'lf.doc.notesPlaceholder': '备注（可选）',
      'lf.doc.sensitive': '敏感文件（默认私有）',
      'lf.doc.templateLabel': '按模板添加（可选）',
      'lf.doc.template.none': '（不使用模板）',
      'lf.doc.sensitiveBadge': '敏感',
      'lf.doc.download': '下载',
      'lf.doc.move': '移动到…',
      'lf.doc.moveConfirmTitle': '确认移动该文件？',
      'lf.doc.deleteConfirm': '再次点击确认删除文件',
      'lf.doc.uploading': '上传中…',
      'lf.doc.fileTooLarge': '文件不能超过 10MB',
      'lf.doc.typeInvalid': '仅支持 PDF 与 JPEG/PNG/WebP/GIF 图片',
      'lf.doc.size': '{{size}} KB',

      'lf.rec.title': '推荐补齐',
      'lf.rec.hint': '以下重要文件尚未归档，可按模板快速添加',
      'lf.rec.add': '按模板添加',
      'lf.rec.empty': '推荐文件均已归档',

      'error.NETWORK': '网络错误，请稍后重试',
      'error.UNKNOWN': '出错了，请稍后重试',
      'error.VALIDATION_ERROR': '输入有误，请检查表单',
      'error.CONCURRENT_MODIFICATION': '该文件已被其他人修改，请刷新后重试',
      'error.CATEGORY_NOT_FOUND': '分类不存在',
      'error.DOCUMENT_NOT_FOUND': '文件不存在',
      'error.CATEGORY_NOT_EMPTY': '请先移动或删除该分类下的文件',
      'error.DOCUMENT_TYPE_INVALID': '仅支持 PDF 与 JPEG/PNG/WebP/GIF 图片',
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

      'lf.title': 'Life Folder',
      'lf.builtIn': 'Built-in',
      'lf.category.new': 'New category',
      'lf.category.namePlaceholder': 'Category name',
      'lf.category.parentNone': '(top level)',
      'lf.category.deleteConfirm': 'Click again to confirm deleting the category',
      'lf.category.builtInLocked': 'Built-in categories cannot be deleted',

      'lf.doc.upload': 'Upload file',
      'lf.doc.empty': 'No files in this category',
      'lf.doc.titlePlaceholder': 'Document title',
      'lf.doc.notesPlaceholder': 'Notes (optional)',
      'lf.doc.sensitive': 'Sensitive (private by default)',
      'lf.doc.templateLabel': 'From a template (optional)',
      'lf.doc.template.none': '(no template)',
      'lf.doc.sensitiveBadge': 'Sensitive',
      'lf.doc.download': 'Download',
      'lf.doc.move': 'Move to…',
      'lf.doc.moveConfirmTitle': 'Move this file?',
      'lf.doc.deleteConfirm': 'Click again to confirm deleting the file',
      'lf.doc.uploading': 'Uploading…',
      'lf.doc.fileTooLarge': 'Files must be 10MB or smaller',
      'lf.doc.typeInvalid': 'Only PDF and JPEG/PNG/WebP/GIF images are supported',
      'lf.doc.size': '{{size}} KB',

      'lf.rec.title': 'Recommended',
      'lf.rec.hint': 'These important documents are not archived yet — add them from a template',
      'lf.rec.add': 'Add from template',
      'lf.rec.empty': 'All recommended documents are archived',

      'error.NETWORK': 'Network error, please try again later',
      'error.UNKNOWN': 'Something went wrong, please try again',
      'error.VALIDATION_ERROR': 'Invalid input, please check the form',
      'error.CONCURRENT_MODIFICATION': 'This document was modified elsewhere; reload before saving',
      'error.CATEGORY_NOT_FOUND': 'Category not found',
      'error.DOCUMENT_NOT_FOUND': 'Document not found',
      'error.CATEGORY_NOT_EMPTY': 'Move or delete the documents in this category first',
      'error.DOCUMENT_TYPE_INVALID': 'Only PDF and JPEG/PNG/WebP/GIF images are supported',
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

      'lf.title': 'Lebensdokumente',
      'lf.builtIn': 'Eingebaut',
      'lf.category.new': 'Neue Kategorie',
      'lf.category.namePlaceholder': 'Kategoriename',
      'lf.category.parentNone': '(Oberkategorie)',
      'lf.category.deleteConfirm': 'Erneut klicken zum Löschen der Kategorie',
      'lf.category.builtInLocked': 'Eingebaute Kategorien können nicht gelöscht werden',

      'lf.doc.upload': 'Datei hochladen',
      'lf.doc.empty': 'Keine Dateien in dieser Kategorie',
      'lf.doc.titlePlaceholder': 'Dokumenttitel',
      'lf.doc.notesPlaceholder': 'Notizen (optional)',
      'lf.doc.sensitive': 'Sensibel (standardmäßig privat)',
      'lf.doc.templateLabel': 'Aus Vorlage (optional)',
      'lf.doc.template.none': '(keine Vorlage)',
      'lf.doc.sensitiveBadge': 'Sensibel',
      'lf.doc.download': 'Herunterladen',
      'lf.doc.move': 'Verschieben nach…',
      'lf.doc.moveConfirmTitle': 'Diese Datei verschieben?',
      'lf.doc.deleteConfirm': 'Erneut klicken zum Löschen der Datei',
      'lf.doc.uploading': 'Wird hochgeladen…',
      'lf.doc.fileTooLarge': 'Dateien dürfen höchstens 10MB groß sein',
      'lf.doc.typeInvalid': 'Nur PDF und JPEG/PNG/WebP/GIF-Bilder werden unterstützt',
      'lf.doc.size': '{{size}} KB',

      'lf.rec.title': 'Empfohlen',
      'lf.rec.hint': 'Diese wichtigen Dokumente fehlen noch — über eine Vorlage hinzufügen',
      'lf.rec.add': 'Aus Vorlage hinzufügen',
      'lf.rec.empty': 'Alle empfohlenen Dokumente sind archiviert',

      'error.NETWORK': 'Netzwerkfehler, bitte später erneut versuchen',
      'error.UNKNOWN': 'Etwas ist schiefgelaufen, bitte erneut versuchen',
      'error.VALIDATION_ERROR': 'Ungültige Eingabe, bitte das Formular prüfen',
      'error.CONCURRENT_MODIFICATION': 'Das Dokument wurde anderweitig geändert; bitte neu laden',
      'error.CATEGORY_NOT_FOUND': 'Kategorie nicht gefunden',
      'error.DOCUMENT_NOT_FOUND': 'Dokument nicht gefunden',
      'error.CATEGORY_NOT_EMPTY':
        'Bitte zuerst die Dokumente dieser Kategorie verschieben oder löschen',
      'error.DOCUMENT_TYPE_INVALID': 'Nur PDF und JPEG/PNG/WebP/GIF-Bilder werden unterstützt',
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
