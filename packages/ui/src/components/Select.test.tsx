import { fireEvent, render, screen } from '@testing-library/react';
import { Select } from './Select';

describe('Select', () => {
  it('renders options and reflects selection', () => {
    render(
      <Select defaultValue="b" aria-label="pick">
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>,
    );
    const select = screen.getByLabelText('pick') as HTMLSelectElement;
    expect(select.value).toBe('b');
    fireEvent.change(select, { target: { value: 'a' } });
    expect(select.value).toBe('a');
  });
});
