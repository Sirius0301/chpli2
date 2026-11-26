import './i18n';
import './styles.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '@chpli2/ui';
import type { NoteDto, NoteImageDto, NotePriority, NotePublishStatus, NoteSummaryDto, NoteVersionDto, TagCountDto } from '@chpli2/shared';
import { MEMO_PRIORITIES } from '@chpli2/shared';
import {
  ApiError,
  createNote,
  deleteNote,
  getNote,
  listBacklinks,
  listNoteCategories,
  listNoteTags,
  listNotes,
  listVersions,
  restoreVersion,
  updateNote,
} from './api';
import { clearLocalDraft, readLocalDraft, writeLocalDraft } from './editor-utils';
import NoteEditor from './components/NoteEditor';
import NoteFilters from './components/NoteFilters';
import NotesHome from './components/NotesHome';

const FILTERS_STORAGE_KEY = 'chpli2-notes-filters';
const AUTOSAVE_DEBOUNCE_MS = 1_500;
const SEARCH_DEBOUNCE_MS = 300;
/** Debounce for the localStorage draft backup (自动备份兜底). */
const LOCAL_BACKUP_DEBOUNCE_MS = 800;

export interface NoteFiltersState {
  tags: string[];
  priorities: NotePriority[];
  /** OR semantics (N3 sidebar filter). */
  categories: string[];
  /** OR semantics (N3 sidebar filter). */
  publishStatuses: NotePublishStatus[];
}

/** Editable note fields held in the editor draft (content + publish form). */
export interface NoteDraft {
  title: string;
  body: string;
  priority: NotePriority;
  tags: string[];
  category: string | null;
  excerpt: string | null;
  allowComments: boolean;
  pinned: boolean;
  /**
   * Access-password form value: '' = keep the existing password,
   * null = clear it, any other string = set/replace (hashed server-side).
   */
  accessPassword: string | null;
  hasAccessPassword: boolean;
  showOnHome: boolean;
  publishStatus: NotePublishStatus;
  publishAt: string | null;
  /** Server-stamped actual publish time (read-only display meta). */
  publishedAt: string | null;
}

function draftFrom(note: NoteDto): NoteDraft {
  return {
    title: note.title,
    body: note.body,
    priority: note.priority,
    tags: note.tags,
    category: note.category,
    excerpt: note.excerpt,
    allowComments: note.allowComments,
    pinned: note.pinned,
    accessPassword: '',
    hasAccessPassword: note.hasAccessPassword,
    showOnHome: note.showOnHome,
    publishStatus: note.publishStatus,
    publishAt: note.publishAt,
    publishedAt: note.publishedAt,
  };
}

export type SaveState = 'saved' | 'saving' | 'failed' | 'conflict';

const NOTE_STATUSES: readonly NotePublishStatus[] = ['draft', 'published', 'scheduled'];

function readStoredFilters(): NoteFiltersState {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return { tags: [], priorities: [], categories: [], publishStatuses: [] };
    const parsed = JSON.parse(raw) as {
      tags?: unknown;
      priorities?: unknown;
      categories?: unknown;
      publishStatuses?: unknown;
    };
    return {
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((x) => typeof x === 'string') : [],
      priorities: Array.isArray(parsed.priorities)
        ? parsed.priorities.filter((x): x is NotePriority =>
            ['none', 'low', 'medium', 'high'].includes(x as string),
          )
        : [],
      categories: Array.isArray(parsed.categories)
        ? parsed.categories.filter((x) => typeof x === 'string')
        : [],
      publishStatuses: Array.isArray(parsed.publishStatuses)
        ? parsed.publishStatuses.filter((x): x is NotePublishStatus =>
            NOTE_STATUSES.includes(x as NotePublishStatus),
          )
        : [],
    };
  } catch {
    return { tags: [], priorities: [], categories: [], publishStatuses: [] };
  }
}

