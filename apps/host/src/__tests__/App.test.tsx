import { render, screen } from '@testing-library/react';
import i18n, { LANGUAGE_CHANGED_EVENT } from '../i18n';
import App from '../App';
import RemoteErrorBoundary from '../components/RemoteErrorBoundary';

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('zh-CN');
});

describe('Host shell', () => {
  it('renders navigation with selected state and switches language via event', async () => {
    render(<App />);

    const travelNav = screen.getByRole('button', { name: '行程' });
    expect(travelNav.className).toContain('nav-item');

    window.dispatchEvent(
      new CustomEvent(LANGUAGE_CHANGED_EVENT, { detail: { language: 'en' } }),
    );
    expect(await screen.findByRole('button', { name: 'Travel' })).toBeTruthy();
    expect(screen.getByText('Welcome to CHPLI')).toBeTruthy();

    window.dispatchEvent(
      new CustomEvent(LANGUAGE_CHANGED_EVENT, { detail: { language: 'de' } }),
    );
    expect(await screen.findByRole('button', { name: 'Reisen' })).toBeTruthy();
    expect(screen.getByText('Willkommen bei CHPLI')).toBeTruthy();
  });

  it('persists the selected language and notifies other apps via event', async () => {
    render(<App />);
    const eventSpy = vi.fn();
    window.addEventListener(LANGUAGE_CHANGED_EVENT, eventSpy);

    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(screen.getByLabelText('语言'), { target: { value: 'en' } });

    await screen.findByRole('button', { name: 'Travel' });
    expect(localStorage.getItem('chpli2-language')).toBe('en');
    expect(eventSpy).toHaveBeenCalledTimes(1);
    expect(
      (eventSpy.mock.calls[0]![0] as CustomEvent<{ language: string }>).detail,
    ).toEqual({ language: 'en' });
    window.removeEventListener(LANGUAGE_CHANGED_EVENT, eventSpy);
  });
});

describe('RemoteErrorBoundary', () => {
  function BrokenChild(): never {
    throw new Error('remote module failed');
  }

  it('shows a friendly error with retry instead of the broken child', async () => {
    render(
      <RemoteErrorBoundary moduleKey="travel" moduleUrl="http://localhost:3001">
        <BrokenChild />
      </RemoteErrorBoundary>,
    );

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('模块加载失败')).toBeTruthy();
    expect(screen.getByText(/localhost:3001/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy();
    expect(screen.queryByText('remote module failed')).toBeNull();
  });

  it('recovers when retry is clicked and the child renders again', async () => {
    let shouldThrow = true;
    function FlakyChild() {
      if (shouldThrow) throw new Error('boom');
      return <p>remote content</p>;
    }

    render(
      <RemoteErrorBoundary moduleKey="calendar" moduleUrl="http://localhost:3002">
        <FlakyChild />
      </RemoteErrorBoundary>,
    );
    expect(await screen.findByRole('alert')).toBeTruthy();

    shouldThrow = false;
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByText('remote content')).toBeTruthy();
  });
});
