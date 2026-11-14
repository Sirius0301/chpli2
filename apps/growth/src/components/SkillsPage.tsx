import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@chpli2/ui';
import type { GoalDto, SkillDto } from '@chpli2/shared';
import {
  ApiError,
  addSkillLink,
  createSkill,
  deleteSkill,
  listSkills,
  removeSkillLink,
  updateSkill,
} from '../api';
import SkillEditor from './SkillEditor';
import LinkRow from './LinkRow';

interface SkillsPageProps {
  goals: GoalDto[];
}

export default function SkillsPage({ goals }: SkillsPageProps) {
  const { t } = useTranslation();
  const [skills, setSkills] = useState<SkillDto[] | null>(null);
  const [editing, setEditing] = useState<{ kind: 'new' } | { kind: 'edit'; skill: SkillDto } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setSkills(await listSkills());
  }, []);

  useEffect(() => {
    reload().catch((err) => setError(err instanceof ApiError ? err.errorCode : 'UNKNOWN'));
  }, [reload]);

  const applySkill = useCallback((updated: SkillDto) => {
    setSkills((prev) => prev?.map((s) => (s.id === updated.id ? updated : s)) ?? prev);
  }, []);

  if (skills === null) {
    return <p className="loading">{t('common.loading')}</p>;
  }

  return (
    <div className="growth-page" data-testid="skills-page">
      <div className="growth-page__head">
        <h2>{t('skill.title')}</h2>
        <Button
          variant="primary"
          onClick={() => setEditing({ kind: 'new' })}
        >
          {t('skill.new')}
        </Button>
      </div>
      {error && (
        <p className="growth-page__error" role="alert">
          {t([`error.${error}`, 'error.UNKNOWN'])}
        </p>
      )}
      {skills.length === 0 ? (
        <p className="growth-page__empty">{t('skill.empty')}</p>
      ) : (
        <ul className="skill-list">
          {skills.map((skill) => (
            <li key={skill.id} className="skill-card" data-skill-id={skill.id}>
              <div className="skill-card__head">
                <span className="skill-card__name">{skill.name}</span>
                <span className="skill-card__level" aria-label={t('skill.level')}>
                  {[1, 2, 3, 4, 5].map((step) => (
                    <span
                      key={step}
                      className={step <= skill.level ? 'skill-dot skill-dot--on' : 'skill-dot'}
                    />
                  ))}
                </span>
                <span className="skill-card__goal">
                  {skill.goalTitle ?? t('skill.goal.none')}
                </span>
                <Button size="sm" onClick={() => setEditing({ kind: 'edit', skill })}>
                  {t('common.save')}
                </Button>
              </div>
              <LinkRow
                owner={skill}
                addLink={(body) => addSkillLink(skill.id, body).then(applySkill)}
                removeLink={(linkId) => removeSkillLink(skill.id, linkId).then(applySkill)}
                noteLabel={t('skill.links.addNote')}
                bookmarkLabel={t('skill.links.addBookmark')}
                onOpen={(module, refId) => {
                  try {
                    sessionStorage.setItem(
                      'chpli2-pending-open',
                      JSON.stringify({ module, id: refId }),
                    );
                  } catch {
                    /* mailbox unavailable */
                  }
                  window.dispatchEvent(
                    new CustomEvent('chpli2-navigate', { detail: { view: module } }),
                  );
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <SkillEditor
          mode={editing.kind}
          skill={editing.kind === 'edit' ? editing.skill : undefined}
          goals={goals}
          onSubmit={async (values) => {
            try {
              if (editing.kind === 'edit') {
                const updated = await updateSkill(editing.skill.id, {
                  ...values,
                  updatedAt: editing.skill.updatedAt,
                });
                applySkill(updated);
              } else {
                const created = await createSkill({ id: crypto.randomUUID(), ...values });
                setSkills((prev) => [...(prev ?? []), created]);
              }
              setEditing(null);
              await reload();
            } catch (err) {
              if (err instanceof ApiError && err.errorCode === 'SKILL_EXISTS') {
                setError(t('skill.duplicate'));
              } else {
                setError(err instanceof ApiError ? err.errorCode : 'UNKNOWN');
              }
            }
          }}
          onDelete={async () => {
            if (editing.kind !== 'edit') return;
            await deleteSkill(editing.skill.id);
            setSkills((prev) => (prev ?? []).filter((s) => s.id !== editing.skill.id));
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
