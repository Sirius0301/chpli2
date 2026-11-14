import './i18n';
import './styles.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Select } from '@chpli2/ui';
import type { LifeCategoryDto, LifeDocumentDto, LifeTemplateDto } from '@chpli2/shared';
import {
  ApiError,
  createCategory,
  deleteCategory,
  deleteDocument,
  documentFileUrl,
  listCategories,
  listDocuments,
  listTemplates,
  updateDocument,
  uploadDocument,
} from './api';
import UploadDialog from './components/UploadDialog';

function flatten(nodes: LifeCategoryDto[]): LifeCategoryDto[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

export default function LifeFolderApp() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<LifeCategoryDto[] | null>(null);
  const [templates, setTemplates] = useState<LifeTemplateDto[]>([]);
  const [documents, setDocuments] = useState<LifeDocumentDto[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('lf-cat-identity');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [confirmingCategoryDelete, setConfirmingCategoryDelete] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [confirmingDocDelete, setConfirmingDocDelete] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [cats, tpls, docs] = await Promise.all([listCategories(), listTemplates(), listDocuments()]);
    setCategories(cats);
    setTemplates(tpls);
    setDocuments(docs);
  }, []);

  useEffect(() => {
    reload().catch((err) => setLoadError(err instanceof ApiError ? err.errorCode : 'UNKNOWN'));
  }, [reload]);

  const allCategories = useMemo(() => flatten(categories ?? []), [categories]);
  const selectedCategory = allCategories.find((c) => c.id === selectedCategoryId) ?? null;

  const visibleDocuments = useMemo(
    () => documents.filter((d) => d.categoryId === selectedCategoryId),
    [documents, selectedCategoryId],
  );

  /** Recommended templates without a linked document yet (L1 D7). */
  const recommendations = useMemo(() => {
    const fulfilled = new Set(documents.map((d) => d.templateId).filter(Boolean));
    return templates.filter((tpl) => tpl.recommended && !fulfilled.has(tpl.id));
  }, [templates, documents]);

  const handleCreateCategory = async (name: string, parentId: string | null) => {
    const cats = await createCategory({ name, parentId });
    setCategories(cats);
    setNewCategory(null);
  };

  const handleDeleteCategory = async (category: LifeCategoryDto) => {
    if (confirmingCategoryDelete !== category.id) {
      setConfirmingCategoryDelete(category.id);
      return;
    }
    setConfirmingCategoryDelete(null);
    try {
      await deleteCategory(category.id);
      if (selectedCategoryId === category.id) setSelectedCategoryId('lf-cat-identity');
      await reload();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.errorCode : 'UNKNOWN');
    }
  };

  const handleMove = async (doc: LifeDocumentDto, targetId: string) => {
    const updated = await updateDocument(doc.id, { categoryId: targetId, updatedAt: doc.updatedAt });
    setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    setMovingId(null);
  };

  const handleDeleteDoc = async (doc: LifeDocumentDto) => {
    if (confirmingDocDelete !== doc.id) {
      setConfirmingDocDelete(doc.id);
      return;
    }
    setConfirmingDocDelete(null);
    await deleteDocument(doc.id);
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
  };

  if (categories === null && loadError) {
    return (
      <section>
        <div className="lf-error" role="alert">
          <p>{t([`error.${loadError}`, 'error.UNKNOWN'])}</p>
          <Button size="sm" onClick={() => void reload().then(() => setLoadError(null))}>
            {t('common.retry')}
          </Button>
        </div>
      </section>
    );
  }

  if (categories === null) {
    return <p className="loading">{t('common.loading')}</p>;
  }

  return (
    <section className="lf-app">
      <aside className="lf-side">
        <div className="lf-side__head">
          <h2>{t('lf.title')}</h2>
          <Button size="sm" variant="primary" onClick={() => setNewCategory('')}>
            {t('lf.category.new')}
          </Button>
        </div>
        <ul className="lf-cats">
          {categories.map((category) => (
            <li key={category.id}>
              <div className={category.id === selectedCategoryId ? 'lf-cat lf-cat--active' : 'lf-cat'}>
                <button
                  type="button"
                  className="lf-cat__name"
                  onClick={() => setSelectedCategoryId(category.id)}
                >
                  {category.name}
                  {category.builtIn && <span className="lf-cat__badge">{t('lf.builtIn')}</span>}
                </button>
                {!category.builtIn && (
                  <Button
                    size="sm"
                    variant={confirmingCategoryDelete === category.id ? 'danger' : 'default'}
                    onClick={() => void handleDeleteCategory(category)}
                  >
                    {confirmingCategoryDelete === category.id
                      ? t('lf.category.deleteConfirm')
                      : '×'}
                  </Button>
                )}
              </div>
              {category.children.length > 0 && (
                <ul className="lf-cats lf-cats--children">
                  {category.children.map((child) => (
                    <li key={child.id}>
                      <div className={child.id === selectedCategoryId ? 'lf-cat lf-cat--active' : 'lf-cat'}>
                        <button
                          type="button"
                          className="lf-cat__name"
                          onClick={() => setSelectedCategoryId(child.id)}
                        >
                          {child.name}
                        </button>
                        {!child.builtIn && (
                          <Button
                            size="sm"
                            variant={confirmingCategoryDelete === child.id ? 'danger' : 'default'}
                            onClick={() => void handleDeleteCategory(child)}
                          >
                            {confirmingCategoryDelete === child.id
                              ? t('lf.category.deleteConfirm')
                              : '×'}
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        {newCategory !== null && (
          <div className="lf-newcat">
            <Input
              type="text"
              value={newCategory}
              placeholder={t('lf.category.namePlaceholder')}
              maxLength={64}
              onChange={(event) => setNewCategory(event.target.value)}
              autoFocus
            />
            <Select
              value=""
              aria-label={t('lf.category.parentNone')}
              onChange={(event) => {
                void handleCreateCategory(newCategory.trim(), event.target.value || null);
              }}
            >
              <option value="">{t('lf.category.parentNone')}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              variant="primary"
              disabled={!newCategory.trim()}
              onClick={() => void handleCreateCategory(newCategory.trim(), null)}
            >
              {t('common.save')}
            </Button>
            <Button size="sm" onClick={() => setNewCategory(null)}>
              {t('common.cancel')}
            </Button>
          </div>
        )}
      </aside>

      <div className="lf-main">
        {recommendations.length > 0 && (
          <section className="lf-recs" data-testid="recommendations">
            <h3>{t('lf.rec.title')}</h3>
            <p className="lf-recs__hint">{t('lf.rec.hint')}</p>
            <ul>
              {recommendations.map((tpl) => (
                <li key={tpl.id} className="lf-rec" data-template-id={tpl.id}>
                  <span className="lf-rec__name">{tpl.name}</span>
                  <span className="lf-rec__desc">{tpl.description}</span>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setSelectedCategoryId(tpl.categoryId);
                      setPendingTemplateId(tpl.id);
                      setUploadOpen(true);
                    }}
                  >
                    {t('lf.rec.add')}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="lf-docs__head">
          <h3>{selectedCategory?.name ?? ''}</h3>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setPendingTemplateId(null);
              setUploadOpen(true);
            }}
            disabled={!selectedCategory}
          >
            {t('lf.doc.upload')}
          </Button>
        </div>

        {visibleDocuments.length === 0 ? (
          <p className="lf-docs__empty">{t('lf.doc.empty')}</p>
        ) : (
          <ul className="lf-docs">
            {visibleDocuments.map((doc) => (
              <li key={doc.id} className="lf-doc" data-doc-id={doc.id}>
                <div className="lf-doc__info">
                  <span className="lf-doc__title">
                    {doc.title}
                    {doc.sensitive && <span className="lf-doc__badge">{t('lf.doc.sensitiveBadge')}</span>}
                  </span>
                  <span className="lf-doc__meta">
                    {doc.fileName} · {t('lf.doc.size', { size: Math.round(doc.sizeBytes / 1024) })}
                  </span>
                </div>
                <div className="lf-doc__actions">
                  <DownloadButton doc={doc} />
                  {movingId === doc.id ? (
                    <Select
                      value=""
                      aria-label={t('lf.doc.move')}
                      autoFocus
                      onChange={(event) => {
                        if (event.target.value) void handleMove(doc, event.target.value);
                        else setMovingId(null);
                      }}
                    >
                      <option value="">{t('lf.doc.moveConfirmTitle')}</option>
                      {allCategories
                        .filter((c) => c.id !== doc.categoryId)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </Select>
                  ) : (
                    <Button size="sm" onClick={() => setMovingId(doc.id)}>
                      {t('lf.doc.move')}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={confirmingDocDelete === doc.id ? 'danger' : 'default'}
                    onClick={() => void handleDeleteDoc(doc)}
                  >
                    {confirmingDocDelete === doc.id
                      ? t('lf.doc.deleteConfirm')
                      : t('common.delete')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {uploadOpen && selectedCategory && (
        <UploadDialog
          category={selectedCategory}
          templates={templates}
          defaultTemplateId={pendingTemplateId ?? undefined}
          onUploaded={(doc) => {
            setDocuments((prev) => [doc, ...prev]);
            setUploadOpen(false);
          }}
          onClose={() => setUploadOpen(false)}
        />
      )}
    </section>
  );
}

function DownloadButton({ doc }: { doc: LifeDocumentDto }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const revoked = useRef(false);
  useEffect(() => {
    revoked.current = false;
    documentFileUrl(doc.id)
      .then((u) => {
        if (revoked.current) URL.revokeObjectURL(u);
        else setUrl(u);
      })
      .catch(() => {});
    return () => {
      revoked.current = true;
      setUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return null;
      });
    };
  }, [doc.id]);
  return url ? (
    <Button size="sm" href={url} download={doc.fileName}>
      {t('lf.doc.download')}
    </Button>
  ) : null;
}
