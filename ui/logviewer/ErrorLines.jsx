import React from 'react';
import PropTypes from 'prop-types';

import formatLogLineWithLinks from '../helpers/logFormatting';

export default class ErrorLines extends React.PureComponent {
  render() {
    const { errors, onClickLine, jobDetails, job } = this.props;

    return (
      <div className="error-lines">
        <table>
          <tbody>
            {errors.map((error) => (
              <tr
                key={error.lineNumber}
                onClick={() => onClickLine([error.lineNumber], true)}
                className="error-line pointable small"
              >
                <td className="badge badge-secondary pb-1 pr-1 rounded-0">
                  {error.lineNumber}
                </td>
                <td className="error-line-text">
                  {formatLogLineWithLinks(error.line, jobDetails, job, {
                    onLinkClick: (e) => e.stopPropagation(),
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}

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
};

ErrorLines.defaultProps = {
  jobDetails: [],
  job: null,
};
