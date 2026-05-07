import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { Virtuoso } from 'react-virtuoso';

import { useLogViewer } from './useLogViewer';
import SearchBar from './SearchBar';
import LogRow from './LogRow';
import '../css/classic-logviewer.css';

const ClassicLogViewer = ({
  url,
  formatLine,
  initialLine,
  onHighlightChange,
  errorLineNumbers,
}) => {
  const [caseInsensitive, setCaseInsensitive] = useState(true);

  const {
    lines,
    lineCount,
    isLoading,
    error,
    searchTerm,
    setSearchTerm,
    matchLineNumbers,
    isFiltered,
    setIsFiltered,
    highlight,
    setHighlight,
    onLineClick,
    copyHighlightedLines,
    handleCopy,
    handleKeyDown,
    virtuosoRef,
    scrollToLine,
    visibleRangeRef,
    setVisibleRange,
  } = useLogViewer({ url, caseInsensitive });

  // Anchor line to scroll to after a filter toggle, captured from the
  // pre-toggle viewport so a visible match stays in view across the change.
  const pendingFilterAnchorRef = useRef(null);

  // Only skip the first programmatic scroll if initialLine was set at mount
  // (meaning initialTopMostItemIndex already handled positioning).
  // If initialLine was null at mount, we must scroll when it arrives later.
  const mountedWithInitialLine = useRef(initialLine != null);

  // Dynamic scroll and highlight: when initialLine changes
  useEffect(() => {
    if (!initialLine || !lineCount) return;
    if (mountedWithInitialLine.current) {
      // First run with a line that was in the URL at mount — Virtuoso handled it
      mountedWithInitialLine.current = false;
    } else {
      scrollToLine(initialLine);
    }
    setHighlight([initialLine]);
  }, [initialLine, lineCount, scrollToLine, setHighlight]);

  const handleToggleCase = useCallback(() => {
    setCaseInsensitive((prev) => !prev);
  }, []);

  const handleFilter = useCallback(() => {
    if (matchLineNumbers.length === 0) return;

    // Capture the topmost visible match line (in unfiltered space) as anchor.
    // After the filter applies, we'll scroll to that match's index in filteredData.
    const range = visibleRangeRef.current;
    let anchorIdx = 0;
    if (range) {
      const anchorMatch = matchLineNumbers.find(
        (lineNum) => lineNum - 1 >= range.startIndex,
      );
      if (anchorMatch != null) {
        anchorIdx = matchLineNumbers.indexOf(anchorMatch);
      }
    }
    pendingFilterAnchorRef.current = { type: 'filtered', value: anchorIdx };
    setIsFiltered(true);
  }, [matchLineNumbers, setIsFiltered, visibleRangeRef]);

  const handleClearFilter = useCallback(() => {
    // Capture the topmost visible filtered row's actual line number as anchor.
    // After the filter clears, we'll scroll to that line in the unfiltered view.
    const range = visibleRangeRef.current;
    let anchorLine = null;
    if (range && matchLineNumbers.length > 0) {
      const idx = Math.max(0, range.startIndex);
      if (idx < matchLineNumbers.length) {
        anchorLine = matchLineNumbers[idx];
      }
    }
    pendingFilterAnchorRef.current =
      anchorLine != null ? { type: 'unfiltered', value: anchorLine } : null;
    setIsFiltered(false);
  }, [matchLineNumbers, setIsFiltered, visibleRangeRef]);

  // After the filter state flips, scroll to the captured anchor so the user's
  // place is preserved across the toggle.
  useEffect(() => {
    const pending = pendingFilterAnchorRef.current;
    if (!pending) return;
    pendingFilterAnchorRef.current = null;
    const targetIndex =
      pending.type === 'filtered' ? pending.value : pending.value - 1;
    requestAnimationFrame(() => {
      if (virtuosoRef.current) {
        virtuosoRef.current.scrollToIndex({
          index: targetIndex,
          align: 'start',
        });
      }
    });
  }, [isFiltered, virtuosoRef]);

  const filteredData = useMemo(() => {
    if (!isFiltered || matchLineNumbers.length === 0) return null;
    return matchLineNumbers.map((lineNum) => ({
      lineNumber: lineNum,
      line: lines[lineNum - 1] || '',
    }));
  }, [isFiltered, matchLineNumbers, lines]);

  const displayCount = filteredData ? filteredData.length : lineCount;

  // Re-run search when case sensitivity changes
  useEffect(() => {
    if (searchTerm) {
      setSearchTerm(searchTerm);
    }
  }, [caseInsensitive]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (onHighlightChange) {
      onHighlightChange(highlight);
    }
  }, [highlight, onHighlightChange]);

  const matchLineSet = useMemo(
    () => new Set(matchLineNumbers),
    [matchLineNumbers],
  );

  const itemContent = useCallback(
    (index) => {
      let lineNumber, line;
      if (filteredData) {
        lineNumber = filteredData[index].lineNumber;
        line = filteredData[index].line;
      } else {
        lineNumber = index + 1;
        line = lines[index] || '';
      }

      const isHighlighted =
        Array.isArray(highlight) &&
        highlight.length > 0 &&
        lineNumber >= highlight[0] &&
        lineNumber <= (highlight.length > 1 ? highlight[1] : highlight[0]);

      return (
        <LogRow
          index={index}
          line={line}
          lineNumber={lineNumber}
          isHighlighted={isHighlighted}
          isSearchMatch={matchLineSet.has(lineNumber)}
          onLineClick={onLineClick}
          formatLine={formatLine}
          searchTerm={searchTerm}
          caseInsensitive={caseInsensitive}
        />
      );
    },
    [
      lines,
      filteredData,
      highlight,
      matchLineSet,
      onLineClick,
      formatLine,
      searchTerm,
      caseInsensitive,
    ],
  );

  if (error) {
    return <div className="classic-log-error">Error loading log: {error}</div>;
  }

  if (isLoading) {
    return <div className="classic-log-loading">Loading log...</div>;
  }

  return (
    <div
      className="classic-log-viewer"
      onCopy={handleCopy}
      onKeyDown={handleKeyDown}
    >
      <SearchBar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        matchCount={matchLineNumbers.length}
        caseInsensitive={caseInsensitive}
        onToggleCase={handleToggleCase}
        onFilter={handleFilter}
        onClearFilter={handleClearFilter}
        isFiltered={isFiltered}
        highlight={highlight}
        copyHighlightedLines={copyHighlightedLines}
        scrollToLine={scrollToLine}
        setHighlight={setHighlight}
        lineCount={lineCount}
        errorLineNumbers={errorLineNumbers}
      />
      <Virtuoso
        ref={virtuosoRef}
        totalCount={displayCount}
        itemContent={itemContent}
        fixedItemHeight={13}
        style={{ flex: 1 }}
        overscan={200}
        rangeChanged={setVisibleRange}
        initialTopMostItemIndex={
          !isFiltered && initialLine ? Math.max(0, initialLine - 1) : 0
        }
      />
    </div>
  );
};

ClassicLogViewer.propTypes = {
  url: PropTypes.string.isRequired,
  formatLine: PropTypes.func,
  initialLine: PropTypes.number,
  onHighlightChange: PropTypes.func,
  errorLineNumbers: PropTypes.arrayOf(PropTypes.number),
};

ClassicLogViewer.defaultProps = {
  formatLine: undefined,
  initialLine: undefined,
  onHighlightChange: undefined,
  errorLineNumbers: [],
};

export default ClassicLogViewer;
