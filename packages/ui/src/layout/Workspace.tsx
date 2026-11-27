import type { ReactNode } from 'react';
import { cx } from '../cx';
import { ResizeHandle } from './ResizeHandle';
import styles from './Workspace.module.css';

export interface WorkspaceProps {
  /** Optional toolbar rendered above the sidebar/main row. */
  toolbar?: ReactNode;
  /** Full-width banner rendered below the toolbar (e.g. an Alert). */
  banner?: ReactNode;
  /** Optional left rail. The app owns the rail's content and width semantics. */
  sidebar?: ReactNode;
  /** Optional right rail (typically a SidePanel). */
  aside?: ReactNode;
  /** Left-rail width in pixels. Omit to let the child own its width. */
  sidebarWidth?: number;
  /** Render a keyboard/pointer splitter between the sidebar and main. */
  sidebarResizable?: boolean;
  sidebarMinWidth?: number;
  sidebarMaxWidth?: number;
  /** Localized accessible name for the splitter. */
  sidebarResizeLabel?: string;
  onSidebarWidthChange?: (width: number) => void;
  /** `auto` for page-like content; `hidden` when the content owns its scrolling. */
  mainScroll?: 'auto' | 'hidden';
  /** Escape hatch for legacy e2e selectors such as `cal-main`. */
  mainClassName?: string;
  /** Stable hook for app-level tests; the main slot already has workspace-main. */
  testId?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Remote-workspace frame: toolbar + optional banner + [sidebar | main | aside].
 * It deliberately does not render global navigation, auth, or routing; the
 * Host owns those. Height contract is `100%` with `min-height: 0` so nested
 * lists can scroll without creating a second page scrollbar.
 */
export function Workspace({
  toolbar,
  banner,
  sidebar,
  aside,
  sidebarWidth,
  sidebarResizable = false,
  sidebarMinWidth = 180,
  sidebarMaxWidth = 480,
  sidebarResizeLabel,
  onSidebarWidthChange,
  mainScroll = 'auto',
  mainClassName,
  testId,
  className,
  children,
}: WorkspaceProps) {
  return (
    <section className={cx(styles.workspace, className)} data-testid={testId}>
      {toolbar}
      {banner}
      <div className={styles.body}>
        {sidebar && (
          <div
            className={styles.sidebar}
            style={sidebarWidth === undefined ? undefined : { width: sidebarWidth }}
          >
            {sidebar}
          </div>
        )}
        {sidebar &&
          sidebarResizable &&
          onSidebarWidthChange &&
          sidebarResizeLabel &&
          sidebarWidth !== undefined && (
            <ResizeHandle
              value={sidebarWidth}
              min={sidebarMinWidth}
              max={sidebarMaxWidth}
              direction="grow-right"
              onChange={onSidebarWidthChange}
              label={sidebarResizeLabel}
            />
          )}
        <main
          className={cx(
            styles.main,
            mainScroll === 'hidden' ? styles.mainHidden : styles.mainAuto,
            mainClassName,
          )}
          data-testid="workspace-main"
        >
          {children}
        </main>
        {aside}
      </div>
    </section>
  );
}
