import { useEffect, useRef, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@chpli2/ui';
import type { NoteSummaryDto } from '@chpli2/shared';
import type { NoteDraft } from '../App';
import MarkdownPreview from './MarkdownPreview';

interface NoteReadingProps {
  draft: NoteDraft;
  allNotes: NoteSummaryDto[];
  math: boolean;
  onOpenNote: (id: string) => void;
  onClose: () => void;
}

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Immersive reading surface. Portals to document.body, locks page scroll,
 * keeps keyboard focus inside, and restores focus to the editor on close.
 * Rendered content is the same MarkdownPreview used by the editor.
 */
export default function NoteReading({
  draft,
  allNotes,
  math,
  onOpenNote,
  onClose,
}: NoteReadingProps) {
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    overlayRef.current?.querySelector<HTMLButtonElement>('button')?.focus();

    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);

  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !overlayRef.current) return;
    const nodes = Array.from(overlayRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (node) => !node.hasAttribute('disabled'),
    );
    if (nodes.length === 0) return;
    const first = nodes[0]!;
    const last = nodes[nodes.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      ref={overlayRef}
      className="note-reading"
      role="dialog"
      aria-modal="true"
      aria-label={t('notes.tool.reading')}
      onKeyDown={trapFocus}
    >
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
        <Button
          className="note-reading__close"
          size="sm"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          ×
        </Button>
      </div>
      <div className="note-reading__body">
        <MarkdownPreview body={draft.body} allNotes={allNotes} math={math} onOpenNote={onOpenNote} />
      </div>
    </div>,
    document.body,
  );
}
