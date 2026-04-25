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
    virtuosoRef,
    scrollToLine,
  } = useLogViewer({ url, caseInsensitive });

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
    if (matchLineNumbers.length > 0) {
      setIsFiltered(true);
    }
  }, [matchLineNumbers, setIsFiltered]);

  const handleClearFilter = useCallback(() => {
    setIsFiltered(false);
  }, [setIsFiltered]);

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
    <div className="classic-log-viewer">
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
