import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Button, FormGroup, Label, Input } from 'reactstrap';
import Select from 'react-select';
import Highlighter from 'react-highlight-words';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar } from '@fortawesome/free-regular-svg-icons';
import { faBug, faThumbtack } from '@fortawesome/free-solid-svg-icons';

import { getSearchWords } from '../../../../helpers/display';
import { isReftest } from '../../../../helpers/job';
import {
  getBugUrl,
  getLogViewerUrl,
  getReftestUrl,
} from '../../../../helpers/url';
import BugFiler from '../../BugFiler';
import { thEvents } from '../../../../helpers/constants';
import { getAllUrlParams } from '../../../../helpers/location';
import { withPinnedJobs } from '../../../context/PinnedJobs';

/**
 * Editable option
 */
class LineOption extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isBugFilerOpen: false,
      repoName: getAllUrlParams().repo,
    };
  }

  fileBug = () => {
    const { selectedOption, optionModel } = this.props;

    selectedOption.id = optionModel.id;
    this.setState({ isBugFilerOpen: true });
  };

  toggleBugFiler = () => {
    this.setState(prevState => ({ isBugFilerOpen: !prevState.isBugFilerOpen }));
  };

  bugFilerCallback = data => {
    const { addBug, onManualBugNumberChange, optionModel } = this.props;
    const bugId = data.success;

    addBug({ id: bugId });
    window.dispatchEvent(new CustomEvent(thEvents.saveClassification));
    // Open the newly filed bug in a new tab or window for further editing
    window.open(getBugUrl(bugId));
    onManualBugNumberChange(optionModel, `${bugId}`);
  };

  render() {
    const {
      selectedJob,
      errorLine,
      optionModel,
      selectedOption,
      canClassify,
      onOptionChange,
      onIgnoreAlwaysChange,
      ignoreAlways,
      manualBugNumber,
      onManualBugNumberChange,
      pinnedJobs,
      addBug,
    } = this.props;
    const { isBugFilerOpen, repoName } = this.state;
    const option = optionModel;
    let logUrl;

    if (selectedJob.logs) {
      logUrl = selectedJob.logs.filter(x => x.name.endsWith('_json'));
      logUrl = logUrl[0] ? logUrl[0].url : selectedJob.logs[0].url;
    }

    return (
      <div className="classification-option">
        <span className="classification-icon">
          {option.isBest ? (
            <FontAwesomeIcon icon={faStar} title="Autoclassifier best match" />
          ) : (
            <span className="classification-no-icon">&nbsp;</span>
          )}
        </span>

        <FormGroup check>
          <Label check>
            {!(option.type === 'classifiedFailure' && !option.bugNumber) && (
              <Input
                type="radio"
                value={option}
                id={option.id}
                checked={selectedOption.id === option.id}
                name={errorLine.id}
                onChange={() => onOptionChange(option)}
                className={canClassify ? '' : 'hidden'}
              />
            )}
            {!!option.bugNumber && (
              <span className="line-option-text">
                {(!canClassify || selectedJob.id in pinnedJobs) && (
                  <Button
                    className="btn btn-xs btn-light-bordered"
                    onClick={() =>
                      addBug({ id: option.bugNumber }, selectedJob)
                    }
                    title="add to list of bugs to associate with all pinned jobs"
                  >
                    <FontAwesomeIcon icon={faThumbtack} title="Select bug" />
                  </Button>
                )}
                {!!option.bugResolution && (
                  <span className="classification-bug-resolution">
                    {' '}
                    [{option.bugResolution}]{' '}
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
                <span>
                  {' '}
                  [ {Number.parseFloat(option.score).toPrecision(2)} ]
                </span>
              </span>
            )}

            {option.type === 'classifiedFailure' && !option.bugNumber && (
              <span>Autoclassified failure with no associated bug number</span>
            )}

            {option.type === 'manual' && (
              <div
                className={`line-option-text manual-bug ${
                  !canClassify ? 'hidden' : ''
                }`}
              >
                Other bug:
                <Input
                  className="manual-bug-input"
                  id={`${errorLine.id}-manual-bug`}
                  type="text"
                  size="7"
                  placeholder="Number"
                  value={manualBugNumber}
                  onChange={evt =>
                    onManualBugNumberChange(option, evt.target.value)
                  }
                />
                <Button
                  className="btn btn-xs btn-light-bordered btn-file-bug"
                  onClick={() => this.fileBug()}
                  title="File a bug for this failure"
                >
                  <FontAwesomeIcon icon={faBug} title="Select bug" />
                </Button>
                {option.id === 'manual' && !!option.manualBugNumber && (
                  <a
                    href={getBugUrl(option.manualBugNumber)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    [view]
                  </a>
                )}
              </div>
            )}

            {option.type === 'ignore' && (
              <span
                className={`line-option-text ignore ${
                  canClassify ? '' : 'hidden'
                }`}
              >
                Ignore line
                <Select
                  value={ignoreAlways}
                  clearable={false}
                  classNamePrefix="ignore-option"
                  onChange={onIgnoreAlwaysChange}
                  bsSize="small"
                  options={[
                    { value: false, label: 'Here only' },
                    { value: true, label: 'For future classifications' },
                  ]}
                />
              </span>
            )}
          </Label>
        </FormGroup>

        {option.type === 'classifiedFailure' && (
          <div className="classification-matchers">
            Matched by:
            {option.matches &&
              option.matches.map(match => (
                <span key={match.matcher_name}>
                  {match.matcher_name} ({match.score})
                </span>
              ))}
          </div>
        )}
        {isBugFilerOpen && (
          <BugFiler
            isOpen={isBugFilerOpen}
            toggle={this.toggleBugFiler}
            suggestion={errorLine.data.bug_suggestions}
            suggestions={[errorLine.data.bug_suggestions]}
            fullLog={logUrl}
            parsedLog={`${window.location.origin}/${getLogViewerUrl(
              selectedJob.id,
              repoName,
            )}`}
            reftestUrl={isReftest(selectedJob) ? getReftestUrl(logUrl) : ''}
            successCallback={this.bugFilerCallback}
            jobGroupName={selectedJob.job_group_name}
          />
        )}
      </div>
    );
  }
}

LineOption.propTypes = {
  selectedJob: PropTypes.object.isRequired,
  errorLine: PropTypes.object.isRequired,
  optionModel: PropTypes.object.isRequired,
  canClassify: PropTypes.bool.isRequired,
  ignoreAlways: PropTypes.bool.isRequired,
  selectedOption: PropTypes.object.isRequired,
  onOptionChange: PropTypes.func.isRequired,
  pinnedJobs: PropTypes.object.isRequired,
  addBug: PropTypes.func.isRequired,
  onIgnoreAlwaysChange: PropTypes.func,
  onManualBugNumberChange: PropTypes.func,
  manualBugNumber: PropTypes.number,
};

LineOption.defaultProps = {
  onManualBugNumberChange: null,
  onIgnoreAlwaysChange: null,
  manualBugNumber: undefined,
};

const mapStateToProps = ({ selectedJob: { selectedJob } }) => ({ selectedJob });

export default connect(mapStateToProps)(withPinnedJobs(LineOption));
