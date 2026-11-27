import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Field, Input, Select, TagInput, Textarea } from '@chpli2/ui';
import { MEMO_PRIORITIES, MEMO_TAG_MAX_LENGTH, MEMO_TAGS_MAX_COUNT, NOTE_EXCERPT_MAX_LENGTH } from '@chpli2/shared';
import type { NoteDraft } from '../App';

export type PublishAction = 'draft' | 'publish' | 'scheduled';

interface PublishFormProps {
  draft: NoteDraft;
  /** Existing categories across the user's notes (dropdown candidates). */
  categories: string[];
  busy: boolean;
  onDraftChange: (draft: NoteDraft) => void;
  onPublishAction: (action: PublishAction, publishAt?: string) => void;
}

/**
 * Blog publish form under the editor canvas (N3, cnblog style): title,
 * category dropdown, tag capsules, excerpt and an advanced panel
 * (comments / pinned / access password / home display / priority), plus
 * the draft / scheduled / publish action buttons.
 */
export default function PublishForm({
  draft,
  categories,
  busy,
  onDraftChange,
  onPublishAction,
}: PublishFormProps) {
  const { t } = useTranslation();
  const [tagError, setTagError] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');

  const statusLabel = () => {
    if (draft.publishStatus === 'published') return t('notes.pub.published');
    if (draft.publishStatus === 'scheduled' && draft.publishAt) {
      return t('notes.pub.scheduledAt', {
        when: new Date(draft.publishAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
      });
    }
    return t('notes.pub.draft');
  };

  const confirmSchedule = () => {
    if (!scheduleAt) return;
    setScheduleOpen(false);
    onPublishAction('scheduled', new Date(scheduleAt).toISOString());
  };

  return (
    <div className="publish-form">
      <div className="publish-form__grid">
        <Field className="publish-form__field publish-form__field--title" label={t('notes.pub.title')}>
          <Input
            type="text"
            value={draft.title}
            maxLength={256}
            placeholder={t('notes.pub.titlePlaceholder')}
            onChange={(event) => onDraftChange({ ...draft, title: event.target.value })}
          />
        </Field>

        <Field className="publish-form__field" label={t('notes.pub.category')}>
          <Input
            type="text"
            list="note-category-list"
            value={draft.category ?? ''}
            maxLength={32}
            placeholder={t('notes.pub.categoryPlaceholder')}
            onChange={(event) => onDraftChange({ ...draft, category: event.target.value || null })}
          />
          <datalist id="note-category-list">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>

        <Field
          className="publish-form__field publish-form__field--tags"
          label={t('notes.pub.tags')}
          error={tagError}
        >
          <TagInput
            value={draft.tags}
            onChange={(tags) => onDraftChange({ ...draft, tags })}
            maxCount={MEMO_TAGS_MAX_COUNT}
            maxLength={MEMO_TAG_MAX_LENGTH}
            placeholder={t('notes.pub.tagPlaceholder')}
            addLabel={t('notes.pub.tags')}
            removeLabel={(tag) => t('notes.pub.tagRemove', { tag })}
            onError={(reason) => {
              setTagError(
                reason
                  ? t('notes.tagHint', {
                      max: MEMO_TAGS_MAX_COUNT,
                      length: MEMO_TAG_MAX_LENGTH,
                    })
                  : null,
              );
            }}
          />
        </Field>

        <Field className="publish-form__field publish-form__field--excerpt" label={t('notes.pub.excerpt')}>
          <Textarea
            value={draft.excerpt ?? ''}
            rows={2}
            maxLength={NOTE_EXCERPT_MAX_LENGTH}
            placeholder={t('notes.pub.excerptPlaceholder')}
            onChange={(event) => onDraftChange({ ...draft, excerpt: event.target.value || null })}
          />
        </Field>
      </div>

      <details className="publish-form__advanced">
        <summary>{t('notes.pub.advanced')}</summary>
        <div className="publish-form__advanced-body">
          <label className="publish-form__check">
            <input
              type="checkbox"
              checked={draft.allowComments}
              onChange={(event) => onDraftChange({ ...draft, allowComments: event.target.checked })}
            />
            <span>{t('notes.pub.allowComments')}</span>
          </label>
          <label className="publish-form__check">
            <input
              type="checkbox"
              checked={draft.pinned}
              onChange={(event) => onDraftChange({ ...draft, pinned: event.target.checked })}
            />
            <span>{t('notes.pub.pinned')}</span>
          </label>
          <label className="publish-form__check">
            <input
              type="checkbox"
              checked={draft.showOnHome}
              onChange={(event) => onDraftChange({ ...draft, showOnHome: event.target.checked })}
            />
            <span>{t('notes.pub.showOnHome')}</span>
          </label>
          <label className="publish-form__check">
            <input
              type="checkbox"
              checked={draft.accessPassword !== null}
              onChange={(event) =>
                onDraftChange({ ...draft, accessPassword: event.target.checked ? '' : null })
              }
            />
            <span>{t('notes.pub.accessPassword')}</span>
          </label>
          {draft.accessPassword !== null && (
            <Field
              className="publish-form__field publish-form__field--password"
              label={t('notes.pub.accessPassword')}
            >
              <Input
                type="text"
                value={draft.accessPassword}
                maxLength={64}
                placeholder={
                  draft.hasAccessPassword
                    ? t('notes.pub.accessPasswordReplace')
                    : t('notes.pub.accessPasswordPlaceholder')
                }
                onChange={(event) => onDraftChange({ ...draft, accessPassword: event.target.value })}
              />
            </Field>
          )}
          <Field className="publish-form__field publish-form__field--priority" label={t('notes.priorityLabel')}>
            <Select
              value={draft.priority}
              onChange={(event) => onDraftChange({ ...draft, priority: event.target.value as NoteDraft['priority'] })}
            >
              {MEMO_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {t(`notes.priority.${p}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </details>

      {scheduleOpen && (
        <div className="publish-form__schedule">
          <Input
            type="datetime-local"
            value={scheduleAt}
            onChange={(event) => setScheduleAt(event.target.value)}
            aria-label={t('notes.pub.scheduleAt')}
          />
          <Button size="sm" variant="primary" disabled={!scheduleAt} onClick={confirmSchedule}>
            {t('notes.pub.scheduleConfirm')}
          </Button>
          <Button size="sm" onClick={() => setScheduleOpen(false)}>
            {t('common.cancel')}
          </Button>
        </div>
      )}

      <div className="publish-form__actions">
        <span className={`publish-form__status publish-form__status--${draft.publishStatus}`}>
          {statusLabel()}
        </span>
        <Button size="sm" disabled={busy} onClick={() => onPublishAction('draft')}>
          {t('notes.pub.saveDraft')}
        </Button>
        <Button size="sm" disabled={busy} onClick={() => setScheduleOpen((open) => !open)}>
          {t('notes.pub.schedulePublish')}
        </Button>
        <Button size="sm" variant="primary" disabled={busy} onClick={() => onPublishAction('publish')}>
          {t('notes.pub.publishNow')}
        </Button>
      </div>
    </div>
  );
}
