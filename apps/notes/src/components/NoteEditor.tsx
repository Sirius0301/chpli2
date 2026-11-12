import { useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import type { NoteDto, NotePriority } from '@chpli2/shared';
import { MEMO_PRIORITIES, MEMO_TAG_MAX_LENGTH, MEMO_TAGS_MAX_COUNT } from '@chpli2/shared';
import type { SaveState } from '../App';

interface NoteEditorProps {
  note: NoteDto;
  draft: { title: string; body: string; priority: NotePriority; tags: string[] };
  saveState: SaveState;
  confirmingDelete: boolean;
  onDraftChange: (draft: { title: string; body: string; priority: NotePriority; tags: string[] }) => void;
  onDelete: () => void;
  onRetry: () => void;
  onReload: () => void;
}

/**
 * Markdown note editor (N1): autosaved draft fields, safe preview
 * (react-markdown escapes raw HTML, N1 D3) and two-step delete.
 */
export default function NoteEditor({
  note,
  draft,
  saveState,
  confirmingDelete,
  onDraftChange,
  onDelete,
  onRetry,
  onReload,
}: NoteEditorProps) {
  const { t, i18n } = useTranslation();
  const [preview, setPreview] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);

  const addTag = (raw: string) => {
    const tag = raw.trim();
    setTagInput('');
    if (!tag) return;
    if (tag.length > MEMO_TAG_MAX_LENGTH) {
      setTagError(t('notes.tagHint', { max: MEMO_TAGS_MAX_COUNT, length: MEMO_TAG_MAX_LENGTH }));
      return;
    }
    if (draft.tags.includes(tag)) return;
    if (draft.tags.length >= MEMO_TAGS_MAX_COUNT) {
      setTagError(t('notes.tagHint', { max: MEMO_TAGS_MAX_COUNT, length: MEMO_TAG_MAX_LENGTH }));
      return;
    }
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

  return (
    <div className="note-editor" data-note-id={note.id}>
      <div className="note-editor__toolbar">
        <button
          type="button"
          className={preview ? 'button' : 'button button--active'}
          onClick={() => setPreview(false)}
        >
          {t('notes.edit')}
        </button>
        <button
          type="button"
          className={preview ? 'button button--active' : 'button'}
          onClick={() => setPreview(true)}
        >
          {t('notes.preview')}
        </button>
        <span className={`note-editor__save note-editor__save--${saveState}`} data-testid="save-state">
          {saveState === 'saving' && t('notes.saveState.saving')}
          {saveState === 'saved' && t('notes.saveState.saved')}
          {saveState === 'failed' && (
            <>
              {t('notes.saveState.failed')}{' '}
              <button type="button" className="button" onClick={onRetry}>
                {t('notes.saveState.retry')}
              </button>
            </>
          )}
          {saveState === 'conflict' && (
            <>
              {t('notes.conflict')}{' '}
              <button type="button" className="button" onClick={onReload}>
                {t('common.retry')}
              </button>
            </>
          )}
        </span>
        <span className="note-editor__spacer" />
        <button
          type="button"
          className={confirmingDelete ? 'button button--danger' : 'button'}
          onClick={onDelete}
        >
          {confirmingDelete ? t('notes.deleteConfirm') : t('common.delete')}
        </button>
      </div>

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
          <select
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
          </select>
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
          <span key={tag} className="tag-chip">
            {tag}
            <button
              type="button"
              className="tag-chip__remove"
              aria-label={t('notes.tagRemove', { tag })}
              onClick={() => onDraftChange({ ...draft, tags: draft.tags.filter((x) => x !== tag) })}
            >
              ×
            </button>
          </span>
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
          <ReactMarkdown>{draft.body || '_…_'}</ReactMarkdown>
        </div>
      ) : (
        <textarea
          className="note-editor__body"
          placeholder={t('notes.bodyPlaceholder')}
          value={draft.body}
          onChange={(event) => onDraftChange({ ...draft, body: event.target.value })}
        />
      )}
    </div>
  );
}
