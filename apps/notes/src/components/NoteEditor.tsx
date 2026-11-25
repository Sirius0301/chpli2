import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Select } from '@chpli2/ui';
import type { NoteDto, NoteSummaryDto, NoteVersionDto } from '@chpli2/shared';
import { MEMO_IMAGE_MAX_BYTES } from '@chpli2/shared';
import type { NoteDraft, SaveState } from '../App';
import { ApiError, uploadNoteImage } from '../api';
import {
  applyTextareaTransform,
  boldTransform,
  buildTocMarkdown,
  codeBlockTransform,
  EMPTY_LIST_ITEM_RE,
  inlineCodeTransform,
  linkTransform,
  listContinuation,
  noteImageSrc,
  orderedListTransform,
  quoteTransform,
  tableTransform,
  taskListTransform,
  texTransform,
  unorderedListTransform,
} from '../editor-utils';
import MarkdownPreview from './MarkdownPreview';
import NoteImages from './NoteImages';
import PublishForm from './PublishForm';
import {
  IconBacklinks,
  IconBold,
  IconBook,
  IconCodeBlock,
  IconFullscreen,
  IconHistory,
  IconImage,
  IconInlineCode,
  IconLink,
  IconListOl,
  IconListUl,
  IconQuote,
  IconSave,
  IconSplit,
  IconTable,
  IconTaskList,
  IconTex,
  IconToc,
} from './EditorIcons';

interface NoteEditorProps {
  note: NoteDto;
  draft: NoteDraft;
  saveState: SaveState;
  publishing: boolean;
  confirmingDelete: boolean;
  /** Unfiltered user notes for wiki resolution and the insert picker. */
  allNotes: NoteSummaryDto[];
  backlinks: NoteSummaryDto[];
  /** Existing categories across the user's notes (publish-form dropdown). */
  categories: string[];
  onDraftChange: (draft: NoteDraft) => void;
  onSave: () => void;
  onDelete: () => void;
  onRetry: () => void;
  onReload: () => void;
  onOpenNote: (id: string) => void;
  onLoadVersions: (noteId: string) => Promise<NoteVersionDto[]>;
  onRestoreVersion: (seq: number) => void;
  onPublishAction: (action: 'draft' | 'publish' | 'scheduled', publishAt?: string) => void;
}

type Tab = 'edit' | 'preview';
type Panel = 'none' | 'backlinks' | 'versions' | 'images';

interface EditorPrefs {
  math: boolean;
  wordWrap: boolean;
  autocomplete: boolean;
  split: boolean;
  syncScroll: boolean;
}

const PREFS_KEY = 'chpli2-notes-editor-prefs';

function readPrefs(): EditorPrefs {
  const fallback = { math: false, wordWrap: true, autocomplete: true, split: false, syncScroll: true };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<EditorPrefs>) } : fallback;
  } catch {
    return fallback;
  }
}

/**
 * cnblog-style note editor (N3): editor-mode dropdown + autosave status on
 * the hint row, 编辑/预览 tabs with a compact icon toolbar, bordered canvas
 * (source / preview / draggable split), lightweight toggles in the canvas
 * corner, drag-drop & paste image upload, localStorage draft backup, and
 * the blog publish form below. Wiki links, versions, backlinks and image
 * attachments (N2) stay available through the drawer panels.
 */
