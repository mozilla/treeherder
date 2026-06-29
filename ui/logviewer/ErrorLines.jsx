import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretRight } from '@fortawesome/free-solid-svg-icons';

import formatLogLineWithLinks from '../helpers/logFormatting';

const ErrorLines = React.memo(
  ({ errors, onClickLine, jobDetails = [], job = null, highlight }) => (
    <div className="error-lines">
      <table>
        <tbody>
          {errors.map((error) => {
            const isSelected =
              Array.isArray(highlight) &&
              highlight.length > 0 &&
              error.lineNumber >= highlight[0] &&
              error.lineNumber <=
                (highlight.length > 1 ? highlight[1] : highlight[0]);
            return (
              <tr
                key={error.lineNumber}
                onClick={() => onClickLine([error.lineNumber])}
                className={`error-line pointable small${isSelected ? ' error-line-selected' : ''}`}
              >
                <td className="error-line-indicator">
                  {isSelected && (
                    <FontAwesomeIcon icon={faCaretRight} />
                  )}
                </td>
                <td
                  className={`badge pb-1 pe-1 rounded-0 ${isSelected ? 'text-bg-warning' : 'text-bg-secondary'}`}
                >
                  {error.lineNumber}
                </td>
                <td className="error-line-text">
                  {formatLogLineWithLinks(error.line, jobDetails, job, {
                    onLinkClick: (e) => e.stopPropagation(),
                  })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  ),
);

ErrorLines.displayName = 'ErrorLines';

ErrorLines.propTypes = {
  errors: PropTypes.arrayOf(
    PropTypes.shape({
      line: PropTypes.string.isRequired,
      lineNumber: PropTypes.number.isRequired,
    }),
  ).isRequired,
  onClickLine: PropTypes.func.isRequired,
  jobDetails: PropTypes.arrayOf(
    PropTypes.shape({
      url: PropTypes.string.isRequired,
      value: PropTypes.string.isRequired,
    }),
  ),
  job: PropTypes.shape({}),
  highlight: PropTypes.arrayOf(PropTypes.number),
};

export default ErrorLines;
