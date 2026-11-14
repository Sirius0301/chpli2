import './i18n';
import './styles.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NoteDto, NoteImageDto, NotePriority, NoteSummaryDto, NoteVersionDto, TagCountDto } from '@chpli2/shared';
import { MEMO_PRIORITIES } from '@chpli2/shared';
import {
  ApiError,
  createNote,
  deleteNote,
  getNote,
  listBacklinks,
  listNoteTags,
  listNotes,
  listVersions,
  restoreVersion,
  updateNote,
} from './api';
import NoteList from './components/NoteList';
import NoteEditor from './components/NoteEditor';
import NoteFilters from './components/NoteFilters';

const FILTERS_STORAGE_KEY = 'chpli2-notes-filters';
const AUTOSAVE_DEBOUNCE_MS = 1_500;
const SEARCH_DEBOUNCE_MS = 300;

export interface NoteFiltersState {
  tags: string[];
  priorities: NotePriority[];
}

export type SaveState = 'saved' | 'saving' | 'failed' | 'conflict';

function readStoredFilters(): NoteFiltersState {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return { tags: [], priorities: [] };
    const parsed = JSON.parse(raw) as { tags?: unknown; priorities?: unknown };
    return {
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((x) => typeof x === 'string') : [],
      priorities: Array.isArray(parsed.priorities)
        ? parsed.priorities.filter((x): x is NotePriority =>
            ['none', 'low', 'medium', 'high'].includes(x as string),
          )
        : [],
    };
  } catch {
    return { tags: [], priorities: [] };
  }
}

