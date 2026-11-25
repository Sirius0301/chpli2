import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import type { NoteSummaryDto } from '@chpli2/shared';
import { preprocessWikiLinks, isWikiHref, noteIdFromWikiHref, WIKI_HREF_PREFIX } from '../wiki';
import { isNoteImageSrc, noteImageIdFromSrc } from '../editor-utils';
import { noteImageUrl } from '../api';

interface MarkdownPreviewProps {
  /** Raw markdown source. */
  body: string;
  /** Unfiltered note titles for wiki-link resolution. */
  allNotes: NoteSummaryDto[];
  /** Renders $$…$$ via KaTeX when on (数学公式开关). */
  math: boolean;
  onOpenNote: (id: string) => void;
}

/**
 * Rendered markdown surface shared by the editor preview tab, the split
 * pane and (later) the blog reading page — one `.markdown-body` class keeps
 * every surface visually identical (N3).
 */
export default function MarkdownPreview({ body, allNotes, math, onOpenNote }: MarkdownPreviewProps) {
  const { t } = useTranslation();
  const { markdown } = preprocessWikiLinks(body, allNotes);

  const components: Components = {
    a: ({ href, children }) => {
      if (isWikiHref(href)) {
        const id = noteIdFromWikiHref(href!);
        const resolved = allNotes.some((n) => n.id === id);
        if (!resolved) {
          return (
            <span className="wiki-link wiki-link--broken" title={t('notes.brokenLink')}>
              {children}
            </span>
          );
        }
        return (
          <button type="button" className="wiki-link" onClick={() => onOpenNote(id)}>
            {children}
          </button>
        );
      }
      return <a href={href}>{children}</a>;
    },
    img: ({ src, alt }) => <NoteImage src={src ?? ''} alt={alt ?? ''} />,
  };

  // Wiki hrefs are internal; note-image:// refs are resolved by the custom
  // img component; everything else keeps react-markdown's URL sanitising.
  const urlTransform = (url: string) =>
    url.startsWith(WIKI_HREF_PREFIX) || isNoteImageSrc(url) ? url : defaultUrlTransform(url);

  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={math ? [remarkGfm, remarkMath] : [remarkGfm]}
        rehypePlugins={math ? [rehypeKatex] : []}
        urlTransform={urlTransform}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

/** Resolves note-image://<id> sources through the authenticated image API. */
function NoteImage({ src, alt }: { src: string; alt: string }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isNoteImageSrc(src)) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    noteImageUrl(noteImageIdFromSrc(src))
      .then((resolved) => {
        if (cancelled) {
          URL.revokeObjectURL(resolved);
          return;
        }
        objectUrl = resolved;
        setUrl(resolved);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!isNoteImageSrc(src)) {
    // External images pass through unchanged (default URL sanitising applied).
    return <img src={src} alt={alt} />;
  }
  if (failed) return <span className="markdown-body__image-error">{t('notes.imageLoadFailed')}</span>;
  if (!url) return <span className="markdown-body__image-loading">{t('common.loading')}</span>;
  return <img src={url} alt={alt} />;
}
