import { render, screen, fireEvent } from '@testing-library/react';

import SearchBar from '../../../ui/logviewer/SearchBar';

describe('SearchBar', () => {
  const defaultProps = {
    searchTerm: '',
    setSearchTerm: jest.fn(),
    matchCount: 0,
    caseInsensitive: true,
    onToggleCase: jest.fn(),
    onFilter: jest.fn(),
    onClearFilter: jest.fn(),
    isFiltered: false,
    highlight: null,
    copyHighlightedLines: jest.fn(),
    scrollToLine: jest.fn(),
    setHighlight: jest.fn(),
    lineCount: 100,
    errorLineNumbers: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders search input with placeholder', () => {
    render(<SearchBar {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search');
    expect(input).toBeInTheDocument();
  });

  test('displays "0 matches" when matchCount is 0 and searchTerm is set', () => {
    render(
      <SearchBar {...defaultProps} searchTerm="something" matchCount={0} />,
    );

    expect(screen.getByText('0 matches')).toBeInTheDocument();
  });

  test('displays match count', () => {
    render(
      <SearchBar
        {...defaultProps}
        searchTerm="test"
        matchCount={42}
      />,
    );

    expect(screen.getByText('42 matches')).toBeInTheDocument();
  });

  test('displays line count when filtered', () => {
    render(
      <SearchBar
        {...defaultProps}
        searchTerm="test"
        matchCount={42}
        isFiltered
      />,
    );

    expect(screen.getByText('42 lines')).toBeInTheDocument();
  });

  test('does not display match count when searchTerm is empty', () => {
    render(<SearchBar {...defaultProps} searchTerm="" matchCount={0} />);

    expect(screen.queryByText(/matches/)).not.toBeInTheDocument();
  });

  test('calls setSearchTerm on input change', () => {
    const setSearchTerm = jest.fn();
    render(<SearchBar {...defaultProps} setSearchTerm={setSearchTerm} />);

    const input = screen.getByPlaceholderText('Search');
    fireEvent.change(input, { target: { value: 'hello' } });

    expect(setSearchTerm).toHaveBeenCalledWith('hello');
  });

  test('Enter calls onFilter when there are matches', () => {
    const onFilter = jest.fn();
    render(
      <SearchBar {...defaultProps} matchCount={5} onFilter={onFilter} />,
    );

    const input = screen.getByPlaceholderText('Search');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onFilter).toHaveBeenCalledTimes(1);
  });

  test('Enter does not call onFilter when already filtered', () => {
    const onFilter = jest.fn();
    render(
      <SearchBar
        {...defaultProps}
        matchCount={5}
        onFilter={onFilter}
        isFiltered
      />,
    );

    const input = screen.getByPlaceholderText('Search');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onFilter).not.toHaveBeenCalled();
  });

  test('Escape calls onClearFilter when filtered', () => {
    const onClearFilter = jest.fn();
    render(
      <SearchBar
        {...defaultProps}
        onClearFilter={onClearFilter}
        isFiltered
      />,
    );

    const input = screen.getByPlaceholderText('Search');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onClearFilter).toHaveBeenCalledTimes(1);
  });

  test('filter button has active class when filtered', () => {
    render(<SearchBar {...defaultProps} isFiltered />);

    const filterBtn = screen.getByTitle('Show all lines (Escape)');
    expect(filterBtn).toHaveClass('active');
  });

  test('shows jump to top and bottom buttons', () => {
    render(<SearchBar {...defaultProps} />);

    expect(screen.getByTitle('Jump to top')).toBeInTheDocument();
    expect(screen.getByTitle('Jump to bottom')).toBeInTheDocument();
  });

  test('shows selection label and copy button when lines are highlighted', () => {
    render(<SearchBar {...defaultProps} highlight={[5, 10]} />);

    expect(screen.getByText(/Lines 5/)).toBeInTheDocument();
    expect(
      screen.getByTitle('Copy selected lines to clipboard'),
    ).toBeInTheDocument();
  });
});
