import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AddGoalLinkDto,
  BookmarkDto,
  CreateMilestoneDto,
  GoalDto,
  GoalStatus,
  NoteSummaryDto,
  UpdateMilestoneDto,
} from '@chpli2/shared';
import { GOAL_STATUSES } from '@chpli2/shared';
import { listBookmarkCandidates, listNoteCandidates } from '../api';

/** sessionStorage mailbox key consumed by the target remotes on mount (G1 D6). */
export const PENDING_OPEN_KEY = 'chpli2-pending-open';

interface GoalDetailProps {
  goal: GoalDto;
  onChanged: (goal: GoalDto) => void;
  onEdit: () => void;
  onStatusChange: (status: GoalStatus) => Promise<void>;
  addMilestone: (goalId: string, body: CreateMilestoneDto) => Promise<GoalDto>;
  updateMilestone: (goalId: string, milestoneId: string, body: UpdateMilestoneDto) => Promise<GoalDto>;
  removeMilestone: (goalId: string, milestoneId: string) => Promise<GoalDto>;
  addLink: (goalId: string, body: AddGoalLinkDto) => Promise<GoalDto>;
  removeLink: (goalId: string, linkId: string) => Promise<GoalDto>;
}

/** Asks the Host shell to switch to another module (G1 D6). */
function navigateTo(view: 'notes' | 'bookmarks' | 'calendar') {
  window.dispatchEvent(new CustomEvent('chpli2-navigate', { detail: { view } }));
}

