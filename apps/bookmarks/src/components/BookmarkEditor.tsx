import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Chip, Input, Textarea } from '@chpli2/ui';
import type { BookmarkDto } from '@chpli2/shared';
import {
  BOOKMARK_CATEGORIES_MAX_COUNT,
  BOOKMARK_CATEGORY_MAX_LENGTH,
  MEMO_IMAGE_MAX_BYTES,
  isValidHttpUrl,
} from '@chpli2/shared';
import { bookmarkCoverUrl, uploadBookmarkCover } from '../api';

interface BookmarkEditorProps {
  mode: 'new' | 'edit';
  bookmark?: BookmarkDto;
  confirmingDelete: boolean;
  onSubmit: (values: {
    title: string;
    url: string;
    description: string;
    categories: string[];
  }) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}

/** Bookmark editor side panel (B1): fields + cover upload with preview. */
export default function BookmarkEditor({
  mode,
  bookmark,
  confirmingDelete,
  onSubmit,
  onDelete,
  onClose,
}: BookmarkEditorProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(bookmark?.title ?? '');
  const [url, setUrl] = useState(bookmark?.url ?? '');
  const [description, setDescription] = useState(bookmark?.description ?? '');
  const [categories, setCategories] = useState<string[]>(bookmark?.categories ?? []);
  const [categoryInput, setCategoryInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!bookmark?.hasCover) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    bookmarkCoverUrl(bookmark.id)
      .then((u) => {
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        objectUrl = u;
        setCoverUrl(u);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [bookmark?.id, bookmark?.hasCover]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent | globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey as EventListener);
    return () => window.removeEventListener('keydown', onKey as EventListener);
  }, [onClose]);

  const addCategory = (raw: string) => {
    const cat = raw.trim();
    setCategoryInput('');
    if (!cat) return;
    if (cat.length > BOOKMARK_CATEGORY_MAX_LENGTH || categories.length >= BOOKMARK_CATEGORIES_MAX_COUNT) {
      setError(t('bm.categoryHint', { max: BOOKMARK_CATEGORIES_MAX_COUNT, length: BOOKMARK_CATEGORY_MAX_LENGTH }));
      return;
    }
    if (categories.includes(cat)) return;
    setError(null);
    setCategories([...categories, cat]);
  };

  const onCategoryKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addCategory(categoryInput);
    } else if (event.key === 'Backspace' && !categoryInput && categories.length) {
      setCategories(categories.slice(0, -1));
    }
  };

  const validate = (): string | null => {
    if (!title.trim()) return t('bm.titleRequired');
    if (!isValidHttpUrl(url.trim())) return t('bm.invalidUrl');
    return null;
  };

  const handleSubmit = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        url: url.trim(),
        description: description.trim(),
        categories,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleCoverFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !bookmark) return;
    if (file.size > MEMO_IMAGE_MAX_BYTES) {
      setError(t('bm.imageTooLarge'));
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const updated = await uploadBookmarkCover(bookmark.id, file);
      const fresh = await bookmarkCoverUrl(updated.id);
      setCoverUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return fresh;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  return (
    <div className="bm-editor-wrap">
      <div className="bm-editor-backdrop" onClick={onClose} aria-hidden />
      <aside className="bm-editor" aria-label={t(mode === 'new' ? 'bm.new' : 'bm.edit')}>
        <div className="bm-editor__header">
          <h3>{t(mode === 'new' ? 'bm.new' : 'bm.edit')}</h3>
          <Button size="sm" onClick={onClose} aria-label={t('common.close')}>
            ×
          </Button>
        </div>

        <label className="bm-editor__field">
          <span>{t('bm.titlePlaceholder')}</span>
          <Input
            type="text"
            value={title}
            maxLength={256}
            placeholder={t('bm.titlePlaceholder')}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
        </label>

        <label className="bm-editor__field">
          <span>{t('bm.urlPlaceholder')}</span>
          <Input
            type="text"
            value={url}
            maxLength={2048}
            placeholder={t('bm.urlPlaceholder')}
            onChange={(event) => setUrl(event.target.value)}
          />
        </label>

        <label className="bm-editor__field">
          <span>{t('bm.descriptionPlaceholder')}</span>
          <Textarea
            value={description}
            rows={3}
            placeholder={t('bm.descriptionPlaceholder')}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <label className="bm-editor__field">
          <span>{t('bm.categoriesLabel')}</span>
          <div className="bm-editor__cats">
            {categories.map((cat) => (
              <Chip
                key={cat}
                onRemove={() => setCategories(categories.filter((x) => x !== cat))}
                removeLabel={t('bm.categoryRemove', { tag: cat })}
              >
                {cat}
              </Chip>
            ))}
            <input
              type="text"
              value={categoryInput}
              maxLength={BOOKMARK_CATEGORY_MAX_LENGTH + 1}
              placeholder={t('bm.categoryInputPlaceholder')}
              onChange={(event) => setCategoryInput(event.target.value)}
              onKeyDown={onCategoryKeyDown}
              onBlur={() => addCategory(categoryInput)}
            />
          </div>
        </label>

        {mode === 'edit' && bookmark && (
          <div className="bm-editor__cover">
            <span className="bm-editor__field-title">{t('bm.cover')}</span>
            {coverUrl && <img className="bm-editor__cover-preview" src={coverUrl} alt="" />}
            <span className="bm-editor__hint">{t('bm.coverReplaceHint')}</span>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="bm-editor__cover-input"
              onChange={(event) => void handleCoverFile(event.target.files)}
              aria-label={t('bm.uploadCover')}
            />
            <Button size="sm" disabled={uploading} onClick={() => coverInputRef.current?.click()}>
              {uploading ? t('bm.uploading') : t('bm.uploadCover')}
            </Button>
          </div>
        )}

        {error && (
          <p className="bm-editor__error" role="alert">
            {error}
          </p>
        )}

        <div className="bm-editor__actions">
          <Button variant="primary" disabled={saving} onClick={() => void handleSubmit()}>
            {t('common.save')}
          </Button>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          {mode === 'edit' && (
            <Button
              variant={confirmingDelete ? 'danger' : 'default'}
              onClick={() => void onDelete()}
            >
              {confirmingDelete ? t('bm.deleteConfirm') : t('common.delete')}
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}
