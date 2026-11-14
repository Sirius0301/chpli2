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

      'goal.title': '成长与职业',
      'goal.new': '新建目标',
      'goal.empty': '暂无职业目标',
      'goal.untitled': '未命名目标',
      'goal.titlePlaceholder': '目标名称',
      'goal.descriptionPlaceholder': '描述（可选）',
      'goal.targetDate': '目标日期',
      'goal.progress': '进度 {{percent}}%',
      'goal.statusLabel': '状态',
      'goal.status.active': '进行中',
      'goal.status.paused': '已暂停',
      'goal.status.achieved': '已达成',
      'goal.status.archived': '已归档',

      'goal.milestones': '里程碑',
      'goal.milestone.add': '添加里程碑',
      'goal.milestone.titlePlaceholder': '里程碑名称',
      'goal.milestone.date': '计划日期（可选）',
      'goal.milestone.deleteConfirm': '再次点击确认删除',

      'goal.links': '关联',
      'goal.links.addNote': '关联笔记…',
      'goal.links.addBookmark': '关联书签…',
      'goal.links.empty': '暂无关联',
      'goal.links.open': '打开',
      'goal.links.remove': '移除关联',
      'goal.links.module.notes': '笔记',
      'goal.links.module.bookmarks': '书签',

      'growth.tab.goals': '目标',
      'growth.tab.skills': '技能',
      'growth.tab.reviews': '回顾',

      'skill.title': '技能节点',
      'skill.new': '新建技能',
      'skill.empty': '暂无技能',
      'skill.namePlaceholder': '技能名称',
      'skill.level': '熟练度',
      'skill.level.0': '未评估',
      'skill.goalLabel': '从属目标（可选）',
      'skill.goal.none': '（独立技能）',
      'skill.evidence': '实践证据',
      'skill.resources': '学习资源',
      'skill.links.addNote': '关联笔记（证据）…',
      'skill.links.addBookmark': '关联书签（资源）…',
      'skill.duplicate': '同名技能已存在',

      'review.title': '定期回顾',
      'review.new': '新建回顾',
      'review.empty': '暂无回顾',
      'review.reviewedAt': '回顾日期',
      'review.contentPlaceholder': '回顾内容…',
      'review.goalLabel': '从属目标（可选）',
      'review.links.addMemo': '关联备忘…',
      'review.schedule': '安排下次回顾',
      'review.schedule.date': '下次回顾日期',
      'review.schedule.arranged': '已安排 {{date}}',
      'review.schedule.open': '打开',
      'review.schedule.done': '已安排，点击打开',

      'goal.conflict': '该目标已被其他人修改，请刷新后重试',
      'error.NETWORK': '网络错误，请稍后重试',
      'error.UNKNOWN': '出错了，请稍后重试',
      'error.VALIDATION_ERROR': '输入有误，请检查表单',
      'error.CONCURRENT_MODIFICATION': '该目标已被其他人修改，请刷新后重试',
      'error.GOAL_NOT_FOUND': '目标不存在',
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

      'goal.title': 'Growth & Career',
      'goal.new': 'New goal',
      'goal.empty': 'No goals yet',
      'goal.untitled': 'Untitled goal',
      'goal.titlePlaceholder': 'Goal title',
      'goal.descriptionPlaceholder': 'Description (optional)',
      'goal.targetDate': 'Target date',
      'goal.progress': 'Progress {{percent}}%',
      'goal.statusLabel': 'Status',
      'goal.status.active': 'Active',
      'goal.status.paused': 'Paused',
      'goal.status.achieved': 'Achieved',
      'goal.status.archived': 'Archived',

      'goal.milestones': 'Milestones',
      'goal.milestone.add': 'Add milestone',
      'goal.milestone.titlePlaceholder': 'Milestone title',
      'goal.milestone.date': 'Planned date (optional)',
      'goal.milestone.deleteConfirm': 'Click again to confirm deletion',

      'goal.links': 'Links',
      'goal.links.addNote': 'Link a note…',
      'goal.links.addBookmark': 'Link a bookmark…',
      'goal.links.empty': 'No links yet',
      'goal.links.open': 'Open',
      'goal.links.remove': 'Remove link',
      'goal.links.module.notes': 'Note',
      'goal.links.module.bookmarks': 'Bookmark',

      'growth.tab.goals': 'Goals',
      'growth.tab.skills': 'Skills',
      'growth.tab.reviews': 'Reviews',

      'skill.title': 'Skills',
      'skill.new': 'New skill',
      'skill.empty': 'No skills yet',
      'skill.namePlaceholder': 'Skill name',
      'skill.level': 'Proficiency',
      'skill.level.0': 'Unevaluated',
      'skill.goalLabel': 'Owning goal (optional)',
      'skill.goal.none': '(standalone)',
      'skill.evidence': 'Evidence',
      'skill.resources': 'Resources',
      'skill.links.addNote': 'Link a note (evidence)…',
      'skill.links.addBookmark': 'Link a bookmark (resource)…',
      'skill.duplicate': 'A skill with this name already exists',

      'review.title': 'Reviews',
      'review.new': 'New review',
      'review.empty': 'No reviews yet',
      'review.reviewedAt': 'Reviewed on',
      'review.contentPlaceholder': 'Review content…',
      'review.goalLabel': 'Owning goal (optional)',
      'review.links.addMemo': 'Link a memo…',
      'review.schedule': 'Schedule next review',
      'review.schedule.date': 'Next review date',
      'review.schedule.arranged': 'Arranged for {{date}}',
      'review.schedule.open': 'Open',
      'review.schedule.done': 'Arranged — click to open',

      'goal.conflict': 'This goal was modified elsewhere; reload before saving',
      'error.NETWORK': 'Network error, please try again later',
      'error.UNKNOWN': 'Something went wrong, please try again',
      'error.VALIDATION_ERROR': 'Invalid input, please check the form',
      'error.CONCURRENT_MODIFICATION': 'This goal was modified elsewhere; reload before saving',
      'error.GOAL_NOT_FOUND': 'Goal not found',
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

      'goal.title': 'Wachstum & Karriere',
      'goal.new': 'Neues Ziel',
      'goal.empty': 'Noch keine Ziele',
      'goal.untitled': 'Unbenanntes Ziel',
      'goal.titlePlaceholder': 'Zieltitel',
      'goal.descriptionPlaceholder': 'Beschreibung (optional)',
      'goal.targetDate': 'Zieldatum',
      'goal.progress': 'Fortschritt {{percent}}%',
      'goal.statusLabel': 'Status',
      'goal.status.active': 'Aktiv',
      'goal.status.paused': 'Pausiert',
      'goal.status.achieved': 'Erreicht',
      'goal.status.archived': 'Archiviert',

      'goal.milestones': 'Meilensteine',
      'goal.milestone.add': 'Meilenstein hinzufügen',
      'goal.milestone.titlePlaceholder': 'Meilensteintitel',
      'goal.milestone.date': 'Geplantes Datum (optional)',
      'goal.milestone.deleteConfirm': 'Erneut klicken zum Löschen',

      'goal.links': 'Verknüpfungen',
      'goal.links.addNote': 'Notiz verknüpfen…',
      'goal.links.addBookmark': 'Lesezeichen verknüpfen…',
      'goal.links.empty': 'Noch keine Verknüpfungen',
      'goal.links.open': 'Öffnen',
      'goal.links.remove': 'Verknüpfung entfernen',
      'goal.links.module.notes': 'Notiz',
      'goal.links.module.bookmarks': 'Lesezeichen',

      'growth.tab.goals': 'Ziele',
      'growth.tab.skills': 'Fähigkeiten',
      'growth.tab.reviews': 'Rückblicke',

      'skill.title': 'Fähigkeiten',
      'skill.new': 'Neue Fähigkeit',
      'skill.empty': 'Noch keine Fähigkeiten',
      'skill.namePlaceholder': 'Name der Fähigkeit',
      'skill.level': 'Kenntnisstand',
      'skill.level.0': 'Nicht bewertet',
      'skill.goalLabel': 'Zugehöriges Ziel (optional)',
      'skill.goal.none': '(unabhängig)',
      'skill.evidence': 'Praxisbelege',
      'skill.resources': 'Lernressourcen',
      'skill.links.addNote': 'Notiz verknüpfen (Beleg)…',
      'skill.links.addBookmark': 'Lesezeichen verknüpfen (Ressource)…',
      'skill.duplicate': 'Eine Fähigkeit mit diesem Namen existiert bereits',

      'review.title': 'Rückblicke',
      'review.new': 'Neuer Rückblick',
      'review.empty': 'Noch keine Rückblicke',
      'review.reviewedAt': 'Rückblick am',
      'review.contentPlaceholder': 'Inhalt des Rückblicks…',
      'review.goalLabel': 'Zugehöriges Ziel (optional)',
      'review.links.addMemo': 'Memo verknüpfen…',
      'review.schedule': 'Nächsten Rückblick planen',
      'review.schedule.date': 'Datum des nächsten Rückblicks',
      'review.schedule.arranged': 'Geplant für {{date}}',
      'review.schedule.open': 'Öffnen',
      'review.schedule.done': 'Geplant — zum Öffnen klicken',

      'goal.conflict': 'Das Ziel wurde anderweitig geändert; bitte neu laden',
      'error.NETWORK': 'Netzwerkfehler, bitte später erneut versuchen',
      'error.UNKNOWN': 'Etwas ist schiefgelaufen, bitte erneut versuchen',
      'error.VALIDATION_ERROR': 'Ungültige Eingabe, bitte das Formular prüfen',
      'error.CONCURRENT_MODIFICATION': 'Das Ziel wurde anderweitig geändert; bitte neu laden',
      'error.GOAL_NOT_FOUND': 'Ziel nicht gefunden',
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
