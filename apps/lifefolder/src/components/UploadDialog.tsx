import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Select, Textarea } from '@chpli2/ui';
import type { LifeCategoryDto, LifeDocumentDto, LifeTemplateDto } from '@chpli2/shared';
import { LIFE_DOC_MAX_BYTES, LIFE_DOC_MIME_TYPES } from '@chpli2/shared';
import { ApiError, uploadDocument } from '../api';

interface UploadDialogProps {
  category: LifeCategoryDto;
  templates: LifeTemplateDto[];
  defaultTemplateId?: string;
  onUploaded: (doc: LifeDocumentDto) => void;
  onClose: () => void;
}

/** Upload flow (L1): fields + file, sensitive defaults to true (D5). */
export default function UploadDialog({
  category,
  templates,
  defaultTemplateId,
  onUploaded,
  onClose,
}: UploadDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [sensitive, setSensitive] = useState(true);
  const [templateId, setTemplateId] = useState(defaultTemplateId ?? '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !title.trim()) {
      setError(t('lf.doc.titlePlaceholder'));
      return;
    }
    if (file.size > LIFE_DOC_MAX_BYTES) {
      setError(t('lf.doc.fileTooLarge'));
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const doc = await uploadDocument({
        id: crypto.randomUUID(),
        title: title.trim(),
        categoryId: category.id,
        notes: notes.trim() || undefined,
        sensitive,
        templateId: templateId || null,
        file,
      });
      onUploaded(doc);
    } catch (err) {
      if (err instanceof ApiError && err.errorCode === 'DOCUMENT_TYPE_INVALID') {
        setError(t('lf.doc.typeInvalid'));
      } else {
        setError(err instanceof ApiError ? err.errorCode : 'UNKNOWN');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="lf-upload-wrap">
      <div className="lf-upload-backdrop" onClick={onClose} aria-hidden />
      <div className="lf-upload" role="dialog" aria-label={t('lf.doc.upload')}>
        <div className="lf-upload__head">
          <h3>{t('lf.doc.upload')}</h3>
          <Button size="sm" onClick={onClose} aria-label={t('common.close')}>
            ×
          </Button>
        </div>
        <p className="lf-upload__category">{category.name}</p>

        <label className="lf-upload__field">
          <span>{t('lf.doc.titlePlaceholder')}</span>
          <Input
            type="text"
            value={title}
            maxLength={256}
            placeholder={t('lf.doc.titlePlaceholder')}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
        </label>

        <label className="lf-upload__field">
          <span>{t('lf.doc.notesPlaceholder')}</span>
          <Textarea value={notes} rows={2} onChange={(event) => setNotes(event.target.value)} />
        </label>

        <label className="lf-upload__field">
          <span>{t('lf.doc.templateLabel')}</span>
          <Select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            <option value="">{t('lf.doc.template.none')}</option>
            {templates
              .filter((tpl) => tpl.categoryId === category.id)
              .map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))}
          </Select>
        </label>

        <label className="lf-upload__sensitive">
          <input
            type="checkbox"
            checked={sensitive}
            onChange={(event) => setSensitive(event.target.checked)}
          />
          <span>{t('lf.doc.sensitive')}</span>
        </label>

        <input
          ref={fileRef}
          type="file"
          accept={LIFE_DOC_MIME_TYPES.join(',')}
          aria-label={t('lf.doc.upload')}
        />

        {error && (
          <p className="lf-upload__error" role="alert">
            {t([`error.${error}`, 'error.UNKNOWN'])}
          </p>
        )}

        <div className="lf-upload__actions">
          <Button variant="primary" disabled={uploading} onClick={() => void handleUpload()}>
            {uploading ? t('lf.doc.uploading') : t('lf.doc.upload')}
          </Button>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
        </div>
      </div>
    </div>
  );
}
