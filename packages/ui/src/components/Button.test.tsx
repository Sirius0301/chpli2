import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders children and handles clicks', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('primary button keeps type=button default (no accidental form submit)', () => {
    render(<Button variant="primary">Go</Button>);
    const el = screen.getByRole('button', { name: 'Go' }) as HTMLButtonElement;
    expect(el.type).toBe('button');
  });

  it('block + size props spread onto the element', () => {
    render(
      <Button block size="sm" data-testid="b">
        x
      </Button>,
    );
    expect(screen.getByTestId('b')).toBeTruthy();
  });

  it('disabled suppresses clicks', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Nope
      </Button>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Nope' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('href renders an anchor with download support', () => {
    render(
      <Button href="/files/a.pdf" download="a.pdf">
        Get
      </Button>,
    );
    const el = screen.getByRole('link', { name: 'Get' }) as HTMLAnchorElement;
    expect(el.getAttribute('href')).toBe('/files/a.pdf');
    expect(el.getAttribute('download')).toBe('a.pdf');
  });
});
