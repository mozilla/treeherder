import { renderHook, act, waitFor } from '@testing-library/react';

import { useLogViewer } from '../../../ui/logviewer/useLogViewer';

// Mock clipboard API
const mockWriteText = jest.fn().mockResolvedValue(undefined);
Object.assign(navigator, {
  clipboard: { writeText: mockWriteText },
});

const sampleLog = 'line one\nline two\nline three\nline four\nline five';

describe('useLogViewer', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockWriteText.mockClear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  // --- Fetching ---

  test('fetches URL and splits into lines', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleLog),
    });

    const { result } = renderHook(() => useLogViewer({ url: 'http://log.txt' }));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.lines).toEqual([
      'line one',
      'line two',
      'line three',
      'line four',
      'line five',
    ]);
    expect(result.current.lineCount).toBe(5);
    expect(result.current.error).toBeNull();
  });

  test('sets error on fetch failure', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const { result } = renderHook(() => useLogViewer({ url: 'http://bad.txt' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Failed to fetch log: 404 Not Found');
    expect(result.current.lines).toEqual([]);
    expect(result.current.lineCount).toBe(0);
  });

  test('returns empty state when no URL', () => {
    const { result } = renderHook(() => useLogViewer({}));

    expect(result.current.lines).toEqual([]);
    expect(result.current.lineCount).toBe(0);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  // --- Search ---

  test('search finds matches case-insensitively by default', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('Hello World\nhello again\nGOODBYE'),
    });

    const { result } = renderHook(() => useLogViewer({ url: 'http://log.txt' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setSearchTerm('hello');
    });

    expect(result.current.matchLineNumbers).toEqual([1, 2]);
    expect(result.current.currentMatchIndex).toBe(0);
  });

  test('search finds matches case-sensitively when option set', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('Hello World\nhello again\nGOODBYE'),
    });

    const { result } = renderHook(() =>
      useLogViewer({ url: 'http://log.txt', caseInsensitive: false }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setSearchTerm('hello');
    });

    // Only the second line matches (lowercase 'hello')
    expect(result.current.matchLineNumbers).toEqual([2]);
    expect(result.current.currentMatchIndex).toBe(0);
  });

  test('nextMatch and prevMatch cycle and wrap around', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve('aaa\nbbb\naaa\nbbb\naaa'),
    });

    const { result } = renderHook(() => useLogViewer({ url: 'http://log.txt' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setSearchTerm('aaa');
    });

    expect(result.current.matchLineNumbers).toEqual([1, 3, 5]);
    expect(result.current.currentMatchIndex).toBe(0);

    // nextMatch cycles forward
    act(() => {
      result.current.nextMatch();
    });
    expect(result.current.currentMatchIndex).toBe(1);

    act(() => {
      result.current.nextMatch();
    });
    expect(result.current.currentMatchIndex).toBe(2);

    // Wrap around to beginning
    act(() => {
      result.current.nextMatch();
    });
    expect(result.current.currentMatchIndex).toBe(0);

    // prevMatch wraps to end
    act(() => {
      result.current.prevMatch();
    });
    expect(result.current.currentMatchIndex).toBe(2);

    // prevMatch goes backwards
    act(() => {
      result.current.prevMatch();
    });
    expect(result.current.currentMatchIndex).toBe(1);
  });

  test('empty search returns no matches', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleLog),
    });

    const { result } = renderHook(() => useLogViewer({ url: 'http://log.txt' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setSearchTerm('');
    });

    expect(result.current.matchLineNumbers).toEqual([]);
    expect(result.current.currentMatchIndex).toBe(-1);
  });

  // --- Selection ---

  test('single click sets highlight to [lineNumber]', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleLog),
    });

    const { result } = renderHook(() => useLogViewer({ url: 'http://log.txt' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.onLineClick(3, false);
    });

    expect(result.current.highlight).toEqual([3]);
  });

  test('shift-click sets [start, end] range', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleLog),
    });

    const { result } = renderHook(() => useLogViewer({ url: 'http://log.txt' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // First click to set anchor
    act(() => {
      result.current.onLineClick(2, false);
    });
    expect(result.current.highlight).toEqual([2]);

    // Shift-click to extend selection
    act(() => {
      result.current.onLineClick(4, true);
    });
    expect(result.current.highlight).toEqual([2, 4]);
  });

  test('reversed shift-click produces [min, max]', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleLog),
    });

    const { result } = renderHook(() => useLogViewer({ url: 'http://log.txt' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Click line 4 first
    act(() => {
      result.current.onLineClick(4, false);
    });

    // Shift-click line 2 (reversed)
    act(() => {
      result.current.onLineClick(2, true);
    });

    expect(result.current.highlight).toEqual([2, 4]);
  });

  test('clearHighlight resets highlight', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleLog),
    });

    const { result } = renderHook(() => useLogViewer({ url: 'http://log.txt' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.onLineClick(3, false);
    });
    expect(result.current.highlight).toEqual([3]);

    act(() => {
      result.current.clearHighlight();
    });
    expect(result.current.highlight).toBeNull();
  });

  // --- Scroll ---

  test('scrollToLine calls virtuosoRef.current.scrollToIndex', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleLog),
    });

    const { result } = renderHook(() => useLogViewer({ url: 'http://log.txt' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Attach a mock to the virtuosoRef
    const mockScrollToIndex = jest.fn();
    result.current.virtuosoRef.current = {
      scrollToIndex: mockScrollToIndex,
    };

    act(() => {
      result.current.scrollToLine(10);
    });

    expect(mockScrollToIndex).toHaveBeenCalledWith({
      index: 9,
      align: 'start',
    });
  });

  // --- Copy ---

  test('copyHighlightedLines extracts correct range and writes to clipboard', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleLog),
    });

    const { result } = renderHook(() => useLogViewer({ url: 'http://log.txt' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Select a range
    act(() => {
      result.current.onLineClick(2, false);
    });
    act(() => {
      result.current.onLineClick(4, true);
    });
    expect(result.current.highlight).toEqual([2, 4]);

    await act(async () => {
      await result.current.copyHighlightedLines();
    });

    expect(mockWriteText).toHaveBeenCalledWith(
      'line two\nline three\nline four',
    );
  });

  test('copyHighlightedLines handles single line highlight', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleLog),
    });

    const { result } = renderHook(() => useLogViewer({ url: 'http://log.txt' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.onLineClick(3, false);
    });

    await act(async () => {
      await result.current.copyHighlightedLines();
    });

    expect(mockWriteText).toHaveBeenCalledWith('line three');
  });
});
