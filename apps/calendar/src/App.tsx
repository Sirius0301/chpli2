import './i18n';
import './styles.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MemoDto, MemoPriority, TagCountDto } from '@chpli2/shared';
import {
  ApiError,
  createMemo,
  deleteMemo,
  listMemoTags,
  listMemos,
  setMemoCompletion,
  updateMemo,
} from './api';
import { addDays, addMonths, dateFromKey, dayKey, monthGrid, startOfDay, startOfWeek } from './dates';
import { buildInstances, type DisplayMemoInstance } from './view-model';
import { DUE_POLL_MS, dueFromKey, dueInstances, dueToExclusiveKey, dueToKey, dueTodayKeys } from './due';
import {
  markNotified,
  notificationSupport,
  pendingNotifications,
  requestNotificationPermission,
  type NotificationSupport,
} from './notifications';
import Toolbar, { type ViewMode } from './components/Toolbar';
import Sidebar, { type MemoFilters } from './components/Sidebar';
import MonthView from './components/MonthView';
import WeekView, { DayView } from './components/WeekView';
import DetailPanel, { type MemoFormValues } from './components/DetailPanel';

/** View-mode preference persistence (M1 D5). */
const VIEW_STORAGE_KEY = 'chpli2-memo-view';
const ANCHOR_STORAGE_KEY = 'chpli2-memo-anchor';
/** Two-level filter persistence (M2 D6). */
const FILTERS_STORAGE_KEY = 'chpli2-memo-filters';

const VIEW_MODES: readonly ViewMode[] = ['month', 'week', 'day'];

function readStoredView(): ViewMode {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY);
    return VIEW_MODES.includes(raw as ViewMode) ? (raw as ViewMode) : 'week';
  } catch {
    return 'week';
  }
}

function readStoredAnchor(): Date | null {
  try {
    const raw = localStorage.getItem(ANCHOR_STORAGE_KEY);
    if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const [y, m, d] = raw.split('-').map(Number);
    return new Date(y!, m! - 1, d!);
  } catch {
    return null;
  }
}

function readStoredFilters(): MemoFilters {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return { tags: [], priorities: [] };
    const parsed = JSON.parse(raw) as { tags?: unknown; priorities?: unknown };
    return {
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((x) => typeof x === 'string') : [],
      priorities: Array.isArray(parsed.priorities)
        ? parsed.priorities.filter((x): x is MemoPriority =>
            ['none', 'low', 'medium', 'high'].includes(x as string),
          )
        : [],
    };
  } catch {
    return { tags: [], priorities: [] };
  }
}

type PanelState =
  | { kind: 'create'; date: string }
  | { kind: 'edit'; instance: DisplayMemoInstance }
  | null;

/** Due-soon snapshot for the sidebar card, badges and notifications (M4). */
interface DueState {
  todayKey: string;
  /** Uncompleted instances inside the due window, oldest first. */
  due: DisplayMemoInstance[];
  /** All expanded instances in the window (notification candidate pool). */
  window: DisplayMemoInstance[];
}

const EMPTY_DUE: DueState = { todayKey: '', due: [], window: [] };

function windowFor(view: ViewMode, anchor: Date): { days: Date[]; from: string; to: string } {
  const days =
    view === 'month'
      ? monthGrid(anchor)
      : Array.from(
          { length: view === 'week' ? 7 : 1 },
          (_, i) => addDays(view === 'week' ? startOfWeek(anchor) : startOfDay(anchor), i),
        );
  const from = dayKey(days[0]!);
  // API `to` is exclusive; the last grid day itself must be included.
  const to = dayKey(addDays(days[days.length - 1]!, 1));
  return { days, from, to };
}

