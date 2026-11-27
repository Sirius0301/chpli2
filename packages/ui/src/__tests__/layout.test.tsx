import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { Workspace } from '../layout/Workspace';
import { SidePanel } from '../layout/SidePanel';
import { Field } from '../form/Field';
import { TagInput } from '../form/TagInput';
import { FilterRow } from '../form/FilterRow';
import { Tabs } from '../navigation/Tabs';
import { Alert } from '../feedback/Alert';
import { Loading } from '../feedback/Loading';
import { Tooltip } from '../feedback/Tooltip';
import { ResizeHandle } from '../layout/ResizeHandle';

describe('Workspace', () => {
  it('renders toolbar, banner, sidebar, main and aside slots', () => {
    render(
      <Workspace
        toolbar={<div>toolbar</div>}
        banner={<div>banner</div>}
        sidebar={<div>sidebar</div>}
        aside={<div>aside</div>}
        sidebarWidth={240}
      >
        <div>content</div>
      </Workspace>,
    );
    expect(screen.getByText('toolbar')).toBeTruthy();
    expect(screen.getByText('banner')).toBeTruthy();
    expect(screen.getByText('sidebar')).toBeTruthy();
    expect(screen.getByText('aside')).toBeTruthy();
    expect(screen.getByTestId('workspace-main').textContent).toContain('content');
  });
});

describe('SidePanel', () => {
  it('renders title, body and footer and closes from the button', () => {
    const onClose = vi.fn();
    render(
      <SidePanel onClose={onClose} title="Details" closeLabel="Close" footer={<button>Save</button>}>
        <p>body</p>
      </SidePanel>,
    );
    expect(screen.getByRole('complementary', { name: 'Details' })).toBeTruthy();
    expect(screen.getByText('body')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <SidePanel onClose={onClose} title="Details" closeLabel="Close">
        body
      </SidePanel>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Field', () => {
  it('associates a wrapping label and shows hint/error', () => {
    const { rerender } = render(
      <Field label="Title" hint="Required">
        <input />
      </Field>,
    );
    expect(screen.getByLabelText('Title')).toBeTruthy();
    expect(screen.getByText('Required')).toBeTruthy();

    rerender(
      <Field label="Title" error="Too short">
        <input />
      </Field>,
    );
    expect(screen.getByRole('alert').textContent).toContain('Too short');
  });
});

function TagHarness() {
  const [tags, setTags] = useState<string[]>([]);
  return (
    <TagInput
      value={tags}
      onChange={setTags}
      maxCount={2}
      maxLength={4}
      placeholder="Add tag"
      addLabel="Add tag"
      removeLabel={(tag) => `Remove ${tag}`}
    />
  );
}

describe('TagInput', () => {
  it('adds tags with Enter, removes chips, and enforces limits', () => {
    render(<TagHarness />);
    const input = screen.getByLabelText('Add tag');

    fireEvent.change(input, { target: { value: 'work' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('work')).toBeTruthy();

    fireEvent.change(input, { target: { value: 'home' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('home')).toBeTruthy();

    // At maxCount, a third tag is rejected.
    fireEvent.change(input, { target: { value: 'third' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.queryByText('third')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Remove work' }));
    expect(screen.queryByText('work')).toBeNull();
  });
});

function TabsHarness() {
  const [value, setValue] = useState<'a' | 'b'>('a');
  return (
    <Tabs
      items={[
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B', disabled: true },
      ]}
      value={value}
      onChange={setValue}
      ariaLabel="Example tabs"
    />
  );
}

describe('Tabs', () => {
  it('selects enabled tabs and ignores disabled ones', () => {
    render(<TabsHarness />);
    expect(screen.getByRole('tab', { name: 'A' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'B' }));
    expect(screen.getByRole('tab', { name: 'A' }).getAttribute('aria-selected')).toBe('true');
  });
});

describe('FilterRow', () => {
  it('toggles and renders an optional count', () => {
    const onToggle = vi.fn();
    render(<FilterRow checked={false} onToggle={onToggle} label="work" count={3} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'work 3' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(screen.getByText('3')).toBeTruthy();
  });
});

describe('ResizeHandle', () => {
  it('adjusts the width with the arrow keys and clamps it', () => {
    const onChange = vi.fn();
    render(
      <ResizeHandle
        value={200}
        min={160}
        max={360}
        direction="grow-right"
        onChange={onChange}
        label="Resize sidebar"
      />,
    );
    const handle = screen.getByRole('separator', { name: 'Resize sidebar' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(208);
    fireEvent.keyDown(handle, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(360);
  });
});

describe('Tooltip', () => {
  it('shows the tooltip on hover and hides it on leave', async () => {
    render(
      <Tooltip content="Full title" delay={0}>
        <button type="button">trigger</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'trigger' }));
    await waitFor(() => expect(screen.getByRole('tooltip').textContent).toBe('Full title'));
    fireEvent.mouseLeave(screen.getByRole('button', { name: 'trigger' }));
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });
});

describe('Feedback', () => {
  it('renders alert and loading states', () => {
    render(
      <>
        <Alert tone="danger" action={<button>Retry</button>}>
          failed
        </Alert>
        <Loading label="loading" />
      </>,
    );
    expect(screen.getByRole('alert').textContent).toContain('failed');
    expect(screen.getByRole('status').textContent).toContain('loading');
  });
});