export default function NotesApp() {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<NoteDto[] | null>(null);
  const [tagCounts, setTagCounts] = useState<TagCountDto[]>([]);
  /** Category filter candidates (aggregate, unaffected by filtering, N3). */
  const [categoryCounts, setCategoryCounts] = useState<TagCountDto[]>([]);
  /** Unfiltered titles for wiki-link resolution (N2 D1) and the insert picker. */
  const [allNotes, setAllNotes] = useState<NoteSummaryDto[]>([]);
  /** Unfiltered full rows — feeds the NotesHome browse view (N3). */
  const [allNoteRows, setAllNoteRows] = useState<NoteDto[]>([]);
  const [filters, setFiltersState] = useState<NoteFiltersState>(() => readStoredFilters());
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [backlinks, setBacklinks] = useState<NoteSummaryDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Deep-link request: open this note id straight into the reading view. */
  const [readingFor, setReadingFor] = useState<string | null>(null);
  const [draft, setDraft] = useState<NoteDraft>({
    title: '',
    body: '',
    priority: 'none',
    tags: [],
    category: null,
    excerpt: null,
    allowComments: true,
    pinned: false,
    accessPassword: '',
    hasAccessPassword: false,
    showOnHome: false,
    publishStatus: 'draft',
    publishAt: null,
    publishedAt: null,
  });
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [publishing, setPublishing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 选中笔记优先从未过滤全集查找：筛选条件把当前笔记筛掉时编辑器不卸载。
  const selected = useMemo(
    () =>
      allNoteRows.find((n) => n.id === selectedId) ??
      notes?.find((n) => n.id === selectedId) ??
      null,
    [allNoteRows, notes, selectedId],
  );

  /** Distinct categories across ALL of the user's notes (publish-form dropdown). */
  const [categories, setCategories] = useState<string[]>([]);

  // Live refs so the debounced saver never captures stale drafts.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const dirtyRef = useRef(false);

  const filtersKey = `${filters.tags.join(',')}|${filters.priorities.join(',')}|${filters.categories.join(',')}|${filters.publishStatuses.join(',')}|${query}`;

  const refreshAllNotes = useCallback(async () => {
    const rows = await listNotes();
    setAllNotes(rows.map((n) => ({ id: n.id, title: n.title })));
    setAllNoteRows(rows);
    setCategories(
      [...new Set(rows.map((n) => n.category).filter((c): c is string => !!c))].sort(),
    );
  }, []);

  /** Tag/category aggregates (filter candidates) — refetched after every mutation. */
  const refreshAggregates = useCallback(async () => {
    const [tags, categories] = await Promise.all([listNoteTags(), listNoteCategories()]);
    setTagCounts(tags);
    setCategoryCounts(categories);
  }, []);

  const reload = useCallback(async () => {
    const [rows, tags, categories] = await Promise.all([
      listNotes(filters),
      listNoteTags(),
      listNoteCategories(),
    ]);
    setNotes(rows);
    setTagCounts(tags);
    setCategoryCounts(categories);
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rows, tags, categories] = await Promise.all([
          listNotes({ ...filters, q: query || undefined }),
          listNoteTags(),
          listNoteCategories(),
        ]);
        if (!cancelled) {
          setNotes(rows);
          setTagCounts(tags);
          setCategoryCounts(categories);
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

  // 所有写操作串行化：防抖自动保存与发布按钮的 PATCH 并发同版本会 409，
  // 重负载下表现为"保存/定时发布静默失败"（e2e 全套确定性复现）。
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const enqueueSave = useCallback((fn: () => Promise<unknown>) => {
    const run = saveChainRef.current.then(fn, fn);
    saveChainRef.current = run.catch(() => {});
    return run;
  }, []);

  const persist = useCallback(async (): Promise<NoteDto | null> => {
    return enqueueSave(persistRaw) as Promise<NoteDto | null>;
  }, [enqueueSave]);

  const persistRaw = useCallback(async (): Promise<NoteDto | null> => {
    const note = selectedRef.current;
    if (!note || !dirtyRef.current) return null;
    const save = (updatedAt: string) => {
      // Content fields only: publish meta (status/schedule/password) is
      // written exclusively by the publish-form actions.
      const d = draftRef.current;
      return updateNote(note.id, {
        title: d.title,
        body: d.body,
        priority: d.priority,
        tags: d.tags,
        category: d.category,
        excerpt: d.excerpt,
        allowComments: d.allowComments,
        pinned: d.pinned,
        showOnHome: d.showOnHome,
        updatedAt,
      });
    };
    setSaveState('saving');
    try {
      const updated = await save(note.updatedAt);
      dirtyRef.current = false;
      setSaveState('saved');
      clearLocalDraft(note.id);
      setNotes((prev) => prev?.map((n) => (n.id === updated.id ? updated : n)) ?? prev);
      void refreshAllNotes().catch(() => {}); // title may have changed (wiki map)
      if (draftRef.current.body !== note.body || draftRef.current.title !== note.title) {
        // The user kept typing while saving — schedule another pass.
        dirtyRef.current = true;
      }
      void refreshAggregates().catch(() => {});
      return updated;
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
          clearLocalDraft(note.id);
          setNotes((prev) => prev?.map((n) => (n.id === updated.id ? updated : n)) ?? prev);
          return updated;
        } catch {
          /* fall through to the conflict surface */
        }
      }
      if (error instanceof ApiError && error.statusCode === 409) {
        setSaveState('conflict');
      } else {
        setSaveState('failed');
      }
      return null;
    }
  }, [refreshAllNotes, refreshAggregates]);

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

  // localStorage draft backup (自动备份兜底): snapshots the dirty draft so a
  // refresh/crash never loses content; cleared on every successful save.
  useEffect(() => {
    if (!dirtyRef.current || !selected) return;
    const timer = setTimeout(() => writeLocalDraft(selected.id, draftRef.current), LOCAL_BACKUP_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, selected]);

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
      // A stranded local backup wins over the server copy (it is newer work
      // that never got autosaved); keep it dirty so it re-uploads.
      const local = readLocalDraft<NoteDraft>(note.id);
      if (local && (local.body !== note.body || local.title !== note.title)) {
        setDraft(local);
        dirtyRef.current = true;
        setSaveState('failed');
      } else {
        setDraft(draftFrom(note));
        dirtyRef.current = false;
        setSaveState('saved');
      }
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
      const pending = JSON.parse(raw) as { module?: string; id?: string; mode?: string };
      sessionStorage.removeItem('chpli2-pending-open');
      if (pending.module === 'notes' && pending.id) {
        if (pending.mode === 'reading') setReadingFor(pending.id);
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
    void refreshAggregates().catch(() => {});
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
    void refreshAggregates().catch(() => {});
  };

  const reloadCurrent = async () => {
    if (!selected) return;
    await reload();
    const fresh = (await listNotes()).find((n) => n.id === selected.id);
    if (fresh) {
      setDraft(draftFrom(fresh));
      dirtyRef.current = false;
      setSaveState('saved');
      clearLocalDraft(fresh.id);
    }
  };

  const handleRestore = useCallback(
    async (seq: number) => {
      if (!selected) return;
      const restored = await restoreVersion(selected.id, seq);
      setNotes((prev) => prev?.map((n) => (n.id === restored.id ? restored : n)) ?? prev);
      setDraft(draftFrom(restored));
      dirtyRef.current = false;
      setSaveState('saved');
      void refreshAllNotes().catch(() => {});
    },
    [selected, refreshAllNotes],
  );

  /**
   * Publish-form actions (N3): flush any dirty content first, then persist
   * the full draft plus the requested publish transition in one PATCH.
   */
  const publishActionRaw = useCallback(
    async (action: 'draft' | 'publish' | 'scheduled', publishAt?: string) => {
      const note = selectedRef.current;
      if (!note) return;
      setPublishing(true);
      try {
        // Flush dirty content first; persist() returns the saved row.
        // 直接调 persistRaw：外层 enqueueSave 已持有队列，persist() 会再入队造成死锁。
        const base = dirtyRef.current ? await persistRaw() : null;
        const freshest = base ?? selectedRef.current;
        if (!freshest) return;
        const d = draftRef.current;
        const updated = await updateNote(freshest.id, {
          title: d.title.trim() || freshest.title,
          body: d.body,
          priority: d.priority,
          tags: d.tags,
          category: d.category,
          excerpt: d.excerpt,
          allowComments: d.allowComments,
          pinned: d.pinned,
          showOnHome: d.showOnHome,
          // '' = keep the stored password; null = clear; string = set/replace.
          accessPassword: d.accessPassword === '' ? undefined : d.accessPassword,
          publishStatus: action === 'draft' ? 'draft' : action === 'publish' ? 'published' : 'scheduled',
          publishAt: action === 'scheduled' ? (publishAt ?? null) : null,
          updatedAt: freshest.updatedAt,
        });
        dirtyRef.current = false;
        setSaveState('saved');
        clearLocalDraft(freshest.id);
        setNotes((prev) => prev?.map((n) => (n.id === updated.id ? updated : n)) ?? prev);
        setDraft(draftFrom(updated));
        void refreshAggregates().catch(() => {});
        void refreshAllNotes().catch(() => {}); // publish meta feeds NotesHome
      } catch {
        setSaveState('failed');
      } finally {
        setPublishing(false);
      }
    },
    [persist, refreshAggregates, refreshAllNotes],
  );

  // 发布动作与自动保存共用串行队列：并发的同版本 PATCH 会让一方 409
  // （重负载下表现为保存/定时发布静默失败，e2e 全套曾确定性复现）。
  const handlePublishAction = useCallback(
    async (action: 'draft' | 'publish' | 'scheduled', publishAt?: string) => {
      return enqueueSave(() => publishActionRaw(action, publishAt));
    },
    [enqueueSave, publishActionRaw],
  );

  if (notes === null && loadError) {
    return (
      <section>
        <div className="notes-error" role="alert">
          <p>{t([`error.${loadError}`, 'error.UNKNOWN'])}</p>
          <Button size="sm" onClick={() => void reload().then(() => setLoadError(null))}>
            {t('common.retry')}
          </Button>
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
          <Button size="sm" variant="primary" onClick={() => void handleCreate()}>
            {t('notes.new')}
          </Button>
        </div>
        <Input
          type="search"
          className="notes-search"
          placeholder={t('notes.searchPlaceholder')}
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          aria-label={t('notes.searchPlaceholder')}
        />
        <NoteFilters
          tags={tagCounts}
          categories={categoryCounts}
          filters={filters}
          onChange={setFilters}
        />
      </aside>
      <div className="notes-main">
        {selected ? (
          <NoteEditor
            note={selected}
            draft={draft}
            saveState={saveState}
            publishing={publishing}
            confirmingDelete={confirmingDelete}
            allNotes={allNotes}
            backlinks={backlinks}
            categories={categories}
            onDraftChange={(next) => {
              dirtyRef.current = true;
              setDraft(next);
            }}
            onSave={() => void persist()}
            onDelete={() => void handleDelete()}
            onRetry={() => void persist()}
            onReload={() => void reloadCurrent()}
            onOpenNote={(id) => void openNoteById(id)}
            onLoadVersions={(id) => listVersions(id)}
            onRestoreVersion={(seq) => void handleRestore(seq)}
            onPublishAction={(action, publishAt) => void handlePublishAction(action, publishAt)}
            readingFor={readingFor}
            onClose={() => {
              if (dirtyRef.current) void persist();
              setSelectedId(null);
            }}
          />
        ) : (
          <NotesHome
            notes={notes ?? []}
            total={allNoteRows.length}
            onOpen={selectNote}
          />
        )}
      </div>
    </section>
  );
}

export { MEMO_PRIORITIES as NOTE_PRIORITIES };
