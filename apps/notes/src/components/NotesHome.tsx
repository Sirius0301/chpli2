import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@chpli2/ui';
import type { NoteDto } from '@chpli2/shared';
import { noteExcerpt } from '@chpli2/shared';

const PAGE_SIZE = 20;

interface NotesHomeProps {
  /** All of the user's notes (unfiltered), any order — sorted here. */
  notes: NoteDto[];
  onOpen: (note: NoteDto) => void;
}

/**
 * 笔记模块首页（N3）：未选中笔记时的浏览门面。顶部固定置顶栏（无置顶
 * 则不渲染），下方全部笔记卡片网格 + 加载更多；卡片点击进入编辑视图。
 */
export default function NotesHome({ notes, onOpen }: NotesHomeProps) {
  const { t, i18n } = useTranslation();
  const [visible, setVisible] = useState(PAGE_SIZE);

  const { pinned, rest } = useMemo(() => {
    const byUpdated = [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return {
      pinned: byUpdated.filter((n) => n.pinned),
      rest: byUpdated.filter((n) => !n.pinned),
    };
  }, [notes]);

  if (notes.length === 0) {
    return <p className="notes-home__empty">{t('notes.home.empty')}</p>;
  }

  const card = (note: NoteDto) => (
    <button
      type="button"
      key={note.id}
      className="notes-home__card"
      onClick={() => onOpen(note)}
    >
      <span className="notes-home__card-title">{note.title}</span>
      <span className="notes-home__card-excerpt">{noteExcerpt(note.body, 80) || '—'}</span>
      <span className="notes-home__card-meta">
        {note.category && <span className="notes-home__chip">{note.category}</span>}
        {note.publishStatus !== 'draft' && (
          <span className={`notes-list__status notes-list__status--${note.publishStatus}`}>
            {t(`notes.filter.status.${note.publishStatus}`)}
          </span>
        )}
        <time>
          {new Date(note.updatedAt).toLocaleString(i18n.language, {
            month: 'short',
            day: 'numeric',
          })}
        </time>
      </span>
    </button>
  );

  return (
    <div className="notes-home" data-testid="notes-home">
      {pinned.length > 0 && (
        <section className="notes-home__section">
          <h3 className="notes-home__heading">{t('notes.home.pinned')}</h3>
          <div className="notes-home__row">{pinned.map(card)}</div>
        </section>
      )}
      <section className="notes-home__section">
        <h3 className="notes-home__heading">{t('notes.home.all')}</h3>
        <div className="notes-home__grid">{rest.slice(0, visible).map(card)}</div>
        {rest.length > visible && (
          <Button size="sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            {t('notes.home.loadMore')}
          </Button>
        )}
      </section>
    </div>
  );
}
