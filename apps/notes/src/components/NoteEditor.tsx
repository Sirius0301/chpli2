import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Chip, Select } from '@chpli2/ui';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import type { Components } from 'react-markdown';
import type { NoteDto, NotePriority, NoteSummaryDto, NoteVersionDto } from '@chpli2/shared';
import { MEMO_PRIORITIES, MEMO_TAG_MAX_LENGTH, MEMO_TAGS_MAX_COUNT } from '@chpli2/shared';
import type { SaveState } from '../App';
import { preprocessWikiLinks, isWikiHref, noteIdFromWikiHref, WIKI_HREF_PREFIX } from '../wiki';
import NoteImages from './NoteImages';

interface NoteEditorProps {
  note: NoteDto;
  draft: { title: string; body: string; priority: NotePriority; tags: string[] };
  saveState: SaveState;
  confirmingDelete: boolean;
  /** Unfiltered user notes for wiki resolution and the insert picker. */
  allNotes: NoteSummaryDto[];
  backlinks: NoteSummaryDto[];
  onDraftChange: (draft: { title: string; body: string; priority: NotePriority; tags: string[] }) => void;
  onDelete: () => void;
  onRetry: () => void;
  onReload: () => void;
  onOpenNote: (id: string) => void;
  onLoadVersions: (noteId: string) => Promise<NoteVersionDto[]>;
  onRestoreVersion: (seq: number) => void;
}

/**
 * Markdown note editor (N1+N2): autosaved draft, safe preview with wiki
 * links (N2 D1/D8), backlinks panel, version history with restore-as-new-
 * revision (N2 D5) and image attachments (N2 D6).
 */
