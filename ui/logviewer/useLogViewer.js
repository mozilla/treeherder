import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

/**
 * Core hook for log viewing. Handles fetching, parsing, search, line selection,
 * scroll, and copy operations.
 *
 * @param {Object} params
 * @param {string} [params.url] - URL of the log file to fetch
 * @param {boolean} [params.caseInsensitive=true] - Whether search is case-insensitive
 * @param {number[]|null} [params.initialHighlight=null] - Initial highlight ([line] or [start, end])
 * @returns {Object} Log viewer state and actions
 */
export function useLogViewer({
  url,
  caseInsensitive = true,
  initialHighlight = null,
} = {}) {
  const [lines, setLines] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);

  const [searchTerm, setSearchTermState] = useState('');
  const [matchLineNumbers, setMatchLineNumbers] = useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [isFiltered, setIsFiltered] = useState(false);

  const [highlight, setHighlight] = useState(initialHighlight);

  const virtuosoRef = useRef(null);
  // Track the anchor line for shift-click range selection
  const anchorLineRef = useRef(null);
  // Track the currently visible range of Virtuoso indices (0-indexed)
  const visibleRangeRef = useRef(null);

  const setVisibleRange = useCallback((range) => {
    visibleRangeRef.current = range;
  }, []);

  // --- Fetch + Parse ---

  useEffect(() => {
    if (!url) {
      setLines([]);
      setIsLoading(false);
      setError(null);
      setErrorStatus(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setErrorStatus(null);

    fetch(url)
      .then((response) => {
        if (!response.ok) {
          const err = new Error(
            `Failed to fetch log: ${response.status} ${response.statusText}`,
          );
          err.status = response.status;
          throw err;
        }
        return response.text();
      })
      .then((text) => {
        if (cancelled) return;
        const parsed = text.split('\n');
        setLines(parsed);
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setErrorStatus(err.status ?? null);
        setLines([]);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  // --- Derived ---

  const lineCount = lines.length;

  // --- Search ---

  const scrollToLine = useCallback((lineNumber) => {
    if (virtuosoRef.current) {
      virtuosoRef.current.scrollToIndex({
        index: lineNumber - 1,
        align: 'start',
      });
    }
  }, []);

  const setSearchTerm = useCallback(
    (term) => {
      setSearchTermState(term);

      if (!term) {
        setMatchLineNumbers([]);
        setCurrentMatchIndex(-1);
        setIsFiltered(false);
        return;
      }

      const matches = [];
      const searchValue = caseInsensitive ? term.toLowerCase() : term;

      for (let i = 0; i < lines.length; i++) {
        const lineValue = caseInsensitive ? lines[i].toLowerCase() : lines[i];
        if (lineValue.indexOf(searchValue) !== -1) {
          // 1-indexed line numbers
          matches.push(i + 1);
        }
      }

      setMatchLineNumbers(matches);

      if (matches.length === 0) {
        setCurrentMatchIndex(-1);
        return;
      }

      // If a match is already in the visible viewport, anchor to it instead of
      // scrolling to the first match. Only scroll when nothing on screen matches.
      const range = visibleRangeRef.current;
      const visibleMatchIdx = range
        ? matches.findIndex(
            (lineNum) =>
              lineNum - 1 >= range.startIndex && lineNum - 1 <= range.endIndex,
          )
        : -1;

      if (visibleMatchIdx !== -1) {
        setCurrentMatchIndex(visibleMatchIdx);
      } else {
        setCurrentMatchIndex(0);
        scrollToLine(matches[0]);
      }
    },
    [lines, caseInsensitive, scrollToLine],
  );

  const nextMatch = useCallback(() => {
    if (matchLineNumbers.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % matchLineNumbers.length;
    setCurrentMatchIndex(nextIdx);
    scrollToLine(matchLineNumbers[nextIdx]);
  }, [matchLineNumbers, currentMatchIndex, scrollToLine]);

  const prevMatch = useCallback(() => {
    if (matchLineNumbers.length === 0) return;
    const prevIdx =
      (currentMatchIndex - 1 + matchLineNumbers.length) %
      matchLineNumbers.length;
    setCurrentMatchIndex(prevIdx);
    scrollToLine(matchLineNumbers[prevIdx]);
  }, [matchLineNumbers, currentMatchIndex, scrollToLine]);

  // --- Selection ---

  const onLineClick = useCallback(
    (lineNumber, shiftKey) => {
      if (shiftKey && anchorLineRef.current != null) {
        const start = Math.min(anchorLineRef.current, lineNumber);
        const end = Math.max(anchorLineRef.current, lineNumber);
        setHighlight([start, end]);
      } else {
        anchorLineRef.current = lineNumber;
        setHighlight([lineNumber]);
      }
    },
    [],
  );

  const clearHighlight = useCallback(() => {
    setHighlight(null);
    anchorLineRef.current = null;
  }, []);

  // --- Copy ---

  const copyHighlightedLines = useCallback(async () => {
    if (!highlight || highlight.length === 0) return;

    const start = highlight[0];
    const end = highlight.length > 1 ? highlight[1] : start;

    // highlight is 1-indexed, lines array is 0-indexed
    const selectedLines = lines.slice(start - 1, end);
    const text = selectedLines.join('\n');

    await navigator.clipboard.writeText(text);
  }, [highlight, lines]);

  // Override the browser's native copy when the selection spans multiple log
  // rows. Building the text from `lines[]` instead of from DOM serialization
  // gives us clean LF-only line endings (no extra blank lines on Windows from
  // CRLF + the `display:flex`/`white-space:pre` quirk in Chromium's clipboard
  // writer) and works correctly for any rows still in the rendered DOM.
  // Single-line partial selections fall through to default behavior so
  // substring copy still works.
  const handleCopy = useCallback(
    (event) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.toString().length === 0) return;

      const range = sel.getRangeAt(0);
      const getLineEl = (node) => {
        const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        return el?.closest?.('.classic-log-line') ?? null;
      };
      const startLineEl = getLineEl(range.startContainer);
      const endLineEl = getLineEl(range.endContainer);

      // Selection doesn't touch any log row
      if (!startLineEl && !endLineEl) return;
      // Single-row partial selection — let default copy fire
      if (startLineEl && startLineEl === endLineEl) return;

      const container = event.currentTarget;
      const lineEls = container.querySelectorAll('.classic-log-line');
      const inSelection = Array.from(lineEls).filter((el) =>
        range.intersectsNode(el),
      );
      if (inSelection.length === 0) return;

      const startLine = parseInt(inSelection[0].dataset.line, 10);
      const endLine = parseInt(
        inSelection[inSelection.length - 1].dataset.line,
        10,
      );
      if (!startLine || !endLine) return;

      const text = lines.slice(startLine - 1, endLine).join('\n');
      event.preventDefault();
      event.clipboardData.setData('text/plain', text);
    },
    [lines],
  );

  // Cmd/Ctrl+C fallback for the off-screen case: shift-click sets
  // `highlight = [start, end]` without creating a native browser selection,
  // so the browser would otherwise fire no `copy` event at all. When there's
  // no native selection but a highlight range exists, copy from `lines[]`.
  const handleKeyDown = useCallback(
    (event) => {
      const isCopyKey =
        (event.metaKey || event.ctrlKey) &&
        event.key === 'c' &&
        !event.shiftKey &&
        !event.altKey;
      if (!isCopyKey) return;
      if (!highlight || highlight.length === 0) return;

      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().length > 0) return;

      event.preventDefault();
      copyHighlightedLines();
    },
    [highlight, copyHighlightedLines],
  );

  return useMemo(
    () => ({
      // Data
      lines,
      lineCount,
      isLoading,
      error,
      errorStatus,
      // Search
      searchTerm,
      setSearchTerm,
      matchLineNumbers,
      currentMatchIndex,
      nextMatch,
      prevMatch,
      // Filter
      isFiltered,
      setIsFiltered,
      // Selection
      highlight,
      setHighlight,
      onLineClick,
      clearHighlight,
      // Scroll
      virtuosoRef,
      scrollToLine,
      visibleRangeRef,
      setVisibleRange,
      // Copy
      copyHighlightedLines,
      handleCopy,
      handleKeyDown,
    }),
    [
      lines,
      lineCount,
      isLoading,
      error,
      errorStatus,
      searchTerm,
      setSearchTerm,
      matchLineNumbers,
      currentMatchIndex,
      nextMatch,
      prevMatch,
      isFiltered,
      highlight,
      onLineClick,
      clearHighlight,
      scrollToLine,
      setVisibleRange,
      copyHighlightedLines,
      handleCopy,
      handleKeyDown,
    ],
  );
}
