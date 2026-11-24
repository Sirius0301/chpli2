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
      'common.close': '关闭',
      'common.delete': '删除',
      'common.confirm': '确认',
      'common.today': '今天',

      'memo.view.month': '月',
      'memo.view.week': '周',
      'memo.view.day': '日',
      'memo.weekdays.sun': '日',
      'memo.weekdays.mon': '一',
      'memo.weekdays.tue': '二',
      'memo.weekdays.wed': '三',
      'memo.weekdays.thu': '四',
      'memo.weekdays.fri': '五',
      'memo.weekdays.sat': '六',
      'memo.more': '还有 {{count}} 项',
      'memo.empty': '暂无备忘',
      'memo.createOn': '在此天新建备忘（{{date}}）',
      'memo.toggleComplete': '完成：{{title}}',
      'memo.repeatBadge': '重复',

      'memo.createTitle': '新建备忘',
      'memo.editTitle': '编辑备忘',
      'memo.title': '标题',
      'memo.date': '日期',
      'memo.priorityLabel': '优先级',
      'memo.priority.none': '无',
      'memo.priority.low': '低',
      'memo.priority.medium': '中',
      'memo.priority.high': '高',
      'memo.repeatLabel': '重复',
      'memo.repeat.none': '不重复',
      'memo.repeat.daily': '每天',
      'memo.repeat.weekdays': '工作日（周一至周五）',
      'memo.repeat.weekly': '每周',
      'memo.repeat.biweekly': '每两周',
      'memo.repeat.monthly': '每月（按日期）',
      'memo.repeat.monthlyByWeekday': '每月（第 N 个星期几）',
      'memo.repeat.quarterly': '每季度',
      'memo.repeat.semiannual': '每半年',
      'memo.repeat.yearly': '每年',
      'memo.repeat.custom': '自定义（按星期）',
      'memo.repeatDaysLabel': '重复于（星期）',
      'memo.repeatEnd': '重复截止',
      'memo.repeatEndPlaceholder': '留空 = 无限重复',
      'memo.note': '备注',
      'memo.deleteConfirm': '再次点击确认删除',
      'memo.clickToCreate': '单击创建备忘',
      'memo.savedToast': '已保存编辑备忘',
      'memo.unsavedTitle': '未保存的修改',
      'memo.unsavedMessage': '当前备忘有未保存的修改，是否保存后再打开新的备忘？',
      'memo.unsavedSave': '保存并打开',
      'memo.unsavedDiscard': '不保存',
      'memo.tagRename': '重命名标签 {{tag}}',
      'memo.tagDelete': '删除标签 {{tag}}',
      'memo.tagDeleteConfirm': '确认',

      'memo.filter.tags': '标签',
      'memo.filter.noTags': '暂无标签',
      'memo.filter.priorities': '优先级',
      'memo.filter.clear': '清除筛选',
      'memo.tagsLabel': '标签',
      'memo.tagInputPlaceholder': '输入后回车添加',
      'memo.tagHint': '最多 {{max}} 个，每个 ≤{{length}} 字符',
      'memo.tagRemove': '移除标签 {{tag}}',
      'memo.due.title': '即将到期',
      'memo.due.today': '今天',
      'memo.due.overdue': '已逾期',
      'memo.due.inDays': '还有 {{count}} 天',
      'memo.due.empty': '暂无到期备忘',
      'memo.dueBadge': '今日到期',
      'memo.notifyEnable': '启用浏览器通知',
      'memo.notifyTitle': '备忘到期',
      'memo.notifyBody': '{{title}}（{{date}}）',

      'memo.images': '图片',
      'memo.addImages': '添加图片',
      'memo.imageUploading': '上传中…',
      'memo.imageDeleteConfirm': '确认?',
      'memo.imageTooLarge': '单张图片不能超过 5MB',
      'memo.imageCreateHint': '保存后可添加图片。',

      'memo.error.badTagLength': '标签最多 {{length}} 个字符',
      'memo.error.badTagCount': '最多 {{max}} 个标签',

      'memo.error.titleRequired': '标题不能为空',
      'memo.error.badDate': '日期无效',
      'memo.error.badRepeatEnd': '重复截止日不能早于开始日期',
      'memo.error.badRepeatDays': '自定义重复请至少选择一个星期',

      'error.NETWORK': '网络错误，请稍后重试',
      'error.UNKNOWN': '出错了，请稍后重试',
      'error.VALIDATION_ERROR': '输入有误，请检查表单',
      'error.CONCURRENT_MODIFICATION': '该备忘已被其他人修改，请刷新后重试',
      'error.MEMO_NOT_FOUND': '备忘不存在',
      'error.MEMO_DATE_NOT_INSTANCE': '该日期不是此重复规则的实例',
    },
  },
  en: {
    translation: {
      'common.loading': 'Loading…',
      'common.retry': 'Retry',
      'common.cancel': 'Cancel',
      'common.save': 'Save',
      'common.close': 'Close',
      'common.delete': 'Delete',
      'common.confirm': 'Confirm',
      'common.today': 'Today',

      'memo.view.month': 'Month',
      'memo.view.week': 'Week',
      'memo.view.day': 'Day',
      'memo.weekdays.sun': 'Sun',
      'memo.weekdays.mon': 'Mon',
      'memo.weekdays.tue': 'Tue',
      'memo.weekdays.wed': 'Wed',
      'memo.weekdays.thu': 'Thu',
      'memo.weekdays.fri': 'Fri',
      'memo.weekdays.sat': 'Sat',
      'memo.more': '{{count}} more',
      'memo.empty': 'No memos',
      'memo.createOn': 'Create a memo on {{date}}',
      'memo.toggleComplete': 'Complete: {{title}}',
      'memo.repeatBadge': 'Repeats',

      'memo.createTitle': 'New memo',
      'memo.editTitle': 'Edit memo',
      'memo.title': 'Title',
      'memo.date': 'Date',
      'memo.priorityLabel': 'Priority',
      'memo.priority.none': 'None',
      'memo.priority.low': 'Low',
      'memo.priority.medium': 'Medium',
      'memo.priority.high': 'High',
      'memo.repeatLabel': 'Repeat',
      'memo.repeat.none': 'Does not repeat',
      'memo.repeat.daily': 'Every day',
      'memo.repeat.weekdays': 'Every weekday (Mon–Fri)',
      'memo.repeat.weekly': 'Every week',
      'memo.repeat.biweekly': 'Every two weeks',
      'memo.repeat.monthly': 'Every month (by date)',
      'memo.repeat.monthlyByWeekday': 'Every month (Nth weekday)',
      'memo.repeat.quarterly': 'Every quarter',
      'memo.repeat.semiannual': 'Every six months',
      'memo.repeat.yearly': 'Every year',
      'memo.repeat.custom': 'Custom (by weekday)',
      'memo.repeatDaysLabel': 'Repeats on',
      'memo.repeatEnd': 'Repeat until',
      'memo.repeatEndPlaceholder': 'Empty = repeats forever',
      'memo.note': 'Note',
      'memo.deleteConfirm': 'Click again to confirm deletion',
      'memo.clickToCreate': 'Click to create a memo',
      'memo.savedToast': 'Memo saved',
      'memo.unsavedTitle': 'Unsaved changes',
      'memo.unsavedMessage': 'The current memo has unsaved changes. Save before opening another memo?',
      'memo.unsavedSave': 'Save & open',
      'memo.unsavedDiscard': "Don't save",
      'memo.tagRename': 'Rename tag {{tag}}',
      'memo.tagDelete': 'Delete tag {{tag}}',
      'memo.tagDeleteConfirm': 'Sure?',

      'memo.filter.tags': 'Tags',
      'memo.filter.noTags': 'No tags yet',
      'memo.filter.priorities': 'Priorities',
      'memo.filter.clear': 'Clear filters',
      'memo.tagsLabel': 'Tags',
      'memo.tagInputPlaceholder': 'Press Enter to add',
      'memo.tagHint': 'At most {{max}} tags, each ≤{{length}} characters',
      'memo.tagRemove': 'Remove tag {{tag}}',
      'memo.due.title': 'Due soon',
      'memo.due.today': 'Today',
      'memo.due.overdue': 'Overdue',
      'memo.due.inDays': 'in {{count}} days',
      'memo.due.empty': 'Nothing due',
      'memo.dueBadge': 'Due today',
      'memo.notifyEnable': 'Enable browser notifications',
      'memo.notifyTitle': 'Memo due',
      'memo.notifyBody': '{{title}} ({{date}})',

      'memo.images': 'Images',
      'memo.addImages': 'Add images',
      'memo.imageUploading': 'Uploading…',
      'memo.imageDeleteConfirm': 'Sure?',
      'memo.imageTooLarge': 'Each image must be 5MB or smaller',
      'memo.imageCreateHint': 'Save the memo to add images.',

      'memo.error.badTagLength': 'Tags are at most {{length}} characters',
      'memo.error.badTagCount': 'At most {{max}} tags',

      'memo.error.titleRequired': 'Title is required',
      'memo.error.badDate': 'Invalid date',
      'memo.error.badRepeatEnd': 'Repeat end must not be before the start date',
      'memo.error.badRepeatDays': 'Select at least one weekday for the custom rule',

      'error.NETWORK': 'Network error, please try again later',
      'error.UNKNOWN': 'Something went wrong, please try again',
      'error.VALIDATION_ERROR': 'Invalid input, please check the form',
      'error.CONCURRENT_MODIFICATION': 'This memo was modified elsewhere; reload before saving',
      'error.MEMO_NOT_FOUND': 'Memo not found',
      'error.MEMO_DATE_NOT_INSTANCE': 'That date is not an instance of this repeat rule',
    },
  },
  de: {
    translation: {
      'common.loading': 'Laden…',
      'common.retry': 'Erneut versuchen',
      'common.cancel': 'Abbrechen',
      'common.save': 'Speichern',
      'common.close': 'Schließen',
      'common.delete': 'Löschen',
      'common.confirm': 'Bestätigen',
      'common.today': 'Heute',

      'memo.view.month': 'Monat',
      'memo.view.week': 'Woche',
      'memo.view.day': 'Tag',
      'memo.weekdays.sun': 'So',
      'memo.weekdays.mon': 'Mo',
      'memo.weekdays.tue': 'Di',
      'memo.weekdays.wed': 'Mi',
      'memo.weekdays.thu': 'Do',
      'memo.weekdays.fri': 'Fr',
      'memo.weekdays.sat': 'Sa',
      'memo.more': '{{count}} weitere',
      'memo.empty': 'Keine Memos',
      'memo.createOn': 'Memo am {{date}} erstellen',
      'memo.toggleComplete': 'Erledigen: {{title}}',
      'memo.repeatBadge': 'Wiederholt sich',

      'memo.createTitle': 'Neues Memo',
      'memo.editTitle': 'Memo bearbeiten',
      'memo.title': 'Titel',
      'memo.date': 'Datum',
      'memo.priorityLabel': 'Priorität',
      'memo.priority.none': 'Keine',
      'memo.priority.low': 'Niedrig',
      'memo.priority.medium': 'Mittel',
      'memo.priority.high': 'Hoch',
      'memo.repeatLabel': 'Wiederholung',
      'memo.repeat.none': 'Keine Wiederholung',
      'memo.repeat.daily': 'Täglich',
      'memo.repeat.weekdays': 'An Wochentagen (Mo–Fr)',
      'memo.repeat.weekly': 'Wöchentlich',
      'memo.repeat.biweekly': 'Alle zwei Wochen',
      'memo.repeat.monthly': 'Monatlich (nach Datum)',
      'memo.repeat.monthlyByWeekday': 'Monatlich (n. Wochentag)',
      'memo.repeat.quarterly': 'Vierteljährlich',
      'memo.repeat.semiannual': 'Halbjährlich',
      'memo.repeat.yearly': 'Jährlich',
      'memo.repeat.custom': 'Benutzerdefiniert (Wochentage)',
      'memo.repeatDaysLabel': 'Wiederholen am',
      'memo.repeatEnd': 'Wiederholen bis',
      'memo.repeatEndPlaceholder': 'Leer = unbegrenzt',
      'memo.note': 'Notiz',
      'memo.deleteConfirm': 'Erneut klicken zum Löschen',
      'memo.clickToCreate': 'Klicken, um ein Memo zu erstellen',
      'memo.savedToast': 'Memo gespeichert',
      'memo.unsavedTitle': 'Ungespeicherte Änderungen',
      'memo.unsavedMessage': 'Das aktuelle Memo hat ungespeicherte Änderungen. Vor dem Öffnen eines anderen Memos speichern?',
      'memo.unsavedSave': 'Speichern & öffnen',
      'memo.unsavedDiscard': 'Nicht speichern',
      'memo.tagRename': 'Tag {{tag}} umbenennen',
      'memo.tagDelete': 'Tag {{tag}} löschen',
      'memo.tagDeleteConfirm': 'Sicher?',

      'memo.filter.tags': 'Tags',
      'memo.filter.noTags': 'Noch keine Tags',
      'memo.filter.priorities': 'Prioritäten',
      'memo.filter.clear': 'Filter zurücksetzen',
      'memo.tagsLabel': 'Tags',
      'memo.tagInputPlaceholder': 'Mit Enter hinzufügen',
      'memo.tagHint': 'Maximal {{max}} Tags, je ≤{{length}} Zeichen',
      'memo.tagRemove': 'Tag {{tag}} entfernen',
      'memo.due.title': 'Bald fällig',
      'memo.due.today': 'Heute',
      'memo.due.overdue': 'Überfällig',
      'memo.due.inDays': 'in {{count}} Tagen',
      'memo.due.empty': 'Nichts fällig',
      'memo.dueBadge': 'Heute fällig',
      'memo.notifyEnable': 'Browser-Benachrichtigungen aktivieren',
      'memo.notifyTitle': 'Memo fällig',
      'memo.notifyBody': '{{title}} ({{date}})',

      'memo.images': 'Bilder',
      'memo.addImages': 'Bilder hinzufügen',
      'memo.imageUploading': 'Wird hochgeladen…',
      'memo.imageDeleteConfirm': 'Sicher?',
      'memo.imageTooLarge': 'Jedes Bild darf höchstens 5MB groß sein',
      'memo.imageCreateHint': 'Speichern Sie das Memo, um Bilder hinzuzufügen.',

      'memo.error.badTagLength': 'Tags haben maximal {{length}} Zeichen',
      'memo.error.badTagCount': 'Maximal {{max}} Tags',

      'memo.error.titleRequired': 'Titel darf nicht leer sein',
      'memo.error.badDate': 'Ungültiges Datum',
      'memo.error.badRepeatEnd': 'Wiederhol-Ende darf nicht vor dem Startdatum liegen',
      'memo.error.badRepeatDays': 'Für die benutzerdefinierte Regel mindestens einen Wochentag wählen',

      'error.NETWORK': 'Netzwerkfehler, bitte später erneut versuchen',
      'error.UNKNOWN': 'Etwas ist schiefgelaufen, bitte erneut versuchen',
      'error.VALIDATION_ERROR': 'Ungültige Eingabe, bitte das Formular prüfen',
      'error.CONCURRENT_MODIFICATION': 'Das Memo wurde anderweitig geändert; bitte neu laden',
      'error.MEMO_NOT_FOUND': 'Memo nicht gefunden',
      'error.MEMO_DATE_NOT_INSTANCE': 'Dieses Datum ist keine Instanz dieser Wiederholung',
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
