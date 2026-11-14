import './i18n';
import './styles.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Select } from '@chpli2/ui';
import type { BookmarkDto, BookmarkSort } from '@chpli2/shared';
import { BOOKMARK_SORTS, BOOKMARK_INACTIVE_DAYS, isValidHttpUrl } from '@chpli2/shared';
import {
  ApiError,
  clickBookmark,
  createBookmark,
  deleteBookmark,
  listBookmarks,
  updateBookmark,
} from './api';
import BookmarkItems from './components/BookmarkItems';
import BookmarkEditor from './components/BookmarkEditor';

const PREFS_STORAGE_KEY = 'chpli2-bookmarks-prefs';

interface Prefs {
  view: 'card' | 'list';
  sort: BookmarkSort;
}

function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Prefs>) : {};
    return {
      view: parsed.view === 'list' ? 'list' : 'card',
      sort: (BOOKMARK_SORTS as readonly string[]).includes(parsed.sort ?? '')
        ? (parsed.sort as BookmarkSort)
        : 'recent',
    };
  } catch {
    return { view: 'card', sort: 'recent' };
  }
}

export default function BookmarksApp() {
  const { t } = useTranslation();
  const [bookmarks, setBookmarks] = useState<BookmarkDto[] | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(() => readPrefs());
  const [editing, setEditing] = useState<{ kind: 'new' } | { kind: 'edit'; bookmark: BookmarkDto } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [inactiveOpen, setInactiveOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const setPref = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* prefs just won't persist */
      }
      return next;
    });
  }, []);

  const reload = useCallback(async () => {
    setBookmarks(await listBookmarks(prefs.sort));
  }, [prefs.sort]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listBookmarks(prefs.sort);
        if (!cancelled) {
          setBookmarks(rows);
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
  }, [prefs.sort]);

  // Cross-module deep link (G1 D6): a goal link asks us to open a bookmark.
  useEffect(() => {
    if (!bookmarks) return;
    try {
      const raw = sessionStorage.getItem('chpli2-pending-open');
      if (!raw) return;
      const pending = JSON.parse(raw) as { module?: string; id?: string };
      sessionStorage.removeItem('chpli2-pending-open');
      if (pending.module === 'bookmarks' && pending.id) {
        const target = bookmarks.find((b) => b.id === pending.id);
        if (target) startEdit(target);
      }
    } catch {
      /* mailbox unavailable */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookmarks]);

  const active = useMemo(() => (bookmarks ?? []).filter((b) => !b.inactive), [bookmarks]);
  const inactive = useMemo(() => (bookmarks ?? []).filter((b) => b.inactive), [bookmarks]);

  const applyUpdated = useCallback((updated: BookmarkDto) => {
    setBookmarks((prev) => prev?.map((b) => (b.id === updated.id ? updated : b)) ?? prev);
  }, []);

  /** Opens the URL in a new tab and records the click (B1 D4). */
  const handleOpen = useCallback(
    (bookmark: BookmarkDto) => {
      window.open(bookmark.url, '_blank', 'noopener,noreferrer');
      clickBookmark(bookmark.id)
        .then(applyUpdated)
        .catch(() => {
          /* the click is best-effort; the link still opened */
        });
    },
    [applyUpdated],
  );

  const handleSubmit = async (values: {
    title: string;
    url: string;
    description: string;
    categories: string[];
  }) => {
    if (editing?.kind === 'edit') {
      const updated = await updateBookmark(editing.bookmark.id, {
        ...values,
        updatedAt: editing.bookmark.updatedAt,
      });
      applyUpdated(updated);
    } else {
      const created = await createBookmark({ id: crypto.randomUUID(), ...values });
      setBookmarks((prev) => [created, ...(prev ?? [])]);
      setEditing({ kind: 'edit', bookmark: created });
      return; // stay in the editor so the cover can be uploaded right away
    }
    setEditing(null);
    setConfirmingDelete(false);
    await reload();
  };

  const handleDelete = async () => {
    if (editing?.kind !== 'edit') return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setConfirmingDelete(false);
    await deleteBookmark(editing.bookmark.id);
    setBookmarks((prev) => (prev ?? []).filter((b) => b.id !== editing.bookmark.id));
    setEditing(null);
  };

  const startEdit = (bookmark: BookmarkDto) => {
    setConfirmingDelete(false);
    setEditing({ kind: 'edit', bookmark });
  };

  if (bookmarks === null && loadError) {
    return (
      <section>
        <div className="bm-error" role="alert">
          <p>{t([`error.${loadError}`, 'error.UNKNOWN'])}</p>
          <Button size="sm" onClick={() => void reload().then(() => setLoadError(null))}>
            {t('common.retry')}
          </Button>
        </div>
      </section>
    );
  }

  if (bookmarks === null) {
    return <p className="loading">{t('common.loading')}</p>;
  }

  return (
    <section className="bm-app">
      <div className="bm-toolbar">
        <h2>{t('bm.title')}</h2>
        <div className="bm-toolbar__views" role="tablist">
          {(['card', 'list'] as const).map((view) => (
            <Button
              key={view}
              role="tab"
              aria-selected={prefs.view === view}
              variant={prefs.view === view ? 'primary' : 'default'}
              size="sm"
              onClick={() => setPref('view', view)}
            >
              {t(`bm.view.${view}`)}
            </Button>
          ))}
        </div>
        <label className="bm-toolbar__sort">
          <span>{t('bm.sortLabel')}</span>
          <Select value={prefs.sort} onChange={(event) => setPref('sort', event.target.value as BookmarkSort)}>
            {BOOKMARK_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {t(`bm.sort.${sort}`)}
              </option>
            ))}
          </Select>
        </label>
        <span className="bm-toolbar__spacer" />
        <Button
          variant="primary"
          onClick={() => {
            setConfirmingDelete(false);
            setEditing({ kind: 'new' });
          }}
        >
          {t('bm.new')}
        </Button>
      </div>

      <div className="bm-body">
        <div className="bm-main">
          {active.length === 0 && inactive.length === 0 ? (
            <p className="bm-empty">{t('bm.empty')}</p>
          ) : (
            <BookmarkItems
              bookmarks={active}
              view={prefs.view}
              onOpen={handleOpen}
              onEdit={startEdit}
            />
          )}

          {inactive.length > 0 && (
            <section className="bm-inactive" data-testid="inactive-section">
              <button
                type="button"
                className="bm-inactive__toggle"
                onClick={() => setInactiveOpen((open) => !open)}
              >
                <span>{t('bm.inactive.section', { count: inactive.length })}</span>
                <span className="bm-inactive__hint">{t('bm.inactive.hint')}</span>
                <span>{t(inactiveOpen ? 'bm.inactive.collapse' : 'bm.inactive.expand')}</span>
              </button>
              {inactiveOpen && (
                <BookmarkItems
                  bookmarks={inactive}
                  view="list"
                  compact
                  onOpen={handleOpen}
                  onEdit={startEdit}
                />
              )}
            </section>
          )}
        </div>

        {editing && (
          <BookmarkEditor
            mode={editing.kind}
            bookmark={editing.kind === 'edit' ? editing.bookmark : undefined}
            confirmingDelete={confirmingDelete}
            onSubmit={handleSubmit}
            onDelete={handleDelete}
            onClose={() => {
              setEditing(null);
              setConfirmingDelete(false);
            }}
          />
        )}
      </div>
    </section>
  );
}

export { isValidHttpUrl, BOOKMARK_INACTIVE_DAYS };