export default function NoteEditor({
  note,
  draft,
  saveState,
  confirmingDelete,
  allNotes,
  backlinks,
  onDraftChange,
  onDelete,
  onRetry,
  onReload,
  onOpenNote,
  onLoadVersions,
  onRestoreVersion,
}: NoteEditorProps) {
  const { t, i18n } = useTranslation();
  const [preview, setPreview] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);
  const [panel, setPanel] = useState<'none' | 'backlinks' | 'versions'>('none');
  const [versions, setVersions] = useState<NoteVersionDto[]>([]);
  const [confirmingRestore, setConfirmingRestore] = useState<number | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setPanel('none');
    setConfirmingRestore(null);
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

  const addTag = (raw: string) => {
    const tag = raw.trim();
    setTagInput('');
    if (!tag) return;
    if (tag.length > MEMO_TAG_MAX_LENGTH || draft.tags.length >= MEMO_TAGS_MAX_COUNT) {
      setTagError(t('notes.tagHint', { max: MEMO_TAGS_MAX_COUNT, length: MEMO_TAG_MAX_LENGTH }));
      return;
    }
    if (draft.tags.includes(tag)) return;
    setTagError(null);
    onDraftChange({ ...draft, tags: [...draft.tags, tag] });
  };

  const onTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag(tagInput);
    } else if (event.key === 'Backspace' && !tagInput && draft.tags.length) {
      onDraftChange({ ...draft, tags: draft.tags.slice(0, -1) });
    }
  };

  /** Inserts [[id]] at the cursor (N2 D1). */
  const insertLink = (id: string) => {
    const token = `[[${id}]]`;
    const area = bodyRef.current;
    const next = area
      ? draft.body.slice(0, area.selectionStart) + token + draft.body.slice(area.selectionEnd)
      : `${draft.body}${token}`;
    onDraftChange({ ...draft, body: next });
    if (area) {
      const pos = area.selectionStart + token.length;
      requestAnimationFrame(() => {
        area.focus();
        area.setSelectionRange(pos, pos);
      });
    }
  };

  const wikiComponents: Components = {
    a: ({ href, children }) => {
      if (isWikiHref(href)) {
        const id = noteIdFromWikiHref(href!);
        const resolved = allNotes.some((n) => n.id === id);
        if (!resolved) {
          return (
            <span className="wiki-link wiki-link--broken" title={t('notes.brokenLink')}>
              {children}
            </span>
          );
        }
        return (
          <button
            type="button"
            className="wiki-link"
            onClick={() => onOpenNote(id)}
          >
            {children}
          </button>
        );
      }
      return <a href={href}>{children}</a>;
    },
  };

  const { markdown } = preprocessWikiLinks(draft.body, allNotes);
  const linkableNotes = allNotes.filter((n) => n.id !== note.id);

  // Wiki hrefs are internal; everything else keeps react-markdown's default
  // URL sanitising (no javascript: etc.).
  const urlTransform = (url: string) =>
    url.startsWith(WIKI_HREF_PREFIX) ? url : defaultUrlTransform(url);

  return (
    <div className="note-editor" data-note-id={note.id}>
      <div className="note-editor__toolbar">
        <Button
          size="sm"
          variant={preview ? 'default' : 'primary'}
          onClick={() => setPreview(false)}
        >
          {t('notes.edit')}
        </Button>
        <Button
          size="sm"
          variant={preview ? 'primary' : 'default'}
          onClick={() => setPreview(true)}
        >
          {t('notes.preview')}
        </Button>
        <Select
          className="note-editor__linkselect"
          value=""
          aria-label={t('notes.insertLink')}
          onChange={(event) => {
            if (event.target.value) insertLink(event.target.value);
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
        <Button
          size="sm"
          variant={panel === 'backlinks' ? 'primary' : 'default'}
          onClick={() => setPanel(panel === 'backlinks' ? 'none' : 'backlinks')}
        >
          {t('notes.backlinks')} ({backlinks.length})
        </Button>
        <Button
          size="sm"
          variant={panel === 'versions' ? 'primary' : 'default'}
          onClick={() => setPanel(panel === 'versions' ? 'none' : 'versions')}
        >
          {t('notes.history')}
        </Button>
        <span className={`note-editor__save note-editor__save--${saveState}`} data-testid="save-state">
          {saveState === 'saving' && t('notes.saveState.saving')}
          {saveState === 'saved' && t('notes.saveState.saved')}
          {saveState === 'failed' && (
            <>
              {t('notes.saveState.failed')}{' '}
              <Button size="sm" onClick={onRetry}>
                {t('notes.saveState.retry')}
              </Button>
            </>
          )}
          {saveState === 'conflict' && (
            <>
              {t('notes.conflict')}{' '}
              <Button size="sm" onClick={onReload}>
                {t('common.retry')}
              </Button>
            </>
          )}
        </span>
        <span className="note-editor__spacer" />
        <Button
          size="sm"
          variant={confirmingDelete ? 'danger' : 'default'}
          onClick={onDelete}
        >
          {confirmingDelete ? t('notes.deleteConfirm') : t('common.delete')}
        </Button>
      </div>

      {panel === 'backlinks' && (
        <div className="note-editor__panel" data-testid="backlinks-panel">
          <h3>{t('notes.backlinks')}</h3>
          {backlinks.length === 0 ? (
            <p className="note-editor__panel-empty">{t('notes.backlinksEmpty')}</p>
          ) : (
            backlinks.map((link) => (
              <button
                key={link.id}
                type="button"
                className="note-editor__panel-item"
                onClick={() => onOpenNote(link.id)}
              >
                {link.title}
              </button>
            ))
          )}
        </div>
      )}

      {panel === 'versions' && (
        <div className="note-editor__panel" data-testid="versions-panel">
          <h3>{t('notes.history')}</h3>
          {versions.map((version) => (
            <div key={version.seq} className="note-editor__version">
              <span className="note-editor__version-meta">
                v{version.seq} · {version.title} ·{' '}
                {new Date(version.createdAt).toLocaleString(i18n.language, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
              <Button
                size="sm"
                variant={confirmingRestore === version.seq ? 'danger' : 'default'}
                onClick={() => {
                  if (confirmingRestore === version.seq) {
                    setConfirmingRestore(null);
                    onRestoreVersion(version.seq);
                  } else {
                    setConfirmingRestore(version.seq);
                  }
                }}
              >
                {confirmingRestore === version.seq
                  ? t('notes.restoreConfirm')
                  : t('notes.restore')}
              </Button>
            </div>
          ))}
        </div>
      )}

      <input
        type="text"
        className="note-editor__title"
        placeholder={t('notes.titlePlaceholder')}
        value={draft.title}
        maxLength={256}
        onChange={(event) => onDraftChange({ ...draft, title: event.target.value })}
      />

      <div className="note-editor__meta">
        <label>
          <span>{t('notes.priorityLabel')}</span>
          <Select
            value={draft.priority}
            onChange={(event) =>
              onDraftChange({ ...draft, priority: event.target.value as NotePriority })
            }
          >
            {MEMO_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {t(`notes.priority.${p}`)}
              </option>
            ))}
          </Select>
        </label>
        <span className="note-editor__updated">
          {t('notes.updatedAt', {
            when: new Date(note.updatedAt).toLocaleString(i18n.language, {
              dateStyle: 'medium',
              timeStyle: 'short',
            }),
          })}
        </span>
      </div>

      <div className="note-editor__tags">
        {draft.tags.map((tag) => (
          <Chip
            key={tag}
            onRemove={() =>
              onDraftChange({ ...draft, tags: draft.tags.filter((x) => x !== tag) })
            }
            removeLabel={t('notes.tagRemove', { tag })}
          >
            {tag}
          </Chip>
        ))}
        <input
          type="text"
          value={tagInput}
          maxLength={MEMO_TAG_MAX_LENGTH + 1}
          placeholder={t('notes.tagInputPlaceholder')}
          onChange={(event) => setTagInput(event.target.value)}
          onKeyDown={onTagKeyDown}
          onBlur={() => addTag(tagInput)}
        />
      </div>
      {tagError && (
        <p className="note-editor__error" role="alert">
          {tagError}
        </p>
      )}

      {preview ? (
        <div className="note-editor__preview markdown-body" data-testid="preview">
          <ReactMarkdown components={wikiComponents} urlTransform={urlTransform}>
            {markdown || '_…_'}
          </ReactMarkdown>
        </div>
      ) : (
        <textarea
          ref={bodyRef}
          className="note-editor__body"
          placeholder={t('notes.bodyPlaceholder')}
          value={draft.body}
          onChange={(event) => onDraftChange({ ...draft, body: event.target.value })}
        />
      )}

      <NoteImages noteId={note.id} />
    </div>
  );
}
