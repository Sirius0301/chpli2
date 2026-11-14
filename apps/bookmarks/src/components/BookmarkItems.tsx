import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Chip } from '@chpli2/ui';
import type { BookmarkDto } from '@chpli2/shared';
import { bookmarkCoverUrl } from '../api';

interface BookmarkItemsProps {
  bookmarks: BookmarkDto[];
  view: 'card' | 'list';
  /** Inactive section: gray compact rows with title/categories/domain only. */
  compact?: boolean;
  onOpen: (bookmark: BookmarkDto) => void;
  onEdit: (bookmark: BookmarkDto) => void;
}

function CoverThumb({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    bookmarkCoverUrl(id)
      .then((u) => {
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        objectUrl = u;
        setUrl(u);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  return url ? <img className="bm-item__cover" src={url} alt="" /> : null;
}

/** Bookmarks rendered as cards or list rows (active or inactive sections). */
export default function BookmarkItems({ bookmarks, view, compact, onOpen, onEdit }: BookmarkItemsProps) {
  const { t, i18n } = useTranslation();

  const clickMeta = (bookmark: BookmarkDto) =>
    bookmark.clickCount === 0
      ? t('bm.neverClicked')
      : t('bm.lastClicked', {
          when: new Date(bookmark.lastClickedAt!).toLocaleString(i18n.language, {
            month: 'short',
            day: 'numeric',
          }),
        });

  if (compact) {
    return (
      <ul className="bm-compact" data-testid="inactive-list">
        {bookmarks.map((bookmark) => (
          <li key={bookmark.id} className="bm-compact__row">
            <button
              type="button"
              className="bm-compact__open"
              onClick={() => onOpen(bookmark)}
              title={bookmark.url}
            >
              {bookmark.title}
            </button>
            <span className="bm-compact__cats">{bookmark.categories.join(' · ')}</span>
            <span className="bm-compact__domain">{bookmark.domain}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={view === 'card' ? 'bm-grid' : 'bm-rows'}>
      {bookmarks.map((bookmark) => (
        <article
          key={bookmark.id}
          className={view === 'card' ? 'bm-card' : 'bm-row'}
          data-bookmark-id={bookmark.id}
        >
          {view === 'card' && bookmark.hasCover && <CoverThumb id={bookmark.id} />}
          <div className="bm-item__body">
            <button
              type="button"
              className="bm-item__title"
              onClick={() => onOpen(bookmark)}
              title={bookmark.url}
            >
              {bookmark.title}
            </button>
            <span className="bm-item__domain">{bookmark.domain}</span>
            {view === 'card' && bookmark.description && (
              <p className="bm-item__desc">{bookmark.description}</p>
            )}
            {bookmark.categories.length > 0 && (
              <span className="bm-item__cats">
                {bookmark.categories.map((cat) => (
                  <Chip key={cat}>{cat}</Chip>
                ))}
              </span>
            )}
            <span className="bm-item__meta">
              {t('bm.clickCount', { count: bookmark.clickCount })} · {clickMeta(bookmark)}
            </span>
          </div>
          <Button size="sm" className="bm-item__edit" onClick={() => onEdit(bookmark)}>
            {t('bm.edit')}
          </Button>
        </article>
      ))}
    </div>
  );
}
