import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const LANGUAGE_STORAGE_KEY = 'chpli2-language';
export const LANGUAGE_CHANGED_EVENT = 'chpli2-language-changed';
export const SUPPORTED_LANGUAGES = ['zh-CN', 'en', 'de'] as const;

/** Maps an i18next language to the API holiday `lang` parameter. */
export function holidayLang(language: string): string {
  if (language.startsWith('zh')) return 'zh';
  if (language.startsWith('de')) return 'de';
  return 'en';
}

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

      'calendar.view.month': '月',
      'calendar.view.week': '周',
      'calendar.view.day': '日',
      'calendar.weekdays.mon': '一',
      'calendar.weekdays.tue': '二',
      'calendar.weekdays.wed': '三',
      'calendar.weekdays.thu': '四',
      'calendar.weekdays.fri': '五',
      'calendar.weekdays.sat': '六',
      'calendar.weekdays.sun': '日',
      'calendar.allDay': '全天',
      'calendar.more': '还有 {{count}} 项',
      'calendar.travelBadge': '行程',
      'calendar.workdayBadge': '班',
      'calendar.floatingBadge': '浮动时间',
      'calendar.untitled': '未命名事件',

      'calendar.sidebar.calendars': '日历',
      'calendar.sidebar.addCalendar': '新建日历',
      'calendar.sidebar.subscribe': '订阅节假日',
      'calendar.sidebar.dueReminders': '到期提醒',
      'calendar.sidebar.noReminders': '暂无到期提醒',
      'calendar.sidebar.remindersDaysLeft': '还有 {{count}} 天',
      'calendar.sidebar.remindersToday': '今天',
      'calendar.sidebar.remindersOverdue': '已过期',

      'calendar.calendarModal.createTitle': '新建日历',
      'calendar.calendarModal.name': '名称',
      'calendar.calendarModal.color': '颜色',
      'calendar.calendarModal.type': '类型',
      'calendar.calendarModal.typeCustom': '自建日历',
      'calendar.calendarModal.typeSubscription': '节假日订阅',
      'calendar.calendarModal.region': '地区',
      'calendar.calendarModal.regionCN': '中国大陆（含调休）',
      'calendar.calendarModal.regionDE': '德国（请选择联邦州）',
      'calendar.calendarModal.regionCH': '瑞士（请选择州）',
      'calendar.calendarModal.regionPrompt': '请选择…',
      'calendar.calendarModal.create': '创建',

      'calendar.deleteCalendar.title': '删除日历「{{name}}」',
      'calendar.deleteCalendar.hasEvents':
        '该日历包含 {{count}} 条事件。删除日历将同时删除这些事件，或把事件转移到其他日历。',
      'calendar.deleteCalendar.moveTo': '转移到日历',
      'calendar.deleteCalendar.deleteEvents': '一并删除事件',
      'calendar.deleteCalendar.empty': '确定删除该日历吗？此操作不可撤销。',

      'calendar.eventModal.createTitle': '新建事件',
      'calendar.eventModal.editTitle': '编辑事件',
      'calendar.eventModal.title': '标题',
      'calendar.eventModal.calendar': '日历',
      'calendar.eventModal.allDay': '全天',
      'calendar.eventModal.start': '开始',
      'calendar.eventModal.end': '结束',
      'calendar.eventModal.date': '日期',
      'calendar.eventModal.timezone': '时区',
      'calendar.eventModal.floating': '浮动时间（跟随查看设备）',
      'calendar.eventModal.timezoneGap': '所选时刻在该时区不存在（夏令时切换），请调整时间',
      'calendar.eventModal.location': '地点',
      'calendar.eventModal.description': '备注',
      'calendar.eventModal.reminders': '提醒',
      'calendar.eventModal.addReminder': '添加提醒',
      'calendar.eventModal.preset.month': '提前一个月',
      'calendar.eventModal.preset.week': '提前一周',
      'calendar.eventModal.preset.day': '提前一天',
      'calendar.eventModal.preset.custom': '自定义',
      'calendar.eventModal.offsetDays': '提前天数',
      'calendar.eventModal.offsetMaxError': '最多提前一个月（30 天）',
      'calendar.eventModal.endBeforeStart': '结束时间必须晚于开始时间',
      'calendar.eventModal.readonlyHint': '只读日历的事件不可编辑。',
      'calendar.eventModal.deleteEvent': '删除事件',
      'calendar.eventModal.deleteConfirmTitle': '删除事件「{{title}}」？',
      'calendar.eventModal.deleteConfirmBody': '删除后该事件及其提醒将不再显示。',

      'calendar.popover.edit': '编辑',
      'calendar.popover.delete': '删除',

      'error.NETWORK': '网络错误，请稍后重试',
      'error.UNKNOWN': '出错了，请稍后重试',
      'error.VALIDATION_ERROR': '输入有误，请检查表单',
      'error.EVENT_TIME_INVALID': '结束时间必须晚于开始时间',
      'error.REMINDER_OFFSET_INVALID': '提醒最多提前一个月（30 天）',
      'error.CONCURRENT_MODIFICATION': '该事件已被其他人修改，请刷新后重试',
      'error.CALENDAR_DELETE_REQUIRES_TARGET': '请先选择事件的去向',
      'error.LAST_CUSTOM_CALENDAR': '至少保留一个自建日历',
      'error.CALENDAR_READONLY': '只读日历不可修改',
      'error.HOLIDAY_REGION_REQUIRED': '订阅节假日时必须选择地区',
      'error.CALENDAR_NOT_FOUND': '日历不存在',
      'error.EVENT_NOT_FOUND': '事件不存在',
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

      'calendar.view.month': 'Month',
      'calendar.view.week': 'Week',
      'calendar.view.day': 'Day',
      'calendar.weekdays.mon': 'M',
      'calendar.weekdays.tue': 'T',
      'calendar.weekdays.wed': 'W',
      'calendar.weekdays.thu': 'T',
      'calendar.weekdays.fri': 'F',
      'calendar.weekdays.sat': 'S',
      'calendar.weekdays.sun': 'S',
      'calendar.allDay': 'All-day',
      'calendar.more': '{{count}} more',
      'calendar.travelBadge': 'Travel',
      'calendar.workdayBadge': 'Work',
      'calendar.floatingBadge': 'Floating time',
      'calendar.untitled': 'Untitled event',

      'calendar.sidebar.calendars': 'Calendars',
      'calendar.sidebar.addCalendar': 'New calendar',
      'calendar.sidebar.subscribe': 'Subscribe to holidays',
      'calendar.sidebar.dueReminders': 'Due reminders',
      'calendar.sidebar.noReminders': 'No due reminders',
      'calendar.sidebar.remindersDaysLeft': '{{count}}d left',
      'calendar.sidebar.remindersToday': 'Today',
      'calendar.sidebar.remindersOverdue': 'Overdue',

      'calendar.calendarModal.createTitle': 'New calendar',
      'calendar.calendarModal.name': 'Name',
      'calendar.calendarModal.color': 'Color',
      'calendar.calendarModal.type': 'Type',
      'calendar.calendarModal.typeCustom': 'Custom calendar',
      'calendar.calendarModal.typeSubscription': 'Holiday subscription',
      'calendar.calendarModal.region': 'Region',
      'calendar.calendarModal.regionCN': 'China (incl. adjusted workdays)',
      'calendar.calendarModal.regionDE': 'Germany (pick a federal state)',
      'calendar.calendarModal.regionCH': 'Switzerland (pick a canton)',
      'calendar.calendarModal.regionPrompt': 'Select…',
      'calendar.calendarModal.create': 'Create',

      'calendar.deleteCalendar.title': 'Delete calendar "{{name}}"',
      'calendar.deleteCalendar.hasEvents':
        'This calendar has {{count}} events. Deleting it removes the events, or you can move them to another calendar.',
      'calendar.deleteCalendar.moveTo': 'Move events to',
      'calendar.deleteCalendar.deleteEvents': 'Delete events with it',
      'calendar.deleteCalendar.empty': 'Delete this calendar? This cannot be undone.',

      'calendar.eventModal.createTitle': 'New event',
      'calendar.eventModal.editTitle': 'Edit event',
      'calendar.eventModal.title': 'Title',
      'calendar.eventModal.calendar': 'Calendar',
      'calendar.eventModal.allDay': 'All-day',
      'calendar.eventModal.start': 'Starts',
      'calendar.eventModal.end': 'Ends',
      'calendar.eventModal.date': 'Date',
      'calendar.eventModal.timezone': 'Timezone',
      'calendar.eventModal.floating': 'Floating time (follows this device)',
      'calendar.eventModal.timezoneGap': 'This time does not exist in the selected timezone (DST change); please adjust it',
      'calendar.eventModal.location': 'Location',
      'calendar.eventModal.description': 'Notes',
      'calendar.eventModal.reminders': 'Reminders',
      'calendar.eventModal.addReminder': 'Add reminder',
      'calendar.eventModal.preset.month': '1 month before',
      'calendar.eventModal.preset.week': '1 week before',
      'calendar.eventModal.preset.day': '1 day before',
      'calendar.eventModal.preset.custom': 'Custom',
      'calendar.eventModal.offsetDays': 'Days before',
      'calendar.eventModal.offsetMaxError': 'At most one month (30 days) ahead',
      'calendar.eventModal.endBeforeStart': 'End must be after start',
      'calendar.eventModal.readonlyHint': 'Events in read-only calendars cannot be edited.',
      'calendar.eventModal.deleteEvent': 'Delete event',
      'calendar.eventModal.deleteConfirmTitle': 'Delete event "{{title}}"?',
      'calendar.eventModal.deleteConfirmBody': 'The event and its reminders will no longer show.',

      'calendar.popover.edit': 'Edit',
      'calendar.popover.delete': 'Delete',

      'error.NETWORK': 'Network error, please try again later',
      'error.UNKNOWN': 'Something went wrong, please try again',
      'error.VALIDATION_ERROR': 'Invalid input, please check the form',
      'error.EVENT_TIME_INVALID': 'End must be after start',
      'error.REMINDER_OFFSET_INVALID': 'Reminders can be set at most one month (30 days) ahead',
      'error.CONCURRENT_MODIFICATION': 'The event was modified elsewhere; reload and try again',
      'error.CALENDAR_DELETE_REQUIRES_TARGET': 'Choose what happens to the events first',
      'error.LAST_CUSTOM_CALENDAR': 'At least one custom calendar must remain',
      'error.CALENDAR_READONLY': 'Read-only calendars cannot be modified',
      'error.HOLIDAY_REGION_REQUIRED': 'Pick a region when subscribing to holidays',
      'error.CALENDAR_NOT_FOUND': 'Calendar not found',
      'error.EVENT_NOT_FOUND': 'Event not found',
    },
  },
  de: {
    translation: {
      'common.loading': 'Wird geladen…',
      'common.retry': 'Erneut versuchen',
      'common.cancel': 'Abbrechen',
      'common.save': 'Speichern',
      'common.close': 'Schließen',
      'common.delete': 'Löschen',
      'common.confirm': 'Bestätigen',
      'common.today': 'Heute',

      'calendar.view.month': 'Monat',
      'calendar.view.week': 'Woche',
      'calendar.view.day': 'Tag',
      'calendar.weekdays.mon': 'M',
      'calendar.weekdays.tue': 'D',
      'calendar.weekdays.wed': 'M',
      'calendar.weekdays.thu': 'D',
      'calendar.weekdays.fri': 'F',
      'calendar.weekdays.sat': 'S',
      'calendar.weekdays.sun': 'S',
      'calendar.allDay': 'Ganztägig',
      'calendar.more': '{{count}} weitere',
      'calendar.travelBadge': 'Reise',
      'calendar.workdayBadge': 'Arbeit',
      'calendar.floatingBadge': 'Schwebende Uhrzeit',
      'calendar.untitled': 'Unbenanntes Ereignis',

      'calendar.sidebar.calendars': 'Kalender',
      'calendar.sidebar.addCalendar': 'Neuer Kalender',
      'calendar.sidebar.subscribe': 'Feiertage abonnieren',
      'calendar.sidebar.dueReminders': 'Fällige Erinnerungen',
      'calendar.sidebar.noReminders': 'Keine fälligen Erinnerungen',
      'calendar.sidebar.remindersDaysLeft': 'noch {{count}} Tage',
      'calendar.sidebar.remindersToday': 'Heute',
      'calendar.sidebar.remindersOverdue': 'Überfällig',

      'calendar.calendarModal.createTitle': 'Neuer Kalender',
      'calendar.calendarModal.name': 'Name',
      'calendar.calendarModal.color': 'Farbe',
      'calendar.calendarModal.type': 'Typ',
      'calendar.calendarModal.typeCustom': 'Eigener Kalender',
      'calendar.calendarModal.typeSubscription': 'Feiertags-Abo',
      'calendar.calendarModal.region': 'Region',
      'calendar.calendarModal.regionCN': 'China (inkl. verschobener Arbeitstage)',
      'calendar.calendarModal.regionDE': 'Deutschland (Bundesland wählen)',
      'calendar.calendarModal.regionCH': 'Schweiz (Kanton wählen)',
      'calendar.calendarModal.regionPrompt': 'Auswählen…',
      'calendar.calendarModal.create': 'Erstellen',

      'calendar.deleteCalendar.title': 'Kalender „{{name}}“ löschen',
      'calendar.deleteCalendar.hasEvents':
        'Dieser Kalender enthält {{count}} Ereignisse. Beim Löschen werden sie entfernt oder in einen anderen Kalender verschoben.',
      'calendar.deleteCalendar.moveTo': 'Ereignisse verschieben nach',
      'calendar.deleteCalendar.deleteEvents': 'Ereignisse mitlöschen',
      'calendar.deleteCalendar.empty': 'Diesen Kalender wirklich löschen? Das kann nicht rückgängig gemacht werden.',

      'calendar.eventModal.createTitle': 'Neues Ereignis',
      'calendar.eventModal.editTitle': 'Ereignis bearbeiten',
      'calendar.eventModal.title': 'Titel',
      'calendar.eventModal.calendar': 'Kalender',
      'calendar.eventModal.allDay': 'Ganztägig',
      'calendar.eventModal.start': 'Beginn',
      'calendar.eventModal.end': 'Ende',
      'calendar.eventModal.date': 'Datum',
      'calendar.eventModal.timezone': 'Zeitzone',
      'calendar.eventModal.floating': 'Schwebende Uhrzeit (folgt diesem Gerät)',
      'calendar.eventModal.timezoneGap': 'Diese Uhrzeit existiert in der gewählten Zeitzone nicht (Sommerzeitumstellung); bitte anpassen',
      'calendar.eventModal.location': 'Ort',
      'calendar.eventModal.description': 'Notizen',
      'calendar.eventModal.reminders': 'Erinnerungen',
      'calendar.eventModal.addReminder': 'Erinnerung hinzufügen',
      'calendar.eventModal.preset.month': '1 Monat vorher',
      'calendar.eventModal.preset.week': '1 Woche vorher',
      'calendar.eventModal.preset.day': '1 Tag vorher',
      'calendar.eventModal.preset.custom': 'Benutzerdefiniert',
      'calendar.eventModal.offsetDays': 'Tage vorher',
      'calendar.eventModal.offsetMaxError': 'Höchstens ein Monat (30 Tage) vorher',
      'calendar.eventModal.endBeforeStart': 'Das Ende muss nach dem Beginn liegen',
      'calendar.eventModal.readonlyHint': 'Ereignisse in schreibgeschützten Kalendern können nicht bearbeitet werden.',
      'calendar.eventModal.deleteEvent': 'Ereignis löschen',
      'calendar.eventModal.deleteConfirmTitle': 'Ereignis „{{title}}“ löschen?',
      'calendar.eventModal.deleteConfirmBody': 'Das Ereignis und seine Erinnerungen werden nicht mehr angezeigt.',

      'calendar.popover.edit': 'Bearbeiten',
      'calendar.popover.delete': 'Löschen',

      'error.NETWORK': 'Netzwerkfehler, bitte später erneut versuchen',
      'error.UNKNOWN': 'Etwas ist schiefgelaufen, bitte erneut versuchen',
      'error.VALIDATION_ERROR': 'Ungültige Eingabe, bitte das Formular prüfen',
      'error.EVENT_TIME_INVALID': 'Das Ende muss nach dem Beginn liegen',
      'error.REMINDER_OFFSET_INVALID': 'Erinnerungen sind höchstens einen Monat (30 Tage) vorher möglich',
      'error.CONCURRENT_MODIFICATION': 'Das Ereignis wurde anderweitig geändert; bitte neu laden',
      'error.CALENDAR_DELETE_REQUIRES_TARGET': 'Bitte zuerst wählen, was mit den Ereignissen geschieht',
      'error.LAST_CUSTOM_CALENDAR': 'Mindestens ein eigener Kalender muss bleiben',
      'error.CALENDAR_READONLY': 'Schreibgeschützte Kalender können nicht geändert werden',
      'error.HOLIDAY_REGION_REQUIRED': 'Bitte Region beim Feiertags-Abo wählen',
      'error.CALENDAR_NOT_FOUND': 'Kalender nicht gefunden',
      'error.EVENT_NOT_FOUND': 'Ereignis nicht gefunden',
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
