import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Select } from '@chpli2/ui';
import type { NoteDto } from '@chpli2/shared';
import { noteExcerpt } from '@chpli2/shared';

const PAGE_SIZE = 20;
const PREFS_KEY = 'chpli2-notes-home-prefs';

type ViewMode = 'card' | 'list';
type SortMode = 'date' | 'name' | 'category';

const SORTS: readonly SortMode[] = ['date', 'name', 'category'];

interface HomePrefs {
  view: ViewMode;
  sort: SortMode;
}

function readPrefs(): HomePrefs {
  const fallback: HomePrefs = { view: 'card', sort: 'date' };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<HomePrefs>;
    return {
      view: parsed.view === 'list' ? 'list' : 'card',
      sort: SORTS.includes(parsed.sort as SortMode) ? (parsed.sort as SortMode) : 'date',
    };
  } catch {
    return fallback;
  }
}

interface NotesHomeProps {
  /**
   * Filtered note set (sidebar search + tag/category/status/priority filters
   * 联动） — displayed and sorted here.
   */
  notes: NoteDto[];
  /** Unfiltered total: distinguishes "no notes" from "no match". */
  total: number;
  onOpen: (note: NoteDto) => void;
}

/**
 * 笔记模块首页（N3）：未选中笔记时的浏览门面。顶部固定置顶栏（无置顶
 * 则不渲染）；「全部笔记」带数量徽标，支持卡片/列表视图与
 * 按日期/按名称/按分类排序（书签主页同款交互，偏好持久化），
 * 卡片点击进入编辑视图。
 */
export default function NotesHome({ notes, total, onOpen }: NotesHomeProps) {
  const { t, i18n } = useTranslation();
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [prefs, setPrefs] = useState<HomePrefs>(readPrefs);

  const setPref = <K extends keyof HomePrefs>(key: K, value: HomePrefs[K]) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* preference persistence is best-effort */
    }
  };

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [prefs.sort, prefs.view]);

  const { pinned, rest } = useMemo(() => {
    const byUpdated = [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return {
      pinned: byUpdated.filter((n) => n.pinned),
      rest: byUpdated.filter((n) => !n.pinned),
    };
  }, [notes]);

  const sorted = useMemo(() => {
    const rows = [...rest];
    if (prefs.sort === 'name') {
      rows.sort((a, b) => a.title.localeCompare(b.title, i18n.language));
    } else if (prefs.sort === 'category') {
      rows.sort((a, b) => {
        const ac = a.category ?? '￿';
        const bc = b.category ?? '￿';
        return ac.localeCompare(bc, i18n.language) || b.updatedAt.localeCompare(a.updatedAt);
      });
    }
    // 'date'：rest 本身即 updatedAt 降序
    return rows;
  }, [rest, prefs.sort, i18n.language]);

  if (total === 0) {
    return <p className="notes-home__empty">{t('notes.home.empty')}</p>;
  }
  if (notes.length === 0) {
    return <p className="notes-home__empty">{t('notes.home.noMatch')}</p>;
  }

  const meta = (note: NoteDto) => (
    <span className="notes-home__card-meta">
      {note.category && <span className="notes-home__chip">{note.category}</span>}
      {note.publishStatus !== 'draft' && (
        <span className={`notes-list__status notes-list__status--${note.publishStatus}`}>
          {t(`notes.filter.status.${note.publishStatus}`)}
        </span>
      )}
      <time>
        {new Date(note.updatedAt).toLocaleString(i18n.language, {
          month: 'short',
          day: 'numeric',
        })}
      </time>
    </span>
  );

  const card = (note: NoteDto) => (
    <button type="button" key={note.id} className="notes-home__card" onClick={() => onOpen(note)}>
      <span className="notes-home__card-title">{note.title}</span>
      <span className="notes-home__card-excerpt">{noteExcerpt(note.body, 80) || '—'}</span>
      {meta(note)}
    </button>
  );

  const row = (note: NoteDto) => (
    <button type="button" key={note.id} className="notes-home__row-item" onClick={() => onOpen(note)}>
      <span className="notes-home__card-title">{note.title}</span>
      {meta(note)}
    </button>
  );

  return (
    <div className="notes-home" data-testid="notes-home">
      {pinned.length > 0 && (
        <section className="notes-home__section">
          <h3 className="notes-home__heading">{t('notes.home.pinned')}</h3>
          <div className="notes-home__row">{pinned.map(card)}</div>
        </section>
      )}
      <section className="notes-home__section">
        <div className="notes-home__toolbar">
          <h3 className="notes-home__heading">
            {t('notes.home.all')}
            <span className="notes-home__count" data-testid="notes-home-count">
              {rest.length}
            </span>
          </h3>
          <div className="notes-home__controls">
            <div className="notes-home__views" role="tablist">
              {(['card', 'list'] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  role="tab"
                  aria-selected={prefs.view === view}
                  className={
                    prefs.view === view
                      ? 'notes-home__view notes-home__view--active'
                      : 'notes-home__view'
                  }
                  onClick={() => setPref('view', view)}
                >
                  {t(`notes.home.view.${view}`)}
                </button>
              ))}
            </div>
            <label className="notes-home__sort">
              <Select
                value={prefs.sort}
                aria-label={t('notes.home.sortLabel')}
                onChange={(event) => setPref('sort', event.target.value as SortMode)}
              >
                {SORTS.map((sort) => (
                  <option key={sort} value={sort}>
                    {t(`notes.home.sort.${sort}`)}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </div>
        <div
          className={prefs.view === 'card' ? 'notes-home__grid' : 'notes-home__list'}
          data-testid="notes-home-list"
        >
          {sorted.slice(0, visible).map(prefs.view === 'card' ? card : row)}
        </div>
        {rest.length > visible && (
          <Button size="sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            {t('notes.home.loadMore')}
          </Button>
        )}
      </section>
    </div>
  );
}
