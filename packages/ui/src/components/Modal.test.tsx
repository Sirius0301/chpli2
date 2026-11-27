import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="t" closeLabel="Close">
        body
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders title, body and footer when open', () => {
    render(
      <Modal open onClose={() => {}} title="Confirm" closeLabel="Close" footer={<button>ok</button>}>
        <p>content</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('content')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ok' })).toBeTruthy();
  });

  it('Escape closes', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="t" closeLabel="Close">
        b
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('supports alertdialog role and a localized close label', () => {
    render(
      <Modal open onClose={() => {}} title="Discard?" role="alertdialog" closeLabel="Schließen">
        body
      </Modal>,
    );
    expect(screen.getByRole('alertdialog', { name: 'Discard?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Schließen' })).toBeTruthy();
  });

  it('mask mousedown closes; clicks inside the card do not', () => {
    const onClose = vi.fn();
    const { baseElement } = render(
      <Modal open onClose={onClose} title="t" closeLabel="Close">
        <button>inside</button>
      </Modal>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'inside' }));
    expect(onClose).not.toHaveBeenCalled();
    // The dialog portals to document.body, so query from baseElement.
    fireEvent.mouseDown(baseElement.querySelector('[role="dialog"]')!.parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
