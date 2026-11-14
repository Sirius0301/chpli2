import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { Chip } from './Chip';

describe('Chip', () => {
  it('renders its label', () => {
    render(<Chip>work</Chip>);
    expect(screen.getByText('work')).toBeTruthy();
  });

  it('without onRemove there is no remove button', () => {
    render(<Chip>work</Chip>);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('remove button fires onRemove once', () => {
    const onRemove = vi.fn();
    render(<Chip onRemove={onRemove}>work</Chip>);
    fireEvent.click(screen.getByRole('button', { name: 'remove' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
