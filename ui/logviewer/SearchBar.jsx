import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCopy,
  faCheck,
  faFilter,
  faArrowsUpToLine,
  faArrowsDownToLine,
  faChevronUp,
  faChevronDown,
} from '@fortawesome/free-solid-svg-icons';

import { findNextErrorLine, findPrevErrorLine } from './logviewerHelpers';

const SearchBar = ({
  searchTerm,
  setSearchTerm,
  matchCount,
  caseInsensitive,
  onToggleCase,
  onFilter,
  onClearFilter,
  isFiltered,
  highlight,
  copyHighlightedLines,
  scrollToLine,
  setHighlight,
  lineCount,
  errorLineNumbers,
}) => {
  const [copyState, setCopyState] = useState('idle');

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!isFiltered && matchCount > 0) {
        onFilter();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (isFiltered) {
        onClearFilter();
      }
    }
  };

  const hasRange =
    Array.isArray(highlight) && highlight.length > 0 && highlight[0] > 0;
  const startLine = hasRange ? highlight[0] : null;
  const endLine = hasRange
    ? highlight.length > 1
      ? highlight[1]
      : highlight[0]
    : null;
  const selectedLineCount = hasRange ? endLine - startLine + 1 : 0;

  const handleCopy = useCallback(async () => {
    if (!hasRange || !copyHighlightedLines) return;
    setCopyState('copying');
    try {
      await copyHighlightedLines();
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 3000);
    }
  }, [hasRange, copyHighlightedLines]);

  const handleJumpToTop = useCallback(() => {
    if (scrollToLine) scrollToLine(1);
  }, [scrollToLine]);

  const handleJumpToBottom = useCallback(() => {
    if (scrollToLine && lineCount > 0) scrollToLine(lineCount);
  }, [scrollToLine, lineCount]);

  const currentLine = hasRange ? highlight[0] : 0;

  const goToErrorLine = useCallback(
    (lineNumber) => {
      scrollToLine(lineNumber);
      if (setHighlight) setHighlight([lineNumber]);
    },
    [scrollToLine, setHighlight],
  );

  const handlePrevError = useCallback(() => {
    const target = findPrevErrorLine(errorLineNumbers, currentLine);
    if (target != null) goToErrorLine(target);
  }, [errorLineNumbers, currentLine, goToErrorLine]);

  const handleNextError = useCallback(() => {
    const target = findNextErrorLine(errorLineNumbers, currentLine);
    if (target != null) goToErrorLine(target);
  }, [errorLineNumbers, currentLine, goToErrorLine]);

  const hasErrors = errorLineNumbers && errorLineNumbers.length > 0;

  const selectionLabel = hasRange
    ? selectedLineCount === 1
      ? `Line ${startLine}`
      : `Lines ${startLine}\u2013${endLine} (${selectedLineCount.toLocaleString()})`
    : null;

  const renderMatchCount = () => {
    if (!searchTerm) return null;
    if (matchCount === 0) {
      return (
        <span className="classic-log-searchbar-matches">0 matches</span>
      );
    }
    if (isFiltered) {
      return (
        <span className="classic-log-searchbar-matches">
          {matchCount} lines
        </span>
      );
    }
    return (
      <span className="classic-log-searchbar-matches">
        {matchCount} matches
      </span>
    );
  };

  return (
    <div className="classic-log-toolbar">
      <div className="classic-log-toolbar-left">
        {hasErrors && (
          <>
            <Button
              size="sm"
              variant="outline-warning"
              onClick={handlePrevError}
              title="Previous error line (P)"
            >
              <FontAwesomeIcon icon={faChevronUp} />
            </Button>
            <Button
              size="sm"
              variant="outline-warning"
              onClick={handleNextError}
              title="Next error line (N)"
            >
              <FontAwesomeIcon icon={faChevronDown} />
            </Button>
            <span className="classic-log-toolbar-separator" />
          </>
        )}
        <Button
          size="sm"
          variant="outline-light"
          onClick={handleJumpToTop}
          title="Jump to top"
        >
          <FontAwesomeIcon icon={faArrowsUpToLine} />
        </Button>
        <Button
          size="sm"
          variant="outline-light"
          onClick={handleJumpToBottom}
          title="Jump to bottom"
        >
          <FontAwesomeIcon icon={faArrowsDownToLine} />
        </Button>
        {hasRange && (
          <>
            <span className="classic-log-toolbar-separator" />
            <span className="classic-log-toolbar-label">
              {selectionLabel}
            </span>
            <Button
              size="sm"
              variant={copyState === 'copied' ? 'success' : 'outline-light'}
              onClick={handleCopy}
              disabled={copyState === 'copying'}
              title="Copy selected lines to clipboard"
            >
              <FontAwesomeIcon
                icon={copyState === 'copied' ? faCheck : faCopy}
              />
            </Button>
          </>
        )}
      </div>
      <div className="classic-log-toolbar-right">
        <input
          className="classic-log-searchbar-input"
          type="text"
          placeholder="Search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className={`classic-log-toolbar-filter-btn${isFiltered ? ' active' : ''}`}
          onClick={isFiltered ? onClearFilter : onFilter}
          disabled={!isFiltered && matchCount === 0}
          title={isFiltered ? 'Show all lines (Escape)' : 'Filter to matching lines (Enter)'}
        >
          <FontAwesomeIcon icon={faFilter} />
        </button>
        {renderMatchCount()}
        <button
          type="button"
          className={`classic-log-searchbar-case${caseInsensitive ? '' : ' active'}`}
          onClick={onToggleCase}
          title={caseInsensitive ? 'Case insensitive' : 'Case sensitive'}
        >
          Aa
        </button>
      </div>
    </div>
  );
};

SearchBar.propTypes = {
  searchTerm: PropTypes.string.isRequired,
  setSearchTerm: PropTypes.func.isRequired,
  matchCount: PropTypes.number.isRequired,
  caseInsensitive: PropTypes.bool.isRequired,
  onToggleCase: PropTypes.func.isRequired,
  onFilter: PropTypes.func.isRequired,
  onClearFilter: PropTypes.func.isRequired,
  isFiltered: PropTypes.bool.isRequired,
  highlight: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.number),
    PropTypes.number,
  ]),
  copyHighlightedLines: PropTypes.func,
  scrollToLine: PropTypes.func,
  setHighlight: PropTypes.func,
  lineCount: PropTypes.number,
  errorLineNumbers: PropTypes.arrayOf(PropTypes.number),
};

export default SearchBar;
