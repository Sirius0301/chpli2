import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, OverflowTooltip } from '@chpli2/ui';
import { authFetchHeaders } from '@chpli2/shared';
import type { NoteHomeCardDto } from '@chpli2/shared';

const PAGE_SIZE = 6;

/**
 * 首页笔记卡片区（N3 首页展示）：published 且勾选"首页展示"的笔记，
 * 置顶优先、最多 10 张，横向滚动。点击卡片经 sessionStorage 信箱 +
 * `chpli2-navigate` 事件深链接到 notes remote 的阅读视图（机制同 G2）。
 */
export default function HomeNotes() {
  const { t, i18n } = useTranslation();
  const [cards, setCards] = useState<NoteHomeCardDto[] | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/notes/home', { headers: authFetchHeaders() })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: NoteHomeCardDto[]) => {
        if (!cancelled) setCards(rows);
      })
      .catch(() => {
        if (!cancelled) setCards([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!cards?.length) return null;

  const openNote = (id: string) => {
    sessionStorage.setItem(
      'chpli2-pending-open',
      JSON.stringify({ module: 'notes', id, mode: 'reading' }),
    );
    window.dispatchEvent(new CustomEvent('chpli2-navigate', { detail: { view: 'notes' } }));
  };

  return (
    <div className="home__section" data-testid="home-notes">
      <h2 className="home__section-title">{t('home.notesTitle')}</h2>
      <div className="home__note-grid">
        {cards.slice(0, visible).map((card) => (
          <button
            type="button"
            key={card.id}
            className="home__note-card"
            onClick={() => openNote(card.id)}
          >
            <OverflowTooltip text={card.title} className="home__note-title" />
            {card.excerpt && <span className="home__note-excerpt">{card.excerpt}</span>}
            <span className="home__note-meta">
              {card.category && <span className="home__note-chip">{card.category}</span>}
              <time>
                {new Date(card.publishedAt).toLocaleDateString(i18n.language, {
                  dateStyle: 'medium',
                })}
              </time>
            </span>
          </button>
        ))}
      </div>
      {cards.length > visible && (
        <div>
          <Button size="sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            {t('home.loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