export default function GoalDetail({
  goal,
  onChanged,
  onEdit,
  onStatusChange,
  addMilestone,
  updateMilestone,
  removeMilestone,
  addLink,
  removeLink,
}: GoalDetailProps) {
  const { t } = useTranslation();
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDate, setMilestoneDate] = useState('');
  const [confirmingMilestone, setConfirmingMilestone] = useState<string | null>(null);
  const [notes, setNotes] = useState<NoteSummaryDto[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** Optimistic milestone toggles so the checkbox never snaps back. */
  const [toggling, setToggling] = useState<Record<string, boolean>>({});
  /**
   * Last-write-wins guard: rapid successive mutations must not let a stale
   * response overwrite a fresher one (same fix family as the Notes 409 race).
   */
  const requestSeq = useRef(0);
  const applyLatest = async (request: () => Promise<GoalDto>): Promise<void> => {
    const seq = (requestSeq.current += 1);
    const updated = await request();
    if (seq === requestSeq.current) onChanged(updated);
  };

  useEffect(() => {
    setError(null);
    setConfirmingMilestone(null);
  }, [goal.id]);

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

  const handleStatus = async (status: GoalStatus) => {
    try {
      await onStatusChange(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAddMilestone = async () => {
    if (!milestoneTitle.trim()) return;
    await applyLatest(() =>
      addMilestone(goal.id, {
        id: crypto.randomUUID(),
        title: milestoneTitle.trim(),
        date: milestoneDate || null,
      }),
    );
    setMilestoneTitle('');
    setMilestoneDate('');
  };

  const handleToggleMilestone = async (milestoneId: string, done: boolean) => {
    setToggling((prev) => ({ ...prev, [milestoneId]: done }));
    try {
      await applyLatest(() =>
        updateMilestone(goal.id, milestoneId, {
          status: done ? 'done' : 'open',
        }),
      );
    } finally {
      setToggling((prev) => {
        const next = { ...prev };
        delete next[milestoneId];
        return next;
      });
    }
  };

  const handleRemoveMilestone = async (milestoneId: string) => {
    if (confirmingMilestone !== milestoneId) {
      setConfirmingMilestone(milestoneId);
      return;
    }
    setConfirmingMilestone(null);
    await applyLatest(() => removeMilestone(goal.id, milestoneId));
  };

  const handleAddLink = async (body: AddGoalLinkDto) => {
    setError(null);
    try {
      await applyLatest(() => addLink(goal.id, body));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleOpenLink = (module: 'notes' | 'bookmarks' | 'memos', refId: string) => {
    try {
      sessionStorage.setItem(PENDING_OPEN_KEY, JSON.stringify({ module, id: refId }));
    } catch {
      /* mailbox unavailable: navigation still works */
    }
    navigateTo(module === 'memos' ? 'calendar' : module);
  };

  const linkedIds = new Set(goal.links.map((l) => `${l.module}:${l.refId}`));
  const noteOptions = notes.filter((n) => !linkedIds.has(`notes:${n.id}`));
  const bookmarkOptions = bookmarks.filter((b) => !linkedIds.has(`bookmarks:${b.id}`));

  return (
    <div className="goal-detail" data-goal-id={goal.id}>
      <div className="goal-detail__head">
        <h2>{goal.title}</h2>
        <label className="goal-detail__status">
          <span>{t('goal.statusLabel')}</span>
          <select value={goal.status} onChange={(event) => void handleStatus(event.target.value as GoalStatus)}>
            {GOAL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`goal.status.${status}`)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="button" onClick={onEdit}>
          {t('common.save')}
        </button>
      </div>

      {goal.description && <p className="goal-detail__desc">{goal.description}</p>}
      <p className="goal-detail__meta">
        {goal.targetDate && <span>{t('goal.targetDate')}: {goal.targetDate}</span>}
        <span>{t('goal.progress', { percent: goal.progress })}</span>
      </p>
      <div className="goal-progress" role="progressbar" aria-valuenow={goal.progress}>
        <span className="goal-progress__bar" style={{ width: `${goal.progress}%` }} data-testid="progress-bar" />
      </div>

      {error && (
        <p className="goal-detail__error" role="alert">
          {error}
        </p>
      )}

      <section className="goal-section">
        <h3>{t('goal.milestones')}</h3>
        <ul className="goal-milestones">
          {goal.milestones.map((milestone) => (
            <li key={milestone.id} className="goal-milestone" data-milestone-id={milestone.id}>
              <input
                type="checkbox"
                checked={toggling[milestone.id] ?? milestone.status === 'done'}
                onChange={(event) => void handleToggleMilestone(milestone.id, event.target.checked)}
                aria-label={milestone.title}
              />
              <span className={milestone.status === 'done' ? 'goal-milestone__title goal-milestone__title--done' : 'goal-milestone__title'}>
                {milestone.title}
              </span>
              {milestone.date && <span className="goal-milestone__date">{milestone.date}</span>}
              <button
                type="button"
                className={
                  confirmingMilestone === milestone.id ? 'button button--danger' : 'button'
                }
                onClick={() => void handleRemoveMilestone(milestone.id)}
              >
                {confirmingMilestone === milestone.id
                  ? t('goal.milestone.deleteConfirm')
                  : t('common.delete')}
              </button>
            </li>
          ))}
        </ul>
        <div className="goal-milestone__add">
          <input
            type="text"
            value={milestoneTitle}
            maxLength={256}
            placeholder={t('goal.milestone.titlePlaceholder')}
            onChange={(event) => setMilestoneTitle(event.target.value)}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Enter') void handleAddMilestone();
            }}
          />
          <input
            type="date"
            value={milestoneDate}
            aria-label={t('goal.milestone.date')}
            onChange={(event) => setMilestoneDate(event.target.value)}
          />
          <button type="button" className="button" onClick={() => void handleAddMilestone()}>
            {t('goal.milestone.add')}
          </button>
        </div>
      </section>

      <section className="goal-section">
        <h3>{t('goal.links')} ({goal.links.length})</h3>
        {goal.links.length === 0 && <p className="goal-detail__empty">{t('goal.links.empty')}</p>}
        <ul className="goal-links">
          {goal.links.map((link) => (
            <li key={link.id} className="goal-link" data-link-id={link.id}>
              <span className="goal-link__module">{t(`goal.links.module.${link.module}`)}</span>
              <span className="goal-link__title">{link.title}</span>
              <button
                type="button"
                className="button"
                onClick={() => handleOpenLink(link.module, link.refId)}
              >
                {t('goal.links.open')}
              </button>
              <button
                type="button"
                className="button"
                onClick={() => {
                  void applyLatest(() => removeLink(goal.id, link.id));
                }}
              >
                {t('goal.links.remove')}
              </button>
            </li>
          ))}
        </ul>
        <div className="goal-link__add">
          <select
            value=""
            aria-label={t('goal.links.addNote')}
            onChange={(event) => {
              if (event.target.value) {
                void handleAddLink({ module: 'notes', refId: event.target.value });
              }
              event.target.value = '';
            }}
          >
            <option value="">{t('goal.links.addNote')}</option>
            {noteOptions.map((note) => (
              <option key={note.id} value={note.id}>
                {note.title}
              </option>
            ))}
          </select>
          <select
            value=""
            aria-label={t('goal.links.addBookmark')}
            onChange={(event) => {
              if (event.target.value) {
                void handleAddLink({ module: 'bookmarks', refId: event.target.value });
              }
              event.target.value = '';
            }}
          >
            <option value="">{t('goal.links.addBookmark')}</option>
            {bookmarkOptions.map((bookmark) => (
              <option key={bookmark.id} value={bookmark.id}>
                {bookmark.title}
              </option>
            ))}
          </select>
        </div>
      </section>
    </div>
  );
}
