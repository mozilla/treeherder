import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Button } from 'reactstrap';
import Highlighter from 'react-highlight-words';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar } from '@fortawesome/free-regular-svg-icons';
import { faThumbtack } from '@fortawesome/free-solid-svg-icons';

import { getSearchWords } from '../../../../helpers/display';
import { getBugUrl } from '../../../../helpers/url';
import { withPinnedJobs } from '../../../context/PinnedJobs';

/**
 * Non-editable best option
 */
function StaticLineOption(props) {
  const {
    selectedJob,
    canClassify,
    errorLine,
    option,
    numOptions,
    setEditable,
    ignoreAlways,
    manualBugNumber,
    pinnedJobs,
    addBug,
  } = props;

  const optionCount = numOptions - 1;
  const ignoreAlwaysText = ignoreAlways
    ? 'for future classifications'
    : 'here only';

  return (
    <div className="static-classification-option">
      <div className="classification-icon">
        {option.isBest ? (
          <FontAwesomeIcon icon={faStar} title="Autoclassifier best match" />
        ) : (
          <span className="classification-no-icon">&nbsp;</span>
        )}
      </div>

      {!!option.bugNumber && (
        <span className="line-option-text">
          {(!canClassify || selectedJob.id in pinnedJobs) && (
            <Button
              className="btn btn-xs btn-light-bordered"
              onClick={() => addBug({ id: option.bugNumber }, selectedJob)}
              title="add to list of bugs to associate with all pinned jobs"
            >
              <FontAwesomeIcon icon={faThumbtack} title="Select bug" />
            </Button>
          )}
          {!!option.bugResolution && (
            <span className="classification-bug-resolution">
              [{option.bugResolution}]
            </span>
          )}
          <a
            href={getBugUrl(option.bugNumber)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {option.bugNumber} -
            <Highlighter
              searchWords={getSearchWords(
                errorLine.data.bug_suggestions.search,
              )}
              textToHighlight={option.bugSummary}
              caseSensitive
              highlightTag="strong"
            />
          </a>
          <span>[ {Number.parseFloat(option.score).toPrecision(2)} ]</span>
        </span>
      )}

      {option.type === 'classifiedFailure' && !option.bugNumber && (
        <span>Autoclassified failure with no associated bug number</span>
      )}

      {option.type === 'manual' && (
        <span className="line-option-text">
          Bug
          {!!manualBugNumber && (
            <a
              href={getBugUrl(option.manualBugNumber)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {manualBugNumber}
            </a>
          )}
          {!!manualBugNumber && <span>No bug number specified</span>}
        </span>
      )}

      {option.type === 'ignore' && (
        <span className="line-option-text">Ignore {ignoreAlwaysText}</span>
      )}
      {optionCount > 0 && (
        <span>
          , {optionCount} other {optionCount === 1 ? 'option' : 'options'}
        </span>
      )}
      <div>
        <Button onClick={setEditable} className="link-style">
          Edit…
        </Button>
      </div>
    </div>
  );
}

StaticLineOption.propTypes = {
  selectedJob: PropTypes.object.isRequired,
  errorLine: PropTypes.object.isRequired,
  option: PropTypes.object.isRequired,
  numOptions: PropTypes.number.isRequired,
  ignoreAlways: PropTypes.bool.isRequired,
  canClassify: PropTypes.bool.isRequired,
  setEditable: PropTypes.func.isRequired,
  pinnedJobs: PropTypes.object.isRequired,
  addBug: PropTypes.func.isRequired,
  manualBugNumber: PropTypes.number,
};

StaticLineOption.defaultProps = {
  manualBugNumber: undefined,
};

const mapStateToProps = ({ selectedJob: { selectedJob } }) => ({ selectedJob });

export default connect(mapStateToProps)(withPinnedJobs(StaticLineOption));