export default function NoteEditor({
  note,
  draft,
  saveState,
  publishing,
  confirmingDelete,
  allNotes,
  backlinks,
  categories,
  onDraftChange,
  onSave,
  onDelete,
  onRetry,
  onReload,
  onOpenNote,
  onLoadVersions,
  onRestoreVersion,
  onPublishAction,
}: NoteEditorProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('edit');
  const [panel, setPanel] = useState<Panel>('none');
  const [versions, setVersions] = useState<NoteVersionDto[]>([]);
  const [confirmingRestore, setConfirmingRestore] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [reading, setReading] = useState(false);
  const [prefs, setPrefsState] = useState<EditorPrefs>(readPrefs);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [splitRatio, setSplitRatio] = useState(50);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const setPrefs = (next: EditorPrefs) => {
    setPrefsState(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* preference persistence is best-effort */
    }
  };

  useEffect(() => {
    setPanel('none');
    setConfirmingRestore(null);
    setReading(false);
    dragDepth.current = 0;
    setDragOver(false);
  }, [note.id]);

  useEffect(() => {
    if (panel !== 'versions') return;
    let cancelled = false;
    onLoadVersions(note.id).then((rows) => {
      if (!cancelled) setVersions(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [panel, note.id, onLoadVersions]);

  // Esc leaves fullscreen / reading mode; panels close via their own buttons.
  useEffect(() => {
    if (!fullscreen && !reading) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (reading) setReading(false);
      else setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen, reading]);

  /** Applies a source transform at the cursor and keeps focus + selection. */
  const applyTransform = useCallback(
    (
      transform: (selected: string) => {
        text: string;
        cursorOffset: number;
        selectStart?: number;
        selectEnd?: number;
      },
    ) => {
      const area = bodyRef.current;
      const start = area?.selectionStart ?? draft.body.length;
      const end = area?.selectionEnd ?? draft.body.length;
      const result = applyTextareaTransform(draft.body, start, end, transform);
      onDraftChange({ ...draft, body: result.next });
      if (area) {
        requestAnimationFrame(() => {
          area.focus();
          area.setSelectionRange(result.selectionStart, result.selectionEnd);
        });
      }
    },
    [draft, onDraftChange],
  );

  const insertAtCursor = useCallback(
    (text: string) => {
      applyTransform((selected) => ({
        text: selected ? text.replace(/\n$/, '') : text,
        cursorOffset: text.length,
      }));
    },
    [applyTransform],
  );

  const handleToc = () => {
    const toc = buildTocMarkdown(draft.body);
    if (toc) insertAtCursor(`${toc}\n`);
  };

  // -- image upload (toolbar / drag-drop / paste) ------------------------------

  const insertImageSyntax = useCallback(
    (fileName: string, imageId: string) => {
      insertAtCursor(`![${fileName}](${noteImageSrc(imageId)})\n`);
    },
    [insertAtCursor],
  );

  const handleFiles = useCallback(
    async (files: Iterable<File>) => {
      setUploadError(null);
      for (const file of files) {
        if (file.size > MEMO_IMAGE_MAX_BYTES) {
          setUploadError(t('notes.imageTooLarge'));
          continue;
        }
        setUploading(true);
        try {
          const uploaded = await uploadNoteImage(note.id, file);
          insertImageSyntax(uploaded.fileName, uploaded.id);
        } catch (error) {
          setUploadError(error instanceof ApiError ? error.errorCode : 'UNKNOWN');
        } finally {
          setUploading(false);
        }
      }
    },
    [note.id, insertImageSyntax, t],
  );

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files);
    if (files.length) {
      event.preventDefault();
      void handleFiles(files);
    }
  };

  // -- textarea keys -----------------------------------------------------------

  const onBodyKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const area = bodyRef.current;
    if (!area) return;
    if (event.key === 'Tab') {
      event.preventDefault();
      applyTransform(() => ({ text: '  ', cursorOffset: 2 }));
      return;
    }
    if (!prefs.autocomplete || event.key !== 'Enter' || event.shiftKey) return;
    const pos = area.selectionStart;
    if (pos !== area.selectionEnd) return;
    const before = draft.body.slice(0, pos);
    const lineStart = before.lastIndexOf('\n') + 1;
    const line = before.slice(lineStart);
    if (EMPTY_LIST_ITEM_RE.test(line)) {
      // Empty item: strip the marker, caret back to a plain new line.
      event.preventDefault();
      const next = `${draft.body.slice(0, lineStart)}\n${draft.body.slice(pos)}`;
      onDraftChange({ ...draft, body: next });
      requestAnimationFrame(() => {
        area.focus();
        area.setSelectionRange(lineStart + 1, lineStart + 1);
      });
      return;
    }
    const continuation = listContinuation(line, pos - lineStart);
    if (continuation) {
      event.preventDefault();
      const next = before + continuation + draft.body.slice(pos);
      onDraftChange({ ...draft, body: next });
      requestAnimationFrame(() => {
        area.focus();
        area.setSelectionRange(pos + continuation.length, pos + continuation.length);
      });
    }
  };

  // -- split pane dragging -----------------------------------------------------

  const startDrag = (event: React.MouseEvent) => {
    event.preventDefault();
    const canvas = (event.target as HTMLElement).closest('.note-editor__canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const onMove = (move: MouseEvent) => {
      const pct = ((move.clientX - rect.left) / rect.width) * 100;
      setSplitRatio(Math.min(80, Math.max(20, pct)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const syncPreviewScroll = () => {
    if (!prefs.syncScroll) return;
    const area = bodyRef.current;
    const preview = previewRef.current;
    if (!area || !preview) return;
    const maxSource = area.scrollHeight - area.clientHeight;
    const maxPreview = preview.scrollHeight - preview.clientHeight;
    if (maxSource > 0) preview.scrollTop = (area.scrollTop / maxSource) * maxPreview;
  };

  // -- render pieces ------------------------------------------------------------

  const autosaveLabel =
    saveState === 'saving'
      ? t('notes.editor.backingUp')
      : saveState === 'saved'
        ? t('notes.editor.backedUp')
        : t('notes.editor.unsaved');

  const sourcePane = (
    <textarea
      ref={bodyRef}
      className="note-editor__source"
      value={draft.body}
      wrap={prefs.wordWrap ? 'soft' : 'off'}
      placeholder={t('notes.bodyPlaceholder')}
      onChange={(event) => onDraftChange({ ...draft, body: event.target.value })}
      onKeyDown={onBodyKeyDown}
      onPaste={onPaste}
      onScroll={syncPreviewScroll}
      aria-label={t('notes.bodyPlaceholder')}
    />
  );

  const previewPane = (
    <div ref={previewRef} className="note-editor__preview" data-testid="preview">
      <MarkdownPreview body={draft.body} allNotes={allNotes} math={prefs.math} onOpenNote={onOpenNote} />
    </div>
  );

  const toolButton = (
    label: string,
    onClick: () => void,
    icon: React.ReactNode,
    active = false,
  ) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={active ? 'note-editor__tool note-editor__tool--active' : 'note-editor__tool'}
      onClick={onClick}
    >
      {icon}
    </button>
  );

  const linkableNotes = allNotes.filter((n) => n.id !== note.id);

  return (
    <div className={fullscreen ? 'note-editor note-editor--fullscreen' : 'note-editor'} data-note-id={note.id}>
      {/* 1. hint row: editor-mode dropdown + autosave status (right-aligned) */}
      <div className="note-editor__hint">
        <span className="note-editor__hint-text">{t('notes.editor.hint')}</span>
        <div className="note-editor__hint-actions">
          <Select
            className="note-editor__mode"
            value="markdown"
            aria-label={t('notes.editor.mode')}
            onChange={() => undefined}
          >
            <option value="markdown">{t('notes.editor.modeMarkdown')}</option>
          </Select>
          <button
            type="button"
            data-testid="save-state"
            className={`note-editor__savestate note-editor__savestate--${saveState}`}
            onClick={saveState === 'failed' || saveState === 'conflict' ? onRetry : undefined}
            title={saveState === 'failed' || saveState === 'conflict' ? t('notes.editor.retryBackup') : undefined}
          >
            <span className="note-editor__savestate-dot" aria-hidden />
            {autosaveLabel}
          </button>
        </div>
      </div>

      {/* 2+3. tabs and the compact icon toolbar */}
      <div className="note-editor__bar">
        <div className="note-editor__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'edit'}
            className={tab === 'edit' ? 'note-editor__tab note-editor__tab--active' : 'note-editor__tab'}
            onClick={() => setTab('edit')}
          >
            {t('notes.editor.tabEdit')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'preview'}
            className={tab === 'preview' ? 'note-editor__tab note-editor__tab--active' : 'note-editor__tab'}
            onClick={() => setTab('preview')}
          >
            {t('notes.editor.tabPreview')}
          </button>
        </div>
        <div className="note-editor__tools">
          {toolButton(t('notes.tool.bold'), () => applyTransform(boldTransform), <IconBold />)}
          {toolButton(t('notes.tool.link'), () => applyTransform(linkTransform), <IconLink />)}
          {toolButton(t('notes.tool.inlineCode'), () => applyTransform(inlineCodeTransform), <IconInlineCode />)}
          {toolButton(t('notes.tool.codeBlock'), () => applyTransform(codeBlockTransform), <IconCodeBlock />)}
          {toolButton(t('notes.tool.table'), () => applyTransform(tableTransform), <IconTable />)}
          {toolButton(t('notes.tool.ul'), () => applyTransform(unorderedListTransform), <IconListUl />)}
          {toolButton(t('notes.tool.ol'), () => applyTransform(orderedListTransform), <IconListOl />)}
          {toolButton(t('notes.tool.quote'), () => applyTransform(quoteTransform), <IconQuote />)}
          {toolButton(t('notes.tool.taskList'), () => applyTransform(taskListTransform), <IconTaskList />)}
          {toolButton(t('notes.tool.tex'), () => applyTransform(texTransform), <IconTex />)}
          {toolButton(t('notes.tool.toc'), handleToc, <IconToc />)}
          {toolButton(t('notes.tool.save'), onSave, <IconSave />)}
          {toolButton(t('notes.tool.reading'), () => setReading(true), <IconBook />)}
          {toolButton(t('notes.tool.fullscreen'), () => setFullscreen((f) => !f), <IconFullscreen />, fullscreen)}
          {toolButton(
            uploading ? t('notes.imageUploading') : t('notes.tool.uploadImage'),
            () => fileInputRef.current?.click(),
            <IconImage />,
          )}
          {toolButton(
            t('notes.tool.split'),
            () => setPrefs({ ...prefs, split: !prefs.split }),
            <IconSplit />,
            prefs.split,
          )}
          <span className="note-editor__tools-divider" aria-hidden />
          {toolButton(
            t('notes.tool.backlinks'),
            () => setPanel(panel === 'backlinks' ? 'none' : 'backlinks'),
            <IconBacklinks />,
            panel === 'backlinks',
          )}
          {toolButton(
            t('notes.tool.versions'),
            () => setPanel(panel === 'versions' ? 'none' : 'versions'),
            <IconHistory />,
            panel === 'versions',
          )}
          {toolButton(
            t('notes.tool.images'),
            () => setPanel(panel === 'images' ? 'none' : 'images'),
            <IconImage />,
            panel === 'images',
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="note-editor__file"
            aria-label={t('notes.tool.uploadImage')}
            onChange={(event) => {
              if (event.target.files) void handleFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </div>
      </div>

      {/* wiki-link insert picker (N2 D1) keeps working next to the tools */}
      <div className="note-editor__wikiselect">
        <Select
          value=""
          aria-label={t('notes.insertLink')}
          onChange={(event) => {
            if (event.target.value) insertAtCursor(`[[${event.target.value}]]`);
            event.target.value = '';
          }}
        >
          <option value="">{t('notes.insertLink')}</option>
          {linkableNotes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title}
            </option>
          ))}
        </Select>
      </div>

      {/* 4. canvas: single-column source/preview or draggable split */}
      <div
        className={[
          'note-editor__canvas',
          dragOver ? 'note-editor__canvas--dragover' : '',
          prefs.split ? 'note-editor__canvas--split' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepth.current += 1;
          setDragOver(true);
        }}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragOver(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setDragOver(false);
          if (event.dataTransfer.files.length) void handleFiles(event.dataTransfer.files);
        }}
      >
        {prefs.split ? (
          <>
            <div className="note-editor__pane" style={{ flexBasis: `${splitRatio}%` }}>
              {sourcePane}
            </div>
            <div
              className="note-editor__divider"
              role="separator"
              aria-orientation="vertical"
              aria-label={t('notes.tool.split')}
              onMouseDown={startDrag}
            />
            <div className="note-editor__pane note-editor__pane--grow">{previewPane}</div>
          </>
        ) : tab === 'edit' ? (
          sourcePane
        ) : (
          previewPane
        )}
        {dragOver && <div className="note-editor__dropmask">{t('notes.editor.dropHint')}</div>}

        {/* 5. lightweight toggles, canvas bottom-right */}
        <div className="note-editor__toggles">
          <label>
            <input
              type="checkbox"
              checked={prefs.math}
              onChange={(event) => setPrefs({ ...prefs, math: event.target.checked })}
            />
            <span>{t('notes.toggle.math')}</span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={prefs.wordWrap}
              onChange={(event) => setPrefs({ ...prefs, wordWrap: event.target.checked })}
            />
            <span>{t('notes.toggle.wordWrap')}</span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={prefs.autocomplete}
              onChange={(event) => setPrefs({ ...prefs, autocomplete: event.target.checked })}
            />
            <span>{t('notes.toggle.autocomplete')}</span>
          </label>
          {prefs.split && (
            <label>
              <input
                type="checkbox"
                checked={prefs.syncScroll}
                onChange={(event) => setPrefs({ ...prefs, syncScroll: event.target.checked })}
              />
              <span>{t('notes.toggle.syncScroll')}</span>
            </label>
          )}
        </div>
      </div>

      {uploadError && (
        <p className="note-editor__error" role="alert">
          {t([`error.${uploadError}`, 'error.UNKNOWN'])}
        </p>
      )}

      {/* publish form (title / category / tags / excerpt / advanced / actions) */}
      <PublishForm
        draft={draft}
        categories={categories}
        busy={publishing}
        onDraftChange={onDraftChange}
        onPublishAction={onPublishAction}
      />

      <div className="note-editor__footer">
        <span className="note-editor__updated">
          {t('notes.updatedAt', {
            when: new Date(note.updatedAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            }),
          })}
        </span>
        <Button
          size="sm"
          variant={confirmingDelete ? 'danger' : 'text'}
          onClick={onDelete}
        >
          {confirmingDelete ? t('notes.deleteConfirm') : t('common.delete')}
        </Button>
      </div>

      {(saveState === 'failed' || saveState === 'conflict') && (
        <div className="note-editor__conflict" role="alert">
          <p>{t(saveState === 'conflict' ? 'notes.conflict' : 'notes.saveFailed')}</p>
          <Button size="sm" onClick={onRetry}>
            {t('notes.retry')}
          </Button>
          <Button size="sm" onClick={onReload}>
            {t('notes.reload')}
          </Button>
        </div>
      )}

      {/* drawer panels: backlinks / versions / images */}
      {panel !== 'none' && (
        <aside className="note-editor__drawer" aria-label={t(`notes.tool.${panel}`)}>
          <div className="note-editor__drawer-head">
            <h3>{t(`notes.tool.${panel}`)}</h3>
            <Button size="sm" onClick={() => setPanel('none')} aria-label={t('common.close')}>
              ×
            </Button>
          </div>
          {panel === 'images' && <NoteImages noteId={note.id} />}
          {panel === 'backlinks' && (
            <div className="note-editor__panel" data-testid="backlinks-panel">
              {backlinks.length === 0 ? (
                <p className="note-editor__panel-empty">{t('notes.backlinksEmpty')}</p>
              ) : (
                backlinks.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className="note-editor__panel-item"
                    onClick={() => onOpenNote(b.id)}
                  >
                    {b.title}
                  </button>
                ))
              )}
            </div>
          )}
          {panel === 'versions' && (
            <div className="note-editor__panel" data-testid="versions-panel">
              {versions.length === 0 ? (
                <p className="note-editor__panel-empty">{t('notes.versionsEmpty')}</p>
              ) : (
                versions.map((v) => (
                  <div key={v.seq} className="note-editor__version">
                    <span className="note-editor__version-meta">
                      v{v.seq} ·{' '}
                      {new Date(v.createdAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                    <span className="note-editor__version-title">{v.title}</span>
                    <Button
                      size="sm"
                      variant={confirmingRestore === v.seq ? 'danger' : 'default'}
                      onClick={() => {
                        if (confirmingRestore !== v.seq) {
                          setConfirmingRestore(v.seq);
                          return;
                        }
                        setConfirmingRestore(null);
                        onRestoreVersion(v.seq);
                      }}
                    >
                      {confirmingRestore === v.seq ? t('notes.restoreConfirm') : t('notes.restore')}
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </aside>
      )}
      {/* immersive reading view (N3): rendered note with publish meta */}
      {reading && (
        <div className="note-reading" role="dialog" aria-label={t('notes.tool.reading')}>
          <div className="note-reading__head">
            <div className="note-reading__meta">
              <h1 className="note-reading__title">{draft.title}</h1>
              <div className="note-reading__sub">
                {draft.category && <span className="note-reading__chip">{draft.category}</span>}
                {draft.publishStatus === 'published' && (
                  <span className="note-reading__chip note-reading__chip--published">
                    {t('notes.pub.published')}
                  </span>
                )}
                {draft.publishStatus === 'scheduled' && draft.publishAt && (
                  <span className="note-reading__chip note-reading__chip--scheduled">
                    {t('notes.pub.scheduledAt', {
                      when: new Date(draft.publishAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }),
                    })}
                  </span>
                )}
                {draft.pinned && <span className="note-reading__chip">{t('notes.pub.pinned')}</span>}
                {draft.publishedAt && (
                  <time className="note-reading__time">
                    {new Date(draft.publishedAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </time>
                )}
              </div>
            </div>
            <Button size="sm" onClick={() => setReading(false)} aria-label={t('common.close')}>
              ×
            </Button>
          </div>
          <div className="note-reading__body">
            <MarkdownPreview body={draft.body} allNotes={allNotes} math={prefs.math} onOpenNote={onOpenNote} />
          </div>
        </div>
      )}
    </div>
  );
}
