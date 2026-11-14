import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GoalLinkDto, GoalLinkModule } from '@chpli2/shared';
import { listBookmarkCandidates, listNoteCandidates } from '../api';

interface LinkRowProps {
  owner: { links: GoalLinkDto[] };
  addLink: (body: { module: GoalLinkModule; refId: string }) => Promise<unknown>;
  removeLink: (linkId: string) => Promise<unknown>;
  noteLabel: string;
  bookmarkLabel: string;
  onOpen: (module: GoalLinkModule, refId: string) => void;
}

/** Shared link list + pickers (used by skills; goals keep their richer inline UI). */
export default function LinkRow({
  owner,
  addLink,
  removeLink,
  noteLabel,
  bookmarkLabel,
  onOpen,
}: LinkRowProps) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<{ id: string; title: string }[]>([]);
  const [bookmarks, setBookmarks] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listNoteCandidates(), listBookmarkCandidates()])
      .then(([n, b]) => {
        if (!cancelled) {
          setNotes(n);
          setBookmarks(b);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const linked = new Set(owner.links.map((l) => `${l.module}:${l.refId}`));

  return (
    <div className="goal-links-block">
      {owner.links.length > 0 && (
        <ul className="goal-links">
          {owner.links.map((link) => (
            <li key={link.id} className="goal-link" data-link-id={link.id}>
              <span className="goal-link__module">{t(`goal.links.module.${link.module}`)}</span>
              <span className="goal-link__title">{link.title}</span>
              <button type="button" className="button" onClick={() => onOpen(link.module, link.refId)}>
                {t('goal.links.open')}
              </button>
              <button type="button" className="button" onClick={() => void removeLink(link.id)}>
                {t('goal.links.remove')}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="goal-link__add">
        <select
          value=""
          aria-label={noteLabel}
          onChange={(event) => {
            if (event.target.value) void addLink({ module: 'notes', refId: event.target.value });
            event.target.value = '';
          }}
        >
          <option value="">{noteLabel}</option>
          {notes
            .filter((n) => !linked.has(`notes:${n.id}`))
            .map((note) => (
              <option key={note.id} value={note.id}>
                {note.title}
              </option>
            ))}
        </select>
        <select
          value=""
          aria-label={bookmarkLabel}
          onChange={(event) => {
            if (event.target.value) void addLink({ module: 'bookmarks', refId: event.target.value });
            event.target.value = '';
          }}
        >
          <option value="">{bookmarkLabel}</option>
          {bookmarks
            .filter((b) => !linked.has(`bookmarks:${b.id}`))
            .map((bookmark) => (
              <option key={bookmark.id} value={bookmark.id}>
                {bookmark.title}
              </option>
            ))}
        </select>
      </div>
    </div>
  );
}
