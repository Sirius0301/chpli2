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
      'trip.listTitle': '行程',
      'trip.newTitle': '新建行程',
      'trip.titleLabel': '标题',
      'trip.titlePlaceholder': '例如：日本两周游',
      'trip.titleRequired': '标题为必填项',
      'trip.typeLabel': '类型',
      'trip.type.PLAN': '计划',
      'trip.type.MEMORY': '回忆',
      'trip.create': '创建行程',
      'trip.creating': '创建中…',
      'trip.empty': '还没有行程，创建一个吧！',
      'trip.transportCount': '{{count}} 段交通',
      'trip.transportCount_other': '{{count}} 段交通',
      'trip.open': '查看',
      'trip.back': '返回行程列表',
      'trip.notFound': '行程不存在或已被删除',
      'transport.title': '交通段',
      'transport.empty': '暂无交通段，添加第一段交通吧。',
      'transport.addTitle': '添加交通段',
      'transport.editTitle': '编辑交通段',
      'transport.modeLabel': '交通方式',
      'transport.mode.FLIGHT': '航班',
      'transport.mode.TRAIN': '火车',
      'transport.mode.BUS': '巴士',
      'transport.mode.FERRY': '轮渡',
      'transport.mode.SUBWAY': '地铁',
      'transport.mode.CAR': '汽车',
      'transport.mode.WALK': '步行',
      'transport.mode.OTHER': '其他',
      'transport.origin': '起点',
      'transport.destination': '终点',
      'transport.levelLabel': '层级',
      'transport.level.COUNTRY': '国家',
      'transport.level.CITY': '城市',
      'transport.level.LOCATION': '地点',
      'transport.countryPlaceholder': '选择国家',
      'transport.cityPlaceholder': '选择城市',
      'transport.locationPlaceholder': '选择地点',
      'transport.plannedDeparture': '计划出发',
      'transport.plannedArrival': '计划到达',
      'transport.actualDeparture': '实际出发',
      'transport.actualArrival': '实际到达',
      'transport.syncToCalendar': '同步到日历',
      'transport.submitAdd': '添加',
      'transport.submitEdit': '保存修改',
      'transport.submitting': '提交中…',
      'transport.cancelEdit': '取消编辑',
      'transport.edit': '编辑',
      'transport.delete': '删除',
      'transport.deleteTitle': '删除交通段',
      'transport.deleteMessage': '确定要删除这段交通吗？此操作不可撤销。',
      'transport.confirmDelete': '确认删除',
      'transport.cancelDelete': '取消',
      'transport.sync.SYNCED': '已同步日历',
      'transport.sync.PENDING_DELETE': '日历待删除',
      'transport.plannedLabel': '计划',
      'transport.actualLabel': '实际',
      'validation.ENDPOINT_REQUIRED': '请完整选择起点和终点',
      'error.NETWORK': '网络错误，请稍后重试',
      'error.UNKNOWN': '出错了，请稍后重试',
      'error.ROUTE_SAME_ENDPOINT': '起点和终点不能相同',
      'error.ROUTE_LEVEL_MISMATCH': '起点和终点必须属于同一层级',
      'error.ROUTE_CITY_MISMATCH': '起点和终点必须位于同一城市',
      'error.TIME_ORDER_INVALID': '到达时间不能早于出发时间',
      'error.TRIP_NOT_FOUND': '行程不存在',
      'error.TRANSPORT_NOT_FOUND': '交通段不存在',
      'error.VALIDATION_ERROR': '提交的数据无效，请检查表单',
    },
  },
  en: {
    translation: {
      'common.loading': 'Loading…',
      'common.retry': 'Retry',
      'trip.listTitle': 'Trips',
      'trip.newTitle': 'New trip',
      'trip.titleLabel': 'Title',
      'trip.titlePlaceholder': 'e.g. Two weeks in Japan',
      'trip.titleRequired': 'Title is required',
      'trip.typeLabel': 'Type',
      'trip.type.PLAN': 'Plan',
      'trip.type.MEMORY': 'Memory',
      'trip.create': 'Create trip',
      'trip.creating': 'Creating…',
      'trip.empty': 'No trips yet — create your first one!',
      'trip.transportCount': '{{count}} transport segments',
      'trip.transportCount_one': '{{count}} transport segment',
      'trip.transportCount_other': '{{count}} transport segments',
      'trip.open': 'Open',
      'trip.back': 'Back to trips',
      'trip.notFound': 'Trip not found or deleted',
      'transport.title': 'Transport segments',
      'transport.empty': 'No transport segments yet — add the first one!',
      'transport.addTitle': 'Add transport segment',
      'transport.editTitle': 'Edit transport segment',
      'transport.modeLabel': 'Mode of transport',
      'transport.mode.FLIGHT': 'Flight',
      'transport.mode.TRAIN': 'Train',
      'transport.mode.BUS': 'Bus',
      'transport.mode.FERRY': 'Ferry',
      'transport.mode.SUBWAY': 'Subway',
      'transport.mode.CAR': 'Car',
      'transport.mode.WALK': 'Walk',
      'transport.mode.OTHER': 'Other',
      'transport.origin': 'Origin',
      'transport.destination': 'Destination',
      'transport.levelLabel': 'Level',
      'transport.level.COUNTRY': 'Country',
      'transport.level.CITY': 'City',
      'transport.level.LOCATION': 'Location',
      'transport.countryPlaceholder': 'Select country',
      'transport.cityPlaceholder': 'Select city',
      'transport.locationPlaceholder': 'Select location',
      'transport.plannedDeparture': 'Planned departure',
      'transport.plannedArrival': 'Planned arrival',
      'transport.actualDeparture': 'Actual departure',
      'transport.actualArrival': 'Actual arrival',
      'transport.syncToCalendar': 'Sync to calendar',
      'transport.submitAdd': 'Add',
      'transport.submitEdit': 'Save changes',
      'transport.submitting': 'Submitting…',
      'transport.cancelEdit': 'Cancel edit',
      'transport.edit': 'Edit',
      'transport.delete': 'Delete',
      'transport.deleteTitle': 'Delete transport segment',
      'transport.deleteMessage':
        'Delete this transport segment? This cannot be undone.',
      'transport.confirmDelete': 'Confirm delete',
      'transport.cancelDelete': 'Cancel',
      'transport.sync.SYNCED': 'Synced to calendar',
      'transport.sync.PENDING_DELETE': 'Calendar delete pending',
      'transport.plannedLabel': 'Planned',
      'transport.actualLabel': 'Actual',
      'validation.ENDPOINT_REQUIRED': 'Please select complete origin and destination',
      'error.NETWORK': 'Network error, please try again later',
      'error.UNKNOWN': 'Something went wrong, please try again',
      'error.ROUTE_SAME_ENDPOINT': 'Origin and destination must be different',
      'error.ROUTE_LEVEL_MISMATCH':
        'Origin and destination must use the same level',
      'error.ROUTE_CITY_MISMATCH':
        'Origin and destination must be in the same city',
      'error.TIME_ORDER_INVALID':
        'Arrival time must not be earlier than departure time',
      'error.TRIP_NOT_FOUND': 'Trip not found',
      'error.TRANSPORT_NOT_FOUND': 'Transport segment not found',
      'error.VALIDATION_ERROR': 'Submitted data is invalid, please check the form',
    },
  },
  de: {
    translation: {
      'common.loading': 'Wird geladen…',
      'common.retry': 'Erneut versuchen',
      'trip.listTitle': 'Reisen',
      'trip.newTitle': 'Neue Reise',
      'trip.titleLabel': 'Titel',
      'trip.titlePlaceholder': 'z. B. Zwei Wochen Japan',
      'trip.titleRequired': 'Titel ist erforderlich',
      'trip.typeLabel': 'Typ',
      'trip.type.PLAN': 'Planung',
      'trip.type.MEMORY': 'Erinnerung',
      'trip.create': 'Reise erstellen',
      'trip.creating': 'Wird erstellt…',
      'trip.empty': 'Noch keine Reisen — erstelle die erste!',
      'trip.transportCount': '{{count}} Transportabschnitte',
      'trip.transportCount_one': '{{count}} Transportabschnitt',
      'trip.transportCount_other': '{{count}} Transportabschnitte',
      'trip.open': 'Öffnen',
      'trip.back': 'Zurück zu den Reisen',
      'trip.notFound': 'Reise nicht gefunden oder gelöscht',
      'transport.title': 'Transportabschnitte',
      'transport.empty': 'Noch keine Transportabschnitte — füge den ersten hinzu!',
      'transport.addTitle': 'Transportabschnitt hinzufügen',
      'transport.editTitle': 'Transportabschnitt bearbeiten',
      'transport.modeLabel': 'Verkehrsmittel',
      'transport.mode.FLIGHT': 'Flug',
      'transport.mode.TRAIN': 'Zug',
      'transport.mode.BUS': 'Bus',
      'transport.mode.FERRY': 'Fähre',
      'transport.mode.SUBWAY': 'U-Bahn',
      'transport.mode.CAR': 'Auto',
      'transport.mode.WALK': 'Zu Fuß',
      'transport.mode.OTHER': 'Sonstiges',
      'transport.origin': 'Start',
      'transport.destination': 'Ziel',
      'transport.levelLabel': 'Ebene',
      'transport.level.COUNTRY': 'Land',
      'transport.level.CITY': 'Stadt',
      'transport.level.LOCATION': 'Ort',
      'transport.countryPlaceholder': 'Land auswählen',
      'transport.cityPlaceholder': 'Stadt auswählen',
      'transport.locationPlaceholder': 'Ort auswählen',
      'transport.plannedDeparture': 'Geplante Abfahrt',
      'transport.plannedArrival': 'Geplante Ankunft',
      'transport.actualDeparture': 'Tatsächliche Abfahrt',
      'transport.actualArrival': 'Tatsächliche Ankunft',
      'transport.syncToCalendar': 'Mit Kalender synchronisieren',
      'transport.submitAdd': 'Hinzufügen',
      'transport.submitEdit': 'Änderungen speichern',
      'transport.submitting': 'Wird gesendet…',
      'transport.cancelEdit': 'Bearbeitung abbrechen',
      'transport.edit': 'Bearbeiten',
      'transport.delete': 'Löschen',
      'transport.deleteTitle': 'Transportabschnitt löschen',
      'transport.deleteMessage':
        'Diesen Transportabschnitt löschen? Dies kann nicht rückgängig gemacht werden.',
      'transport.confirmDelete': 'Löschen bestätigen',
      'transport.cancelDelete': 'Abbrechen',
      'transport.sync.SYNCED': 'Mit Kalender synchronisiert',
      'transport.sync.PENDING_DELETE': 'Kalenderlöschung ausstehend',
      'transport.plannedLabel': 'Geplant',
      'transport.actualLabel': 'Tatsächlich',
      'validation.ENDPOINT_REQUIRED': 'Bitte Start und Ziel vollständig auswählen',
      'error.NETWORK': 'Netzwerkfehler, bitte später erneut versuchen',
      'error.UNKNOWN': 'Etwas ist schiefgelaufen, bitte erneut versuchen',
      'error.ROUTE_SAME_ENDPOINT': 'Start und Ziel dürfen nicht identisch sein',
      'error.ROUTE_LEVEL_MISMATCH':
        'Start und Ziel müssen auf derselben Ebene liegen',
      'error.ROUTE_CITY_MISMATCH':
        'Start und Ziel müssen in derselben Stadt liegen',
      'error.TIME_ORDER_INVALID':
        'Die Ankunftszeit darf nicht vor der Abfahrtszeit liegen',
      'error.TRIP_NOT_FOUND': 'Reise nicht gefunden',
      'error.TRANSPORT_NOT_FOUND': 'Transportabschnitt nicht gefunden',
      'error.VALIDATION_ERROR':
        'Die gesendeten Daten sind ungültig, bitte Formular prüfen',
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
