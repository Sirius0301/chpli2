import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@chpli2/ui';
import type { MemoImageDto } from '@chpli2/shared';
import { MEMO_IMAGE_MAX_BYTES, MEMO_IMAGE_MIME_TYPES } from '@chpli2/shared';
import {
  ApiError,
  deleteMemoImage,
  listMemoImages,
  memoImageUrl,
  uploadMemoImage,
} from '../api';

interface MemoImagesProps {
  memoId: string;
}

/**
 * Image section of the memo DetailPanel (M3): thumbnails (blob URLs fetched
 * through the authenticated API), per-image two-step delete and multi-select
 * upload (files are submitted one by one, each with its own idempotent id).
 */
export default function MemoImages({ memoId }: MemoImagesProps) {
  const { t } = useTranslation();
  const [images, setImages] = useState<MemoImageDto[] | null>(null);
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
        const rows = await listMemoImages(memoId);
        if (cancelled) return;
        setImages(rows);
        revokeThumbs();
        const next = new Map<string, string>();
        for (const row of rows) {
          next.set(row.id, await memoImageUrl(row.id));
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
  }, [memoId, revokeThumbs]);

  useEffect(() => revokeThumbs, [revokeThumbs]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MEMO_IMAGE_MAX_BYTES) {
          setError(t('memo.imageTooLarge'));
          continue;
        }
        const uploaded = await uploadMemoImage(memoId, file);
        setImages((prev) => [...(prev ?? []), uploaded]);
        const url = await memoImageUrl(uploaded.id);
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
    await deleteMemoImage(memoId, imageId);
    setImages((prev) => (prev ?? []).filter((i) => i.id !== imageId));
    const url = thumbsRef.current.get(imageId);
    if (url) URL.revokeObjectURL(url);
    thumbsRef.current.delete(imageId);
    setThumbs(new Map(thumbsRef.current));
  };

  return (
    <div className="memo-images">
      <span className="detail-panel__field-title">{t('memo.images')}</span>
      {images === null ? null : images.length === 0 ? null : (
        <div className="memo-images__grid">
          {images.map((image) => (
            <div key={image.id} className="memo-images__item" data-image-id={image.id}>
              {thumbs.get(image.id) ? (
                <img src={thumbs.get(image.id)} alt={image.fileName} />
              ) : (
                <span className="memo-images__placeholder">{image.fileName}</span>
              )}
              <button
                type="button"
                className={
                  confirming === image.id ? 'memo-images__remove memo-images__remove--confirm' : 'memo-images__remove'
                }
                onClick={() => void handleDelete(image.id)}
              >
                {confirming === image.id ? t('memo.imageDeleteConfirm') : '×'}
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
        className="memo-images__input"
        onChange={(event) => void handleFiles(event.target.files)}
        aria-label={t('memo.addImages')}
      />
      <Button size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
        {uploading ? t('memo.imageUploading') : t('memo.addImages')}
      </Button>
      {error && (
        <p className="detail-panel__error" role="alert">
          {t([`error.${error}`, 'error.UNKNOWN'])}
        </p>
      )}
    </div>
  );
}
