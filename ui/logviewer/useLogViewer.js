import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

/**
 * Core hook for log viewing. Handles fetching, parsing, search, line selection,
 * scroll, and copy operations.
 *
 * @param {Object} params
 * @param {string} [params.url] - URL of the log file to fetch
 * @param {boolean} [params.caseInsensitive=true] - Whether search is case-insensitive
 * @returns {Object} Log viewer state and actions
 */
export function useLogViewer({ url, caseInsensitive = true } = {}) {
  const [lines, setLines] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTermState] = useState('');
  const [matchLineNumbers, setMatchLineNumbers] = useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [isFiltered, setIsFiltered] = useState(false);

  const [highlight, setHighlight] = useState(null);

  const virtuosoRef = useRef(null);
  // Track the anchor line for shift-click range selection
  const anchorLineRef = useRef(null);

  // --- Fetch + Parse ---

  useEffect(() => {
    if (!url) {
      setLines([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to fetch log: ${response.status} ${response.statusText}`,
          );
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
      setCurrentMatchIndex(matches.length > 0 ? 0 : -1);
    },
    [lines, caseInsensitive],
  );

  const nextMatch = useCallback(() => {
    if (matchLineNumbers.length === 0) return;
    setCurrentMatchIndex(
      (prev) => (prev + 1) % matchLineNumbers.length,
    );
  }, [matchLineNumbers]);

  const prevMatch = useCallback(() => {
    if (matchLineNumbers.length === 0) return;
    setCurrentMatchIndex(
      (prev) =>
        (prev - 1 + matchLineNumbers.length) % matchLineNumbers.length,
    );
  }, [matchLineNumbers]);

  // Scroll to current search match when navigating matches
  useEffect(() => {
    if (
      currentMatchIndex >= 0 &&
      currentMatchIndex < matchLineNumbers.length &&
      virtuosoRef.current
    ) {
      const lineNumber = matchLineNumbers[currentMatchIndex];
      virtuosoRef.current.scrollToIndex({
        index: lineNumber - 1,
        align: 'start',
      });
    }
  }, [currentMatchIndex, matchLineNumbers]);

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

  // --- Scroll ---

  const scrollToLine = useCallback((lineNumber) => {
    if (virtuosoRef.current) {
      virtuosoRef.current.scrollToIndex({
        index: lineNumber - 1,
        align: 'start',
      });
    }
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

  return useMemo(
    () => ({
      // Data
      lines,
      lineCount,
      isLoading,
      error,
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
      // Copy
      copyHighlightedLines,
    }),
    [
      lines,
      lineCount,
      isLoading,
      error,
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
      copyHighlightedLines,
    ],
  );
}
