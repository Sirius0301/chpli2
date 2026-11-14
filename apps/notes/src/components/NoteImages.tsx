import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@chpli2/ui';
import type { NoteImageDto } from '@chpli2/shared';
import { MEMO_IMAGE_MAX_BYTES, MEMO_IMAGE_MIME_TYPES } from '@chpli2/shared';
import {
  ApiError,
  deleteNoteImage,
  listNoteImages,
  noteImageUrl,
  uploadNoteImage,
} from '../api';

interface NoteImagesProps {
  noteId: string;
}

/** Note image attachments (N2 D6) — same UX and semantics as memo images (M3). */
export default function NoteImages({ noteId }: NoteImagesProps) {
  const { t } = useTranslation();
  const [images, setImages] = useState<NoteImageDto[] | null>(null);
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map());
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbsRef = useRef<Map<string, string>>(new Map());

  const revokeThumbs = useCallback(() => {
    for (const url of thumbsRef.current.values()) URL.revokeObjectURL(url);
    thumbsRef.current = new Map();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listNoteImages(noteId);
        if (cancelled) return;
        setImages(rows);
        revokeThumbs();
        const next = new Map<string, string>();
        for (const row of rows) {
          next.set(row.id, await noteImageUrl(row.id));
          if (cancelled) return;
        }
        thumbsRef.current = next;
        setThumbs(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.errorCode : 'UNKNOWN');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [noteId, revokeThumbs]);

  useEffect(() => revokeThumbs, [revokeThumbs]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MEMO_IMAGE_MAX_BYTES) {
          setError(t('notes.imageTooLarge'));
          continue;
        }
        const uploaded = await uploadNoteImage(noteId, file);
        setImages((prev) => [...(prev ?? []), uploaded]);
        const url = await noteImageUrl(uploaded.id);
        thumbsRef.current.set(uploaded.id, url);
        setThumbs(new Map(thumbsRef.current));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.errorCode : 'UNKNOWN');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (imageId: string) => {
    if (confirming !== imageId) {
      setConfirming(imageId);
      return;
    }
    setConfirming(null);
    await deleteNoteImage(noteId, imageId);
    setImages((prev) => (prev ?? []).filter((i) => i.id !== imageId));
    const url = thumbsRef.current.get(imageId);
    if (url) URL.revokeObjectURL(url);
    thumbsRef.current.delete(imageId);
    setThumbs(new Map(thumbsRef.current));
  };

  return (
    <div className="note-images">
      <span className="note-editor__section-title">{t('notes.images')}</span>
      {images !== null && images.length > 0 && (
        <div className="note-images__grid">
          {images.map((image) => (
            <div key={image.id} className="note-images__item" data-image-id={image.id}>
              {thumbs.get(image.id) ? (
                <img src={thumbs.get(image.id)} alt={image.fileName} />
              ) : (
                <span className="note-images__placeholder">{image.fileName}</span>
              )}
              <button
                type="button"
                className={
                  confirming === image.id
                    ? 'note-images__remove note-images__remove--confirm'
                    : 'note-images__remove'
                }
                onClick={() => void handleDelete(image.id)}
              >
                {confirming === image.id ? t('notes.imageDeleteConfirm') : '×'}
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={MEMO_IMAGE_MIME_TYPES.join(',')}
        className="note-images__input"
        onChange={(event) => void handleFiles(event.target.files)}
        aria-label={t('notes.addImages')}
      />
      <Button size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
        {uploading ? t('notes.imageUploading') : t('notes.addImages')}
      </Button>
      {error && (
        <p className="note-editor__error" role="alert">
          {t([`error.${error}`, 'error.UNKNOWN'])}
        </p>
      )}
    </div>
  );
}
