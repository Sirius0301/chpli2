import { render, screen } from '@testing-library/react';
import { Empty } from './Empty';

describe('Empty', () => {
  it('renders the message', () => {
    render(<Empty text="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeTruthy();
  });

  it('renders an optional action slot', () => {
    render(<Empty text="empty" ><button>create</button></Empty>);
    expect(screen.getByRole('button', { name: 'create' })).toBeTruthy();
  });
});