export default function CalendarApp() {
  const { t, i18n } = useTranslation();
  const [view, setViewState] = useState<ViewMode>(() => readStoredView());
  const [anchor, setAnchor] = useState<Date>(() => readStoredAnchor() ?? new Date());
  const [memos, setMemos] = useState<MemoDto[] | null>(null);
  const [tagCounts, setTagCounts] = useState<TagCountDto[]>([]);
  const [filters, setFiltersState] = useState<MemoFilters>(() => readStoredFilters());
  const [panel, setPanel] = useState<PanelState>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const setFilters = useCallback((next: MemoFilters) => {
    setFiltersState(next);
    try {
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable; filters just won't persist */
    }
  }, []);

  const setView = useCallback((next: ViewMode) => {
    setViewState(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* storage unavailable; preference just won't persist */
    }
  }, []);

  const { days, from, to } = useMemo(() => windowFor(view, anchor), [view, anchor]);
  const rangeKey = `${from}/${to}`;
  const lastDayKey = dayKey(days[days.length - 1]!);
  const filtersKey = `${filters.tags.join(',')}|${filters.priorities.join(',')}`;

  const reload = useCallback(async () => {
    const [rows, tags] = await Promise.all([listMemos(from, to, filters), listMemoTags()]);
    setMemos(rows);
    setTagCounts(tags);
  }, [from, to, filters]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rows, tags] = await Promise.all([listMemos(from, to, filters), listMemoTags()]);
        if (!cancelled) {
          setMemos(rows);
          setTagCounts(tags);
          setLoadError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof ApiError ? error.errorCode : 'UNKNOWN');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rangeKey, filtersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const instances = useMemo(
    () => (memos ? buildInstances(memos, from, lastDayKey) : []),
    [memos, from, lastDayKey],
  );

  // -- Due-soon polling (M4 D5/D6) ---------------------------------------------

  const [dueState, setDueState] = useState<DueState>(EMPTY_DUE);
  const [notifySupport, setNotifySupport] = useState<NotificationSupport>(() =>
    notificationSupport(),
  );

  const refreshDue = useCallback(async () => {
    const tk = dayKey(new Date());
    const fromKey = dueFromKey(tk);
    const toExclusive = dueToExclusiveKey(tk);
    const rows = await listMemos(fromKey, toExclusive);
    const windowInstances = buildInstances(rows, fromKey, dueToKey(tk));
    setDueState({
      todayKey: tk,
      due: dueInstances(windowInstances, tk),
      window: windowInstances,
    });
  }, []);

  useEffect(() => {
    const run = () => {
      refreshDue().catch(() => {
        /* due data degrades silently; the views keep working */
      });
    };
    run();
    const timer = setInterval(run, DUE_POLL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [refreshDue]);

  // Notifications fire once per due instance per session (M4 D2/D3/D4).
  useEffect(() => {
    if (!dueState.todayKey) return;
    let storage: Storage | null = null;
    try {
      storage = window.sessionStorage;
    } catch {
      return;
    }
    const pending = pendingNotifications(dueState.window, dueState.todayKey, storage);
    for (const instance of pending) {
      markNotified(storage, instance.key);
      if (notifySupport === 'granted') {
        try {
          const notice = new Notification(t('memo.notifyTitle'), {
            body: t('memo.notifyBody', {
              title: instance.title,
              date: new Date(`${instance.date}T00:00:00`).toLocaleDateString(i18n.language, {
                month: 'short',
                day: 'numeric',
              }),
            }),
          });
          notice.onclick = () => window.focus();
        } catch {
          /* some platforms throw on construction; the card still shows it */
        }
      }
    }
  }, [dueState, notifySupport, t, i18n.language]);

  const enableNotify = useCallback(() => {
    void requestNotificationPermission().then(setNotifySupport);
  }, []);

  const openDueInstance = useCallback(
    (instance: DisplayMemoInstance) => {
      setAnchor(dateFromKey(instance.date));
      setView('day');
      setPanel({ kind: 'edit', instance });
    },
    [setView],
  );

  const dueBadges = useMemo(
    () => dueTodayKeys(dueState.window, dueState.todayKey || dayKey(new Date())),
    [dueState],
  );

  // -- Navigation -------------------------------------------------------------

  const navigate = (direction: -1 | 1) => {
    setAnchor((prev) => {
      if (view === 'month') return addMonths(prev, direction);
      return addDays(prev, direction * (view === 'week' ? 7 : 1));
    });
  };

  const goToday = () => setAnchor(new Date());

  useEffect(() => {
    try {
      localStorage.setItem(ANCHOR_STORAGE_KEY, dayKey(anchor));
    } catch {
      /* non-persistent anchor is acceptable */
    }
  }, [anchor]);

  // -- Mutations ---------------------------------------------------------------

  const applyUpdatedMemo = useCallback((updated: MemoDto) => {
    setMemos((prev) =>
      prev ? prev.map((m) => (m.id === updated.id ? updated : m)) : prev,
    );
  }, []);

  const handleToggle = async (instance: DisplayMemoInstance) => {
    try {
      const updated = await setMemoCompletion(instance.memoId, {
        date: instance.date,
        completed: !instance.completed,
      });
      applyUpdatedMemo(updated);
      await refreshDue();
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.errorCode : 'UNKNOWN');
    }
  };

  const handleSubmit = async (values: MemoFormValues) => {
    if (panel?.kind === 'edit') {
      const updated = await updateMemo(panel.instance.memoId, {
        ...values,
        updatedAt: panel.instance.source.updatedAt,
      });
      applyUpdatedMemo(updated);
    } else {
      const created = await createMemo({ id: crypto.randomUUID(), ...values });
      setMemos((prev) => (prev ? [...prev, created] : prev));
    }
    setPanel(null);
    await reload();
    await refreshDue();
  };

  const handleDelete = async () => {
    if (panel?.kind !== 'edit') return;
    await deleteMemo(panel.instance.memoId);
    setPanel(null);
    await reload();
    await refreshDue();
  };

  // -- Render ------------------------------------------------------------------

  if (memos === null && loadError) {
    return (
      <section>
        <div className="calendar-error" role="alert">
          <p>{t([`error.${loadError}`, 'error.UNKNOWN'])}</p>
          <button type="button" className="button" onClick={() => window.location.reload()}>
            {t('common.retry')}
          </button>
        </div>
      </section>
    );
  }

  const title =
    view === 'month'
      ? anchor.toLocaleString(i18n.language, { year: 'numeric', month: 'long' })
      : view === 'week'
        ? `${days[0]!.toLocaleString(i18n.language, { month: 'short', day: 'numeric' })} – ${days[6]!.toLocaleString(i18n.language, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}`
        : days[0]!.toLocaleString(i18n.language, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

  const openCreate = (day: Date) => {
    setPanel({ kind: 'create', date: dayKey(day) });
  };

  const openInstance = (instance: DisplayMemoInstance) => {
    setPanel({ kind: 'edit', instance });
  };

  return (
    <section className="cal-app">
      <Toolbar title={title} view={view} onViewChange={setView} onNavigate={navigate} onToday={goToday} />
      {loadError && (
        <div className="calendar-error" role="alert">
          <p>{t([`error.${loadError}`, 'error.UNKNOWN'])}</p>
          <button
            type="button"
            className="button"
            onClick={() => void reload().then(() => setLoadError(null))}
          >
            {t('common.retry')}
          </button>
        </div>
      )}
      <div className="cal-body">
        <Sidebar
          tags={tagCounts}
          filters={filters}
          onChange={setFilters}
          due={dueState.due}
          onOpenDue={openDueInstance}
          notifySupport={notifySupport}
          onEnableNotify={enableNotify}
        />
        <div className="cal-main">
          {view === 'month' && (
            <MonthView
              days={days}
              anchor={anchor}
              instances={instances}
              dueBadges={dueBadges}
              onDayClick={openCreate}
              onOpen={openInstance}
              onToggle={(instance) => void handleToggle(instance)}
              onShowDay={(day) => {
                setAnchor(day);
                setView('day');
              }}
            />
          )}
          {view === 'week' && (
            <WeekView
              days={days}
              instances={instances}
              dueBadges={dueBadges}
              onDayClick={openCreate}
              onOpen={openInstance}
              onToggle={(instance) => void handleToggle(instance)}
            />
          )}
          {view === 'day' && (
            <DayView
              days={days}
              instances={instances}
              dueBadges={dueBadges}
              onDayClick={openCreate}
              onOpen={openInstance}
              onToggle={(instance) => void handleToggle(instance)}
            />
          )}
        </div>

        {panel?.kind === 'create' && (
          <DetailPanel
            mode="create"
            initialDate={panel.date}
            onSubmit={handleSubmit}
            onClose={() => setPanel(null)}
          />
        )}
        {panel?.kind === 'edit' && (
          <DetailPanel
            mode="edit"
            initialDate={panel.instance.date}
            memo={panel.instance.source}
            onSubmit={handleSubmit}
            onDelete={() => handleDelete()}
            onClose={() => setPanel(null)}
          />
        )}
      </div>
    </section>
  );
}
