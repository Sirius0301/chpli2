import { fireEvent, render, screen } from '@testing-library/react';
import { Input, Textarea } from './Input';

describe('Input', () => {
  it('renders with placeholder and accepts typing', () => {
    render(<Input placeholder="Title" />);
    const input = screen.getByPlaceholderText('Title');
    fireEvent.change(input, { target: { value: 'hello' } });
    expect((input as HTMLInputElement).value).toBe('hello');
  });

  it('error flag renders', () => {
    render(<Input error aria-label="x" />);
    expect(screen.getByLabelText('x')).toBeTruthy();
  });

  it('textarea renders multi-line value', () => {
    render(<Textarea value={'line1\nline2'} onChange={() => {}} aria-label="body" />);
    expect((screen.getByLabelText('body') as HTMLTextAreaElement).value).toBe('line1\nline2');
  });
});
