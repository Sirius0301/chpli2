import './i18n';
import './styles.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NoteDto, NotePriority, TagCountDto } from '@chpli2/shared';
import { MEMO_PRIORITIES } from '@chpli2/shared';
import {
  ApiError,
  createNote,
  deleteNote,
  listNoteTags,
  listNotes,
  updateNote,
} from './api';
import NoteList from './components/NoteList';
import NoteEditor from './components/NoteEditor';
import NoteFilters from './components/NoteFilters';

const FILTERS_STORAGE_KEY = 'chpli2-notes-filters';
const AUTOSAVE_DEBOUNCE_MS = 1_500;

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
  const [filters, setFiltersState] = useState<NoteFiltersState>(() => readStoredFilters());
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

  const filtersKey = `${filters.tags.join(',')}|${filters.priorities.join(',')}`;

  const reload = useCallback(async () => {
    const [rows, tags] = await Promise.all([listNotes(filters), listNoteTags()]);
    setNotes(rows);
    setTagCounts(tags);
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rows, tags] = await Promise.all([listNotes(filters), listNoteTags()]);
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
    const current = draftRef.current;
    setSaveState('saving');
    try {
      const updated = await updateNote(note.id, { ...current, updatedAt: note.updatedAt });
      dirtyRef.current = false;
      setSaveState('saved');
      setNotes((prev) => prev?.map((n) => (n.id === updated.id ? updated : n)) ?? prev);
      if (draftRef.current !== current) {
        // The user kept typing while saving — schedule another pass.
        dirtyRef.current = true;
      }
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 409) {
        setSaveState('conflict');
      } else {
        setSaveState('failed');
      }
    }
  }, []);

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
      // Switching notes flushes nothing: autosave is per selected note; a
      // dirty draft on the previous note is saved by its debounce timer only
      // while it was selected. To avoid silent loss, save synchronously-ish.
      if (dirtyRef.current && selectedRef.current) void persist();
      setSelectedId(note.id);
      setDraft({ title: note.title, body: note.body, priority: note.priority, tags: note.tags });
      dirtyRef.current = false;
      setSaveState('saved');
      setConfirmingDelete(false);
    },
    [persist],
  );

  const handleCreate = async () => {
    const created = await createNote({
      id: crypto.randomUUID(),
      title: t('notes.untitled'),
      body: '',
    });
    setNotes((prev) => [created, ...(prev ?? [])]);
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
            onDraftChange={(next) => {
              dirtyRef.current = true;
              setDraft(next);
            }}
            onDelete={() => void handleDelete()}
            onRetry={() => void persist()}
            onReload={() => void reloadCurrent()}
          />
        ) : (
          <p className="notes-empty">{t('notes.empty')}</p>
        )}
      </div>
    </section>
  );
}

export { MEMO_PRIORITIES as NOTE_PRIORITIES };