export default function NotesApp() {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<NoteDto[] | null>(null);
  const [tagCounts, setTagCounts] = useState<TagCountDto[]>([]);
  /** Unfiltered titles for wiki-link resolution (N2 D1) and the insert picker. */
  const [allNotes, setAllNotes] = useState<NoteSummaryDto[]>([]);
  const [filters, setFiltersState] = useState<NoteFiltersState>(() => readStoredFilters());
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [backlinks, setBacklinks] = useState<NoteSummaryDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: '', body: '', priority: 'none' as NotePriority, tags: [] as string[] });
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const selected = useMemo(
    () => notes?.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId],
  );

  // Live refs so the debounced saver never captures stale drafts.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const dirtyRef = useRef(false);

  const filtersKey = `${filters.tags.join(',')}|${filters.priorities.join(',')}|${query}`;

  const refreshAllNotes = useCallback(async () => {
    const rows = await listNotes();
    setAllNotes(rows.map((n) => ({ id: n.id, title: n.title })));
  }, []);

  const reload = useCallback(async () => {
    const [rows, tags] = await Promise.all([listNotes(filters), listNoteTags()]);
    setNotes(rows);
    setTagCounts(tags);
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rows, tags] = await Promise.all([
          listNotes({ ...filters, q: query || undefined }),
          listNoteTags(),
        ]);
        if (!cancelled) {
          setNotes(rows);
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
  }, [filtersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search input debounce (N2 D3).
  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Unfiltered titles: refreshed on mount and after every mutation.
  useEffect(() => {
    refreshAllNotes().catch(() => {});
  }, [refreshAllNotes]);

  const setFilters = useCallback((next: NoteFiltersState) => {
    setFiltersState(next);
    try {
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* filters just won't persist */
    }
  }, []);

  const persist = useCallback(async () => {
    const note = selectedRef.current;
    if (!note || !dirtyRef.current) return;
    const save = (updatedAt: string) =>
      updateNote(note.id, { ...draftRef.current, updatedAt });
    setSaveState('saving');
    try {
      const updated = await save(note.updatedAt);
      dirtyRef.current = false;
      setSaveState('saved');
      setNotes((prev) => prev?.map((n) => (n.id === updated.id ? updated : n)) ?? prev);
      void refreshAllNotes().catch(() => {}); // title may have changed (wiki map)
      if (draftRef.current.body !== note.body || draftRef.current.title !== note.title) {
        // The user kept typing while saving — schedule another pass.
        dirtyRef.current = true;
      }
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 409) {
        // Another save landed mid-flight: re-read the authoritative version
        // and retry once before surfacing a conflict (E81/race handling).
        try {
          const fresh = await getNote(note.id);
          setNotes((prev) => prev?.map((n) => (n.id === fresh.id ? fresh : n)) ?? prev);
          const updated = await save(fresh.updatedAt);
          dirtyRef.current = false;
          setSaveState('saved');
          setNotes((prev) => prev?.map((n) => (n.id === updated.id ? updated : n)) ?? prev);
          return;
        } catch {
          /* fall through to the conflict surface */
        }
      }
      if (error instanceof ApiError && error.statusCode === 409) {
        setSaveState('conflict');
      } else {
        setSaveState('failed');
      }
    }
  }, [refreshAllNotes]);

  // Backlinks refresh whenever the selected note changes (N2 D2).
  useEffect(() => {
    if (!selectedId) {
      setBacklinks([]);
      return;
    }
    let cancelled = false;
    listBacklinks(selectedId)
      .then((rows) => {
        if (!cancelled) setBacklinks(rows);
      })
      .catch(() => {
        if (!cancelled) setBacklinks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, notes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced autosave (N1 D4).
  useEffect(() => {
    if (!dirtyRef.current || !selected) return;
    const timer = setTimeout(() => void persist(), AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, selected, persist]);

  // Cmd/Ctrl+S saves immediately.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void persist();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [persist]);

  const selectNote = useCallback(
    (note: NoteDto) => {
      // Flush a dirty draft on the previously selected note before switching.
      if (dirtyRef.current && selectedRef.current) void persist();
      setSelectedId(note.id);
      setDraft({ title: note.title, body: note.body, priority: note.priority, tags: note.tags });
      dirtyRef.current = false;
      setSaveState('saved');
      setConfirmingDelete(false);
    },
    [persist],
  );

  /** Opens a note by id even when it is outside the current filter/search. */
  const openNoteById = useCallback(
    async (id: string) => {
      try {
        const note = await getNote(id);
        setNotes((prev) =>
          prev?.some((n) => n.id === id) ? prev.map((n) => (n.id === id ? note : n)) : [note, ...(prev ?? [])],
        );
        selectNote(note);
      } catch {
        /* note deleted or not visible: stay put */
      }
    },
    [selectNote],
  );

  // Cross-module deep link (G1 D6): a goal link asks us to open a note.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('chpli2-pending-open');
      if (!raw) return;
      const pending = JSON.parse(raw) as { module?: string; id?: string };
      sessionStorage.removeItem('chpli2-pending-open');
      if (pending.module === 'notes' && pending.id) {
        void openNoteById(pending.id);
      }
    } catch {
      /* mailbox unavailable */
    }
  }, [openNoteById]);

  const handleCreate = async () => {
    const created = await createNote({
      id: crypto.randomUUID(),
      title: t('notes.untitled'),
      body: '',
    });
    setNotes((prev) => [created, ...(prev ?? [])]);
    void refreshAllNotes().catch(() => {});
    selectNote(created);
  };

  const handleDelete = async () => {
    const note = selected;
    if (!note) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setConfirmingDelete(false);
    await deleteNote(note.id);
    setNotes((prev) => (prev ?? []).filter((n) => n.id !== note.id));
    setSelectedId(null);
    dirtyRef.current = false;
    setSaveState('saved');
    void refreshAllNotes().catch(() => {});
  };

  const reloadCurrent = async () => {
    if (!selected) return;
    await reload();
    const fresh = (await listNotes()).find((n) => n.id === selected.id);
    if (fresh) {
      setDraft({ title: fresh.title, body: fresh.body, priority: fresh.priority, tags: fresh.tags });
      dirtyRef.current = false;
      setSaveState('saved');
    }
  };

  const handleRestore = useCallback(
    async (seq: number) => {
      if (!selected) return;
      const restored = await restoreVersion(selected.id, seq);
      setNotes((prev) => prev?.map((n) => (n.id === restored.id ? restored : n)) ?? prev);
      setDraft({ title: restored.title, body: restored.body, priority: restored.priority, tags: restored.tags });
      dirtyRef.current = false;
      setSaveState('saved');
      void refreshAllNotes().catch(() => {});
    },
    [selected, refreshAllNotes],
  );

  if (notes === null && loadError) {
    return (
      <section>
        <div className="notes-error" role="alert">
          <p>{t([`error.${loadError}`, 'error.UNKNOWN'])}</p>
          <button type="button" className="button" onClick={() => void reload().then(() => setLoadError(null))}>
            {t('common.retry')}
          </button>
        </div>
      </section>
    );
  }

  if (notes === null) {
    return <p className="loading">{t('common.loading')}</p>;
  }

  return (
    <section className="notes-app">
      <aside className="notes-side">
        <div className="notes-side__head">
          <h2>{t('notes.title')}</h2>
          <button type="button" className="button button--primary" onClick={() => void handleCreate()}>
            {t('notes.new')}
          </button>
        </div>
        <input
          type="search"
          className="notes-search"
          placeholder={t('notes.searchPlaceholder')}
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          aria-label={t('notes.searchPlaceholder')}
        />
        <NoteFilters tags={tagCounts} filters={filters} onChange={setFilters} />
        <NoteList notes={notes} selectedId={selectedId} onSelect={selectNote} />
      </aside>
      <div className="notes-main">
        {selected ? (
          <NoteEditor
            note={selected}
            draft={draft}
            saveState={saveState}
            confirmingDelete={confirmingDelete}
            allNotes={allNotes}
            backlinks={backlinks}
            onDraftChange={(next) => {
              dirtyRef.current = true;
              setDraft(next);
            }}
            onDelete={() => void handleDelete()}
            onRetry={() => void persist()}
            onReload={() => void reloadCurrent()}
            onOpenNote={(id) => void openNoteById(id)}
            onLoadVersions={(id) => listVersions(id)}
            onRestoreVersion={(seq) => void handleRestore(seq)}
          />
        ) : (
          <p className="notes-empty">{t('notes.empty')}</p>
        )}
      </div>
    </section>
  );
}

export { MEMO_PRIORITIES as NOTE_PRIORITIES };
