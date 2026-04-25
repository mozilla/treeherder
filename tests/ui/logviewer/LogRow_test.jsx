import { render, screen, fireEvent } from '@testing-library/react';

import LogRow from '../../../ui/logviewer/LogRow';

describe('LogRow', () => {
  const defaultProps = {
    index: 4,
    line: 'INFO - Test passed successfully',
    lineNumber: 5,
    isHighlighted: false,
    isSearchMatch: false,
    onLineClick: jest.fn(),
  };

  beforeEach(() => {
    defaultProps.onLineClick.mockClear();
  });

  test('renders line number and content', () => {
    render(<LogRow {...defaultProps} />);

    const lineNumberLink = screen.getByText('5');
    expect(lineNumberLink).toBeInTheDocument();
    expect(lineNumberLink.closest('a')).toHaveAttribute('href', '#5');

    expect(
      screen.getByText('INFO - Test passed successfully'),
    ).toBeInTheDocument();
  });

  test('click calls onLineClick with (lineNumber, false)', () => {
    render(<LogRow {...defaultProps} />);

    const row = screen.getByTestId('log-line-5');
    fireEvent.click(row);

    expect(defaultProps.onLineClick).toHaveBeenCalledWith(5, false);
  });

  test('shift+click calls onLineClick with (lineNumber, true)', () => {
    render(<LogRow {...defaultProps} />);

    const row = screen.getByTestId('log-line-5');
    fireEvent.click(row, { shiftKey: true });

    expect(defaultProps.onLineClick).toHaveBeenCalledWith(5, true);
  });

  test('applies .classic-log-highlight class when isHighlighted is true', () => {
    render(<LogRow {...defaultProps} isHighlighted />);

    const row = screen.getByTestId('log-line-5');
    expect(row).toHaveClass('classic-log-highlight');
  });

  test('does not apply .classic-log-highlight class when isHighlighted is false', () => {
    render(<LogRow {...defaultProps} isHighlighted={false} />);

    const row = screen.getByTestId('log-line-5');
    expect(row).not.toHaveClass('classic-log-highlight');
  });

  test('highlights matched text inline when isSearchMatch and searchTerm are set', () => {
    render(
      <LogRow
        {...defaultProps}
        isSearchMatch
        searchTerm="passed"
        caseInsensitive
      />,
    );

    const marks = screen.getByTestId('log-line-5').querySelectorAll('mark');
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe('passed');
  });

  test('has data-line attribute for error line CSS targeting', () => {
    render(<LogRow {...defaultProps} />);

    const row = screen.getByTestId('log-line-5');
    expect(row).toHaveAttribute('data-line', '5');
  });

  test('calls formatLine to render content when provided', () => {
    const formatLine = jest.fn((line) => <em>{line.toUpperCase()}</em>);

    render(<LogRow {...defaultProps} formatLine={formatLine} />);

    expect(formatLine).toHaveBeenCalledWith('INFO - Test passed successfully');
    expect(
      screen.getByText('INFO - TEST PASSED SUCCESSFULLY'),
    ).toBeInTheDocument();
  });
});
