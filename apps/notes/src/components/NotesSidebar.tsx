import { useTranslation } from 'react-i18next';
import { Button, Input } from '@chpli2/ui';
import type { TagCountDto } from '@chpli2/shared';
import NoteFilters, { type NoteFiltersState } from './NoteFilters';

export interface NotesSidebarProps {
  search: string;
  onSearchChange: (value: string) => void;
  tags: TagCountDto[];
  categories: TagCountDto[];
  filters: NoteFiltersState;
  onFiltersChange: (filters: NoteFiltersState) => void;
  onCreate: () => void;
}

/**
 * Notes left rail: title/new action, search and the four filter dimensions.
 * Kept as a presentational component so NotesApp stays focused on data flow.
 */
export default function NotesSidebar({
  search,
  onSearchChange,
  tags,
  categories,
  filters,
  onFiltersChange,
  onCreate,
}: NotesSidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="notes-side">
      <div className="notes-side__head">
        <h2>{t('notes.title')}</h2>
        <Button size="sm" variant="primary" onClick={onCreate}>
          {t('notes.new')}
        </Button>
      </div>
      <Input
        type="search"
        className="notes-search"
        placeholder={t('notes.searchPlaceholder')}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        aria-label={t('notes.searchPlaceholder')}
      />
      <NoteFilters
        tags={tags}
        categories={categories}
        filters={filters}
        onChange={onFiltersChange}
      />
    </aside>
  );
}
