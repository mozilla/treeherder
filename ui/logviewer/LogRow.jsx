import { memo, useCallback } from 'react';
import PropTypes from 'prop-types';

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightMatches(text, searchTerm, caseInsensitive) {
  const escaped = escapeRegExp(searchTerm);
  const regex = new RegExp(`(${escaped})`, caseInsensitive ? 'gi' : 'g');
  const parts = text.split(regex);

  if (parts.length <= 1) return null;

  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="classic-log-search-highlight">
        {part}
      </mark>
    ) : (
      part || null
    ),
  );
}

const LogRow = memo(
  ({
    line,
    lineNumber,
    isHighlighted,
    isSearchMatch,
    onLineClick,
    formatLine,
    searchTerm,
    caseInsensitive,
  }) => {
    const handleClick = useCallback(
      (event) => {
        event.preventDefault();
        onLineClick(lineNumber, event.shiftKey);
      },
      [lineNumber, onLineClick],
    );

    const className = [
      'classic-log-line',
      isHighlighted && 'classic-log-highlight',
    ]
      .filter(Boolean)
      .join(' ');

    const renderContent = () => {
      if (isSearchMatch && searchTerm) {
        return highlightMatches(line, searchTerm, caseInsensitive) || line;
      }
      return formatLine ? formatLine(line) : line;
    };

    return (
      <div
        className={className}
        data-line={lineNumber}
        data-testid={`log-line-${lineNumber}`}
        onClick={handleClick}
      >
        <a className="classic-log-number" href={`#${lineNumber}`}>
          {lineNumber}
        </a>
        <span className="classic-log-text">{renderContent()}</span>
      </div>
    );
  },
);

LogRow.displayName = 'LogRow';

LogRow.propTypes = {
  index: PropTypes.number.isRequired,
  line: PropTypes.string.isRequired,
  lineNumber: PropTypes.number.isRequired,
  isHighlighted: PropTypes.bool.isRequired,
  isSearchMatch: PropTypes.bool.isRequired,
  onLineClick: PropTypes.func.isRequired,
  formatLine: PropTypes.func,
  searchTerm: PropTypes.string,
  caseInsensitive: PropTypes.bool,
};

LogRow.defaultProps = {
  formatLine: undefined,
  searchTerm: '',
  caseInsensitive: true,
};

export default LogRow;
