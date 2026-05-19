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
    expect(result.current.errorStatus).toBe(404);
    expect(result.current.lines).toEqual([]);
    expect(result.current.lineCount).toBe(0);
  });

  test('errorStatus is null for non-HTTP failures', async () => {
    global.fetch.mockRejectedValue(new Error('Network down'));

    const { result } = renderHook(() => useLogViewer({ url: 'http://bad.txt' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Network down');
    expect(result.current.errorStatus).toBeNull();
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

  // --- Search scroll behavior ---

  test('typing search does not scroll when a match is in the visible viewport', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('aaa\nbbb\naaa\nbbb\naaa'),
    });

    const { result } = renderHook(() => useLogViewer({ url: 'http://log.txt' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const mockScrollToIndex = jest.fn();
    result.current.virtuosoRef.current = {
      scrollToIndex: mockScrollToIndex,
    };

    // Viewport currently shows lines 3-5 (0-indexed: 2-4). Match line 3 (idx 2) is visible.
    act(() => {
      result.current.setVisibleRange({ startIndex: 2, endIndex: 4 });
    });

    act(() => {
      result.current.setSearchTerm('aaa');
    });

    expect(result.current.matchLineNumbers).toEqual([1, 3, 5]);
    // currentMatchIndex should anchor to the in-viewport match (line 3 = index 1)
    expect(result.current.currentMatchIndex).toBe(1);
    expect(mockScrollToIndex).not.toHaveBeenCalled();
  });

  test('typing search scrolls to first match when no match is in viewport', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('aaa\nbbb\nccc\nddd\neee'),
    });

    const { result } = renderHook(() => useLogViewer({ url: 'http://log.txt' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const mockScrollToIndex = jest.fn();
    result.current.virtuosoRef.current = {
      scrollToIndex: mockScrollToIndex,
    };

    // Viewport shows lines 3-5 (0-indexed: 2-4). Searching for 'aaa' (line 1) — not visible.
    act(() => {
      result.current.setVisibleRange({ startIndex: 2, endIndex: 4 });
    });

    act(() => {
      result.current.setSearchTerm('aaa');
    });

    expect(result.current.matchLineNumbers).toEqual([1]);
    expect(result.current.currentMatchIndex).toBe(0);
    expect(mockScrollToIndex).toHaveBeenCalledWith({
      index: 0,
      align: 'start',
    });
  });

  test('nextMatch scrolls to the new match line', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('aaa\nbbb\naaa\nbbb\naaa'),
    });

    const { result } = renderHook(() => useLogViewer({ url: 'http://log.txt' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const mockScrollToIndex = jest.fn();
    result.current.virtuosoRef.current = {
      scrollToIndex: mockScrollToIndex,
    };

    // Anchor search on line 3 (in viewport) so setSearchTerm doesn't scroll on its own.
    act(() => {
      result.current.setVisibleRange({ startIndex: 2, endIndex: 4 });
    });
    act(() => {
      result.current.setSearchTerm('aaa');
    });
    mockScrollToIndex.mockClear();

    act(() => {
      result.current.nextMatch();
    });

    // Anchored at index 1 (line 3) — next is index 2 (line 5)
    expect(mockScrollToIndex).toHaveBeenCalledWith({
      index: 4,
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

  // --- handleCopy (browser native copy interception) ---

  describe('handleCopy', () => {
    let container;

    // Build a fake rendered logviewer DOM matching the structure produced by
    // LogRow.jsx: a `.classic-log-viewer` container holding `.classic-log-line`
    // rows, each with an `<a class="classic-log-number">` and a
    // `<span class="classic-log-text">`.
    const buildContainer = () => {
      const root = document.createElement('div');
      root.className = 'classic-log-viewer';
      const lineTexts = sampleLog.split('\n');
      lineTexts.forEach((text, i) => {
        const row = document.createElement('div');
        row.className = 'classic-log-line';
        row.dataset.line = String(i + 1);
        const num = document.createElement('a');
        num.className = 'classic-log-number';
        num.textContent = String(i + 1);
        const span = document.createElement('span');
        span.className = 'classic-log-text';
        span.textContent = text;
        row.appendChild(num);
        row.appendChild(span);
        root.appendChild(row);
      });
      document.body.appendChild(root);
      return root;
    };

    const buildEvent = () => ({
      currentTarget: container,
      preventDefault: jest.fn(),
      clipboardData: { setData: jest.fn() },
    });

    const setSelection = ({ startEl, endEl, text, isCollapsed = false }) => {
      const range = {
        startContainer: startEl,
        endContainer: endEl,
        intersectsNode: (el) => {
          // Naive intersection: between startEl and endEl by data-line ordering
          const startRow =
            startEl?.nodeType === Node.TEXT_NODE
              ? startEl.parentElement?.closest?.('.classic-log-line')
              : startEl?.closest?.('.classic-log-line');
          const endRow =
            endEl?.nodeType === Node.TEXT_NODE
              ? endEl.parentElement?.closest?.('.classic-log-line')
              : endEl?.closest?.('.classic-log-line');
          if (!startRow || !endRow) return false;
          const a = parseInt(startRow.dataset.line, 10);
          const b = parseInt(endRow.dataset.line, 10);
          const n = parseInt(el.dataset.line, 10);
          return n >= Math.min(a, b) && n <= Math.max(a, b);
        },
      };
      jest.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed,
        toString: () => text,
        getRangeAt: () => range,
        rangeCount: isCollapsed ? 0 : 1,
      });
    };

    beforeEach(() => {
      container = buildContainer();
    });

    afterEach(() => {
      if (container?.parentNode) container.parentNode.removeChild(container);
    });

    test('overrides multi-row selection with normalized text from lines[]', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleLog),
      });
      const { result } = renderHook(() =>
        useLogViewer({ url: 'http://log.txt' }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const rows = container.querySelectorAll('.classic-log-line');
      // Selection from line 2 text → line 4 text
      setSelection({
        startEl: rows[1].querySelector('.classic-log-text').firstChild,
        endEl: rows[3].querySelector('.classic-log-text').firstChild,
        text: 'line two\nline three\nline four',
      });

      const event = buildEvent();
      result.current.handleCopy(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.clipboardData.setData).toHaveBeenCalledWith(
        'text/plain',
        'line two\nline three\nline four',
      );
    });

    test('does not override single-row partial selection (lets default fire)', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleLog),
      });
      const { result } = renderHook(() =>
        useLogViewer({ url: 'http://log.txt' }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const rows = container.querySelectorAll('.classic-log-line');
      const textNode = rows[2].querySelector('.classic-log-text').firstChild;
      // Both ends inside line 3's text span
      setSelection({ startEl: textNode, endEl: textNode, text: 'three' });

      const event = buildEvent();
      result.current.handleCopy(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(event.clipboardData.setData).not.toHaveBeenCalled();
    });

    test('does nothing on collapsed selection', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleLog),
      });
      const { result } = renderHook(() =>
        useLogViewer({ url: 'http://log.txt' }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      jest.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: true,
        toString: () => '',
        getRangeAt: () => null,
        rangeCount: 0,
      });

      const event = buildEvent();
      result.current.handleCopy(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(event.clipboardData.setData).not.toHaveBeenCalled();
    });

    test('does nothing when selection is outside log rows', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleLog),
      });
      const { result } = renderHook(() =>
        useLogViewer({ url: 'http://log.txt' }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const outside = document.createElement('p');
      outside.textContent = 'unrelated';
      document.body.appendChild(outside);

      setSelection({
        startEl: outside.firstChild,
        endEl: outside.firstChild,
        text: 'unrelated',
      });

      const event = buildEvent();
      result.current.handleCopy(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(event.clipboardData.setData).not.toHaveBeenCalled();

      outside.parentNode.removeChild(outside);
    });

    test('reversed multi-row selection still produces in-order text', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleLog),
      });
      const { result } = renderHook(() =>
        useLogViewer({ url: 'http://log.txt' }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const rows = container.querySelectorAll('.classic-log-line');
      // querySelectorAll returns rows in DOM order regardless of selection
      // direction, so the handler always derives [first row, last row].
      // intersectsNode uses min/max so reversing endpoints is still in-range.
      setSelection({
        startEl: rows[3].querySelector('.classic-log-text').firstChild,
        endEl: rows[1].querySelector('.classic-log-text').firstChild,
        text: 'line two\nline three\nline four',
      });

      const event = buildEvent();
      result.current.handleCopy(event);

      expect(event.clipboardData.setData).toHaveBeenCalledWith(
        'text/plain',
        'line two\nline three\nline four',
      );
    });
  });

  // --- handleKeyDown (Cmd/Ctrl+C fallback for off-screen highlight ranges) ---

  describe('handleKeyDown', () => {
    const buildKeyEvent = (overrides = {}) => ({
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      key: 'c',
      preventDefault: jest.fn(),
      ...overrides,
    });

    const mockEmptySelection = () =>
      jest.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: true,
        toString: () => '',
      });

    test('Cmd+C copies highlight range when no native selection', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleLog),
      });
      const { result } = renderHook(() =>
        useLogViewer({ url: 'http://log.txt' }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.onLineClick(2, false);
      });
      act(() => {
        result.current.onLineClick(4, true);
      });
      mockEmptySelection();

      const event = buildKeyEvent({ metaKey: true });
      await act(async () => {
        result.current.handleKeyDown(event);
        await Promise.resolve();
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockWriteText).toHaveBeenCalledWith(
        'line two\nline three\nline four',
      );
    });

    test('Ctrl+C also triggers copy', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleLog),
      });
      const { result } = renderHook(() =>
        useLogViewer({ url: 'http://log.txt' }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.onLineClick(1, false);
      });
      act(() => {
        result.current.onLineClick(3, true);
      });
      mockEmptySelection();

      const event = buildKeyEvent({ ctrlKey: true });
      await act(async () => {
        result.current.handleKeyDown(event);
        await Promise.resolve();
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockWriteText).toHaveBeenCalledWith(
        'line one\nline two\nline three',
      );
    });

    test('does nothing when there is a non-empty native selection', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleLog),
      });
      const { result } = renderHook(() =>
        useLogViewer({ url: 'http://log.txt' }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.onLineClick(2, false);
      });
      act(() => {
        result.current.onLineClick(4, true);
      });

      jest.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
        toString: () => 'a partial substring',
      });

      const event = buildKeyEvent({ metaKey: true });
      result.current.handleKeyDown(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(mockWriteText).not.toHaveBeenCalled();
    });

    test('does nothing when no highlight is set', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleLog),
      });
      const { result } = renderHook(() =>
        useLogViewer({ url: 'http://log.txt' }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      mockEmptySelection();

      const event = buildKeyEvent({ metaKey: true });
      result.current.handleKeyDown(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(mockWriteText).not.toHaveBeenCalled();
    });

    test('ignores keys other than C', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleLog),
      });
      const { result } = renderHook(() =>
        useLogViewer({ url: 'http://log.txt' }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.onLineClick(2, false);
      });
      mockEmptySelection();

      const event = buildKeyEvent({ metaKey: true, key: 'v' });
      result.current.handleKeyDown(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(mockWriteText).not.toHaveBeenCalled();
    });

    test('ignores Cmd+C with shift modifier', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleLog),
      });
      const { result } = renderHook(() =>
        useLogViewer({ url: 'http://log.txt' }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.onLineClick(2, false);
      });
      mockEmptySelection();

      const event = buildKeyEvent({ metaKey: true, shiftKey: true });
      result.current.handleKeyDown(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(mockWriteText).not.toHaveBeenCalled();
    });

    test('handles single-line highlight with keyboard shortcut', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleLog),
      });
      const { result } = renderHook(() =>
        useLogViewer({ url: 'http://log.txt' }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.onLineClick(3, false);
      });
      mockEmptySelection();

      const event = buildKeyEvent({ metaKey: true });
      await act(async () => {
        result.current.handleKeyDown(event);
        await Promise.resolve();
      });

      expect(mockWriteText).toHaveBeenCalledWith('line three');
    });
  });
});
