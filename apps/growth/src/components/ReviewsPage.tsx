import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Select, Textarea } from '@chpli2/ui';
import type { GoalDto, ReviewDto } from '@chpli2/shared';
import {
  ApiError,
  addReviewLink,
  createReview,
  deleteReview,
  listMemoCandidates,
  listReviews,
  removeReviewLink,
  scheduleNextMemo,
  updateReview,
} from '../api';

function pad(v: number) {
  return String(v).padStart(2, '0');
}

function offsetKey(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface ReviewsPageProps {
  goals: GoalDto[];
}

export default function ReviewsPage({ goals }: ReviewsPageProps) {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState<ReviewDto[] | null>(null);
  const [memos, setMemos] = useState<{ id: string; title: string; date: string }[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Form state (single simple editor, not a panel-heavy flow).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [reviewedAt, setReviewedAt] = useState('');
  const [goalId, setGoalId] = useState('');
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [nextDate, setNextDate] = useState(offsetKey(7));

  const reload = useCallback(async () => {
    setReviews(await listReviews());
  }, []);

  useEffect(() => {
    Promise.all([
      listReviews(),
      // Memo candidates for the picker: a bounded window around today.
      listMemoCandidates(offsetKey(-30), offsetKey(366)),
    ])
      .then(([r, m]) => {
        setReviews(r);
        setMemos(m);
      })
      .catch((err) => setError(err instanceof ApiError ? err.errorCode : 'UNKNOWN'));
  }, []);

  const openNew = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setReviewedAt(offsetKey(0));
    setGoalId('');
    setEditorOpen(true);
  };

  const openEdit = (review: ReviewDto) => {
    setEditingId(review.id);
    setTitle(review.title);
    setContent(review.content ?? '');
    setReviewedAt(review.reviewedAt);
    setGoalId(review.goalId ?? '');
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    try {
      if (editingId) {
        const review = reviews?.find((r) => r.id === editingId);
        const updated = await updateReview(editingId, {
          title: title.trim(),
          content: content.trim(),
          reviewedAt,
          goalId: goalId || null,
          updatedAt: review?.updatedAt,
        });
        setReviews((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? prev);
      } else {
        const created = await createReview({
          id: crypto.randomUUID(),
          title: title.trim(),
          content: content.trim(),
          reviewedAt,
          goalId: goalId || null,
        });
        setReviews((prev) => [created, ...(prev ?? [])]);
      }
      setEditorOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.errorCode : 'UNKNOWN');
    }
  };

  const handleDelete = async (review: ReviewDto) => {
    await deleteReview(review.id);
    setReviews((prev) => (prev ?? []).filter((r) => r.id !== review.id));
  };

  const handleSchedule = async (review: ReviewDto) => {
    try {
      const updated = await scheduleNextMemo(review.id, { date: nextDate });
      setReviews((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? prev);
      setSchedulingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.errorCode : 'UNKNOWN');
    }
  };

  const handleOpenMemo = (memoId: string) => {
    try {
      sessionStorage.setItem('chpli2-pending-open', JSON.stringify({ module: 'memos', id: memoId }));
    } catch {
      /* mailbox unavailable */
    }
    window.dispatchEvent(new CustomEvent('chpli2-navigate', { detail: { view: 'calendar' } }));
  };

  if (reviews === null) {
    return <p className="loading">{t('common.loading')}</p>;
  }

  const linkedMemoIds = new Set(
    reviews.flatMap((r) => r.links.filter((l) => l.module === 'memos').map((l) => l.refId)),
  );

  return (
    <div className="growth-page" data-testid="reviews-page">
      <div className="growth-page__head">
        <h2>{t('review.title')}</h2>
        <Button variant="primary" onClick={openNew}>
          {t('review.new')}
        </Button>
      </div>
      {error && (
        <p className="growth-page__error" role="alert">
          {t([`error.${error}`, 'error.UNKNOWN'])}
        </p>
      )}

      {reviews.length === 0 && !editorOpen ? (
        <p className="growth-page__empty">{t('review.empty')}</p>
      ) : (
        <ul className="review-list">
          {reviews.map((review) => (
            <li key={review.id} className="review-card" data-review-id={review.id}>
              <div className="review-card__head">
                <span className="review-card__title">{review.title}</span>
                <span className="review-card__date">
                  {t('review.reviewedAt')}: {review.reviewedAt}
                </span>
                {review.goalTitle && <span className="review-card__goal">{review.goalTitle}</span>}
                <Button size="sm" onClick={() => openEdit(review)}>
                  {t('common.save')}
                </Button>
              </div>
              {review.content && <p className="review-card__content">{review.content}</p>}

              {review.nextMemoDate && (
                <Button
                  size="sm"
                  className="review-card__next"
                  onClick={() => review.nextMemoId && handleOpenMemo(review.nextMemoId)}
                >
                  {t('review.schedule.arranged', { date: review.nextMemoDate })}
                </Button>
              )}

              {review.links.length > 0 && (
                <ul className="goal-links">
                  {review.links.map((link) => (
                    <li key={link.id} className="goal-link" data-link-id={link.id}>
                      <span className="goal-link__module">{t(`goal.links.module.${link.module}`)}</span>
                      <span className="goal-link__title">{link.title}</span>
                      {link.module === 'memos' && (
                        <Button size="sm" onClick={() => handleOpenMemo(link.refId)}>
                          {t('goal.links.open')}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() =>
                          void removeReviewLink(review.id, link.id).then((updated) =>
                            setReviews((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? prev),
                          )
                        }
                      >
                        {t('goal.links.remove')}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="goal-link__add">
                <Select
                  value=""
                  aria-label={t('review.links.addMemo')}
                  onChange={(event) => {
                    if (event.target.value) {
                      void addReviewLink(review.id, { module: 'memos', refId: event.target.value }).then(
                        (updated) =>
                          setReviews((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? prev),
                      );
                    }
                    event.target.value = '';
                  }}
                >
                  <option value="">{t('review.links.addMemo')}</option>
                  {memos
                    .filter((m) => !linkedMemoIds.has(m.id))
                    .map((memo) => (
                      <option key={memo.id} value={memo.id}>
                        {memo.date} · {memo.title}
                      </option>
                    ))}
                </Select>
                {schedulingId === review.id ? (
                  <>
                    <Input
                      type="date"
                      value={nextDate}
                      min={offsetKey(0)}
                      aria-label={t('review.schedule.date')}
                      onChange={(event) => setNextDate(event.target.value)}
                    />
                    <Button size="sm" variant="primary" onClick={() => void handleSchedule(review)}>
                      {t('review.schedule')}
                    </Button>
                    <Button size="sm" onClick={() => setSchedulingId(null)}>
                      {t('common.cancel')}
                    </Button>
                  </>
                ) : (
                  !review.nextMemoDate && (
                    <Button size="sm" onClick={() => setSchedulingId(review.id)}>
                      {t('review.schedule')}
                    </Button>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editorOpen && (
        <div className="goal-editor-wrap">
          <div className="goal-editor-backdrop" onClick={() => setEditorOpen(false)} aria-hidden />
          <aside className="goal-editor" aria-label={t(editingId ? 'common.save' : 'review.new')}>
            <div className="goal-editor__header">
              <h3>{t(editingId ? 'common.save' : 'review.new')}</h3>
              <Button size="sm" onClick={() => setEditorOpen(false)} aria-label={t('common.close')}>
                ×
              </Button>
            </div>
            <label className="goal-editor__field">
              <span>{t('goal.titlePlaceholder')}</span>
              <Input type="text" value={title} maxLength={256} onChange={(e) => setTitle(e.target.value)} autoFocus />
            </label>
            <label className="goal-editor__field">
              <span>{t('review.contentPlaceholder')}</span>
              <Textarea value={content} rows={5} onChange={(e) => setContent(e.target.value)} />
            </label>
            <label className="goal-editor__field">
              <span>{t('review.reviewedAt')}</span>
              <Input type="date" value={reviewedAt} onChange={(e) => setReviewedAt(e.target.value)} />
            </label>
            <label className="goal-editor__field">
              <span>{t('review.goalLabel')}</span>
              <Select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
                <option value="">{t('skill.goal.none')}</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title}
                  </option>
                ))}
              </Select>
            </label>
            <div className="goal-editor__actions">
              <Button variant="primary" onClick={() => void handleSave()}>
                {t('common.save')}
              </Button>
              <Button onClick={() => setEditorOpen(false)}>
                {t('common.cancel')}
              </Button>
              {editingId && (
                <Button
                  variant="danger"
                  onClick={() => {
                    const review = reviews?.find((r) => r.id === editingId);
                    setEditorOpen(false);
                    if (review) void handleDelete(review);
                  }}
                >
                  {t('common.delete')}
                </Button>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
