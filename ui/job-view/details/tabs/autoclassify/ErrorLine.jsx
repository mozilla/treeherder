import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Button, FormGroup } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretDown,
  faCaretRight,
  faStar,
} from '@fortawesome/free-solid-svg-icons';

import { thEvents } from '../../../../helpers/constants';
import {
  stringOverlap,
  highlightLogLine,
} from '../../../../helpers/autoclassify';
import { getBugUrl, getLogViewerUrl } from '../../../../helpers/url';

import LineOption from './LineOption';
import LineOptionModel from './LineOptionModel';
import StaticLineOption from './StaticLineOption';

const GOOD_MATCH_SCORE = 0.75;
const BAD_MATCH_SCORE = 0.25;

class ErrorLine extends React.Component {
  constructor(props) {
    super(props);

    const { errorLine, setEditable } = this.props;

    this.bestOption = null;

    let options = [];
    let extraOptions = [];
    let selectedOption = null;

    if (!errorLine.verified) {
      options = this.getOptions();
      extraOptions = this.getExtraOptions(options);
      const allOptions = options.concat(extraOptions);
      this.optionsById = allOptions.reduce((byId, option) => {
        byId.set(option.id, option);
        return byId;
      }, new Map());
      selectedOption = this.getDefaultOption(options, extraOptions);
      this.initOption(selectedOption);
    }

    if (this.defaultEditable(selectedOption)) {
      setEditable([errorLine.id], true);
    }

    this.state = {
      messageExpanded: false,
      showHidden: false,
      options,
      extraOptions,
      selectedOption,
    };
  }

  componentDidMount() {
    window.addEventListener(thEvents.autoclassifyIgnore, this.onEventIgnore);
  }

  componentWillUnmount() {
    window.removeEventListener(thEvents.autoclassifyIgnore, this.onEventIgnore);
  }

  /**
   * Select the ignore option, and toggle the ignoreAlways setting if it's
   * already selected
   */
  onEventIgnore = () => {
    const { isSelected, errorLine } = this.props;
    const { selectedOption } = this.state;
    const id = `${errorLine.id}-ignore`;

    if (!isSelected) {
      return;
    }
    if (id !== selectedOption.id) {
      const newSelectedOption = this.optionsById.get(id);
      this.onOptionChange(newSelectedOption);
    } else {
      selectedOption.ignoreAlways = !selectedOption.ignoreAlways;
      this.onOptionChange(selectedOption);
    }
  };

  /**
   * Update data about the currently selected option in response to
   * a selection in the UI
   */
  onOptionChange = option => {
    this.initOption(option);
    this.setState({ selectedOption: { ...option } });
  };

  onManualBugNumberChange = (option, bugNumber) => {
    // ensure numbers only
    const digits = bugNumber.replace(/\D/, '');

    if (digits) {
      option.manualBugNumber = parseInt(digits, 10);
    }
    this.onOptionChange(option);
  };

  onIgnoreAlwaysChange(option, newValue) {
    option.ignoreAlways = newValue.value;
    this.onOptionChange(option);
  }

  getStatus() {
    const { selectedOption } = this.state;
    const { errorLine } = this.props;

    if (!selectedOption) {
      return;
    }

    if (!this.canClassify) {
      return 'classification-disabled';
    }

    if (errorLine.verified) {
      return 'verified';
    }

    if (selectedOption.type === 'ignore') {
      return 'unverified-ignore';
    }

    if (selectedOption.type === 'manual' && !selectedOption.manualBugNumber) {
      return 'unverified-no-bug';
    }

    return 'unverified';
  }

  /**
   * Build a list of options applicable to the current line.
   */
  getOptions() {
    const { errorLine } = this.props;
    const bugSuggestions = [].concat(
      errorLine.data.bug_suggestions.bugs.open_recent,
      errorLine.data.bug_suggestions.bugs.all_others,
    );
    const classificationMatches = this.getClassifiedFailureMatcher();
    const autoclassifyOptions = errorLine.data.classified_failures
      .filter(cf => cf.bug_number !== 0)
      .map(
        cf =>
          new LineOptionModel(
            'classifiedFailure',
            `${errorLine.id}-${cf.id}`,
            cf.id,
            cf.bug_number,
            cf.bug ? cf.bug.summary : '',
            cf.bug ? cf.bug.resolution : '',
            classificationMatches(cf.id),
          ),
      );
    const autoclassifiedBugs = autoclassifyOptions.reduce(
      (classifiedBugs, option) => classifiedBugs.add(option.bugNumber),
      new Set(),
    );
    const bugSuggestionOptions = bugSuggestions
      .filter(bug => !autoclassifiedBugs.has(bug.id))
      .map(
        bugSuggestion =>
          new LineOptionModel(
            'unstructuredBug',
            `${errorLine.id}-ub-${bugSuggestion.id}`,
            null,
            bugSuggestion.id,
            bugSuggestion.summary,
            bugSuggestion.resolution,
          ),
      );

    this.bestOption = null;

    // Look for an option that has been marked as the best classification.
    // This is always sorted first and never hidden, so we remove it and readd it.
    if (!this.bestIsIgnore()) {
      const bestIndex = errorLine.bestClassification
        ? autoclassifyOptions.findIndex(
            option =>
              option.classifiedFailureId === errorLine.bestClassification.id,
          )
        : -1;

      if (bestIndex > -1) {
        this.bestOption = autoclassifyOptions[bestIndex];
        this.bestOption.isBest = true;
        autoclassifyOptions.splice(bestIndex, 1);
        this.scoreOptions([this.bestOption]);
      }
    }

    const options = autoclassifyOptions.concat(bugSuggestionOptions);

    this.scoreOptions(options);
    this.sortOptions(options);
    if (this.bestOption) {
      options.unshift(this.bestOption);
    }
    this.markHidden(options);
    return options;
  }

  /**
   * Build a list of the default options that apply to all lines.
   */
  getExtraOptions() {
    const { errorLine } = this.props;
    const extraOptions = [
      new LineOptionModel('manual', `${errorLine.id}-manual`),
    ];
    const ignoreOption = new LineOptionModel(
      'ignore',
      `${errorLine.id}-ignore`,
      0,
    );

    extraOptions.push(ignoreOption);
    if (this.bestIsIgnore()) {
      ignoreOption.isBest = true;
    }
    return extraOptions;
  }

  /**
   * Get the initial default option
   * @param {Object[]} options - List of line-specific options
   * @param {Object[]} extraOptions - List of line-independent options
   */
  getDefaultOption(options, extraOptions) {
    const { errorLine, prevErrorLine } = this.props;

    // If we have a best option from the autoclassifier use that
    if (options.length && options[0].isBest && options[0].selectable) {
      return options[0];
    }
    // Otherwise we need to decide whether to use a bug suggestion
    // or to ignore the line
    const failureLine = errorLine.data.failure_line;

    function parseTest(line) {
      const parts = line.split(' | ', 3);
      return parts.length === 3 ? parts[1] : null;
    }
    // Search for the best selectable bug suggestion, using the fact that
    // these are already sorted by string overlap

    this.bestOption = options.find(option => option.selectable);
    // If that suggestion is good enough just use it

    if (this.bestOption && this.bestOption.score >= GOOD_MATCH_SCORE) {
      return this.bestOption;
    }

    /* If there was no autoclassification and no good
     * suggestions, we need to guess whether this is an
     * ignorable line or one which must be classified. The
     * general approach is to assume a pure log line
     * without any keywords that indicate importance is
     * ignorable, as is a test line from the same test as
     * the previous line. Otherwise we assume that the
     * line pertains to a new bug
     */

    // Get the test id for this line and the last line, if any
    const thisTest = failureLine
      ? failureLine.test
      : parseTest(errorLine.data.bug_suggestions.search);
    let prevTest;
    if (prevErrorLine) {
      prevTest = prevErrorLine.data.failure_line
        ? prevErrorLine.data.failure_line.test
        : parseTest(prevErrorLine.data.bug_suggestions.search);
    }

    let ignore;

    // Strings indicating lines that should not be ignored
    const importantLines = [
      /\d+ bytes leaked/,
      /application crashed/,
      /TEST-UNEXPECTED-/,
    ];

    if (prevTest && thisTest && prevTest === thisTest) {
      // If the previous line was about the same test as
      // this one and this doesn't have any good bug
      // suggestions, we assume that is the signature line
      // and this is ignorable
      ignore = true;
    } else if (
      failureLine &&
      (failureLine.action === 'crash' || failureLine.action === 'test_result')
    ) {
      // Don't ignore crashes or test results
      ignore = false;
    } else {
      // Don't ignore lines containing a well-known string
      let message;
      if (failureLine) {
        message = failureLine.signature
          ? failureLine.signature
          : failureLine.message;
      } else {
        message = errorLine.data.bug_suggestions.search;
      }
      ignore = !importantLines.some(x => x.test(message));
    }
    // If we didn't choose to ignore the line and there is a bug suggestion
    // that isn't terrible, use that
    if (!ignore && this.bestOption && this.bestOption.score > BAD_MATCH_SCORE) {
      return this.bestOption;
    }
    // Otherwise select either the ignore option or the manual bug option
    const offset = ignore ? -1 : -2;

    return extraOptions[extraOptions.length + offset];
  }

  /**
   * Return a function that takes a classified failure id and returns the
   * matcher that provided the best match, and the score of that match.
   */
  getClassifiedFailureMatcher() {
    const { errorLine } = this.props;
    const matchesByCF = errorLine.data.matches.reduce((matchesByCF, match) => {
      if (!matchesByCF.has(match.classified_failure)) {
        matchesByCF.set(match.classified_failure, []);
      }
      matchesByCF.get(match.classified_failure).push(match);
      return matchesByCF;
    }, new Map());

    return cf_id =>
      matchesByCF.get(cf_id).map(match => ({
        matcher: match.matcher_name,
        score: match.score,
      }));
  }

  initOption(option) {
    // If the best option is a classified failure with no associated bug number
    // then default to updating that option with a new bug number
    // TODO: consider adding the update/create options back here, although it's
    // not clear anyone ever understood how they were supposed to work
    const { errorLine, setErrorLineInput } = this.props;
    const classifiedFailureId =
      this.bestOption &&
      this.bestOption.classifiedFailureId &&
      this.bestOption.bugNumber === null
        ? this.bestOption.classifiedFailureId
        : option.classifiedFailureId;

    let bug;
    if (option.type === 'manual') {
      bug = option.manualBugNumber;
    } else if (option.type === 'ignore') {
      bug = option.ignoreAlways ? 0 : null;
    } else {
      bug = option.bugNumber;
    }

    const data = {
      id: errorLine.id,
      type: option.type,
      classifiedFailureId,
      bugNumber: bug,
    };

    setErrorLineInput(errorLine.id, data);
  }

  /**
   * Sort a list of options by score
   * @param {Object[]} options - List of options to sort
   */
  sortOptions(options) {
    // Sort all the possible failure line options by their score
    options.sort((a, b) => b.score - a.score);
  }

  /**
   * Mark some options hidden based on a heuristic to ensure that we initially
   * show only the most likely bug suggestion options to sheriffs.
   * @param {Object[]} options - List of options to potentially hide
   */
  markHidden(options) {
    // Mark some options as hidden by default
    // We do this if the score is too low compared to the best option
    // or if the score is below some threshold or if there are too many
    // options
    if (!options.length) {
      return;
    }

    [this.bestOption] = options;

    const lowerCutoff = 0.1;
    const bestRatio = 0.5;
    const maxOptions = 10;
    const minOptions = 1;
    const bestScore = this.bestOption.score;

    options.forEach((option, idx) => {
      option.hidden =
        idx > minOptions - 1 &&
        (option.score < lowerCutoff ||
          option.score < bestRatio * bestScore ||
          idx > maxOptions - 1);
    });
  }

  /**
   * Give each option in a list a score based on either autoclassifier-provided score
   * or a textual overlap between a bug suggestion and the log data in the error this.props.errorLine.
   * @param {Object[]} options - List of options to score
   */
  scoreOptions(options) {
    const { errorLine } = this.props;
    options.forEach(option => {
      let score;
      const { data } = errorLine;
      if (option.type === 'classifiedFailure') {
        score = parseFloat(
          data.matches.find(
            x => x.classified_failure === option.classifiedFailureId,
          ).score,
        );
      } else {
        score = stringOverlap(
          data.bug_suggestions.search,
          option.bugSummary.replace(/^\s*Intermittent\s+/, ''),
        );
        // Artificially reduce the score of resolved bugs
        score *= option.bugResolution ? 0.8 : 1;
      }
      option.score = score;
    });
  }

  /**
   * Test if any options in a list are hidden
   * @param {Object[]} options - List of options
   */
  hasHidden(options) {
    return options.some(option => option.hidden);
  }

  /**
   * Test if the initial best option is to ignore the line
   */
  bestIsIgnore() {
    const {
      errorLine: { data: errorData },
    } = this.props;

    if (errorData.metaData) {
      return (
        errorData.metadata.best_classification &&
        errorData.metadata.best_classification.bugNumber === 0
      );
    }
    return false;
  }

  /**
   * Determine whether the line should be open for editing by default
   */
  defaultEditable(option) {
    return option
      ? !(option.score >= GOOD_MATCH_SCORE || option.type === 'ignore')
      : false;
  }

  render() {
    const {
      errorLine,
      selectedJob,
      canClassify,
      isSelected,
      isEditable,
      setEditable,
      toggleSelect,
      repoName,
    } = this.props;
    const {
      messageExpanded,
      showHidden,
      selectedOption,
      options,
      extraOptions,
    } = this.state;

    const failureLine = errorLine.data.metadata.failure_line;
    const searchLine = errorLine.data.bug_suggestions.search;
    const logUrl = getLogViewerUrl(
      selectedJob.id,
      repoName,
      errorLine.data.line_number + 1,
    );
    const status = this.getStatus();

    return (
      <div
        className={`error-line ${isSelected ? 'selected' : ''}`}
        onClick={evt => toggleSelect(evt, errorLine)}
      >
        <div className={status}>&nbsp;</div>
        {errorLine.verified && (
          <div>
            {!errorLine.verifiedIgnore && (
              <span
                className="badge badge-xs badge-primary"
                title="This line is verified"
              >
                Verified
              </span>
            )}
            {errorLine.verifiedIgnore && (
              <span
                className="badge badge-xs badge-ignored"
                title="This line is ignored"
              >
                Ignored
              </span>
            )}
          </div>
        )}

        <div className="classification-line-detail">
          {failureLine && (
            <div>
              {failureLine.action === 'test_result' && (
                <span>
                  <span
                    className={errorLine.verifiedIgnore ? 'ignored-line' : ''}
                  >
                    <strong className="failure-line-status">
                      {failureLine.status}
                    </strong>
                    {failureLine.expected !== 'PASS' &&
                      failureLine.expected !== 'OK' && (
                        <span>
                          (expected <strong>{failureLine.expected}</strong>)
                        </span>
                      )}{' '}
                    | <strong>{failureLine.test}</strong>
                    {failureLine.subtest && (
                      <span>| {failureLine.subtest}</span>
                    )}
                  </span>
                  {failureLine.message && !errorLine.verifiedIgnore && (
                    <div className="failure-line-message">
                      <FontAwesomeIcon
                        icon={messageExpanded ? faCaretDown : faCaretRight}
                        size="lg"
                        fixedWidth
                        className="failure-line-message-toggle"
                        onClick={() =>
                          this.setState({ messageExpanded: !messageExpanded })
                        }
                        title="Expand/Collapse"
                      />
                      {messageExpanded ? (
                        <span className="failure-line-message-expanded">
                          {failureLine.message}
                        </span>
                      ) : (
                        <span className="failure-line-message-collapsed">
                          {failureLine.message}
                        </span>
                      )}
                    </div>
                  )}
                </span>
              )}
              {failureLine.action === 'log' && (
                <span>
                  LOG {failureLine.level} | {failureLine.message}
                </span>
              )}
              {failureLine.action === 'crash' && (
                <span>
                  CRASH |
                  {failureLine.test && (
                    <span>
                      <strong>{failureLine.test}</strong> |
                    </span>
                  )}
                  application crashed [{failureLine.signature}]
                </span>
              )}
              <span>
                {' '}
                [
                <a
                  title="Open the log viewer in a new window"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={logUrl}
                  className=""
                >
                  log…
                </a>
                ]
              </span>
            </div>
          )}
          {!failureLine && (
            <div>
              {highlightLogLine(searchLine)}
              <span>
                {' '}
                [
                <a
                  title="Open the log viewer in a new window"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={logUrl}
                >
                  log…
                </a>
                ]
              </span>
            </div>
          )}

          {errorLine.verified && !errorLine.verifiedIgnore && (
            <div>
              <FontAwesomeIcon
                icon={faStar}
                className="best-classification-star"
                title="Classified"
              />
              {errorLine.bugNumber && (
                <span className="line-option-text">
                  <a
                    href={getBugUrl(errorLine.bugNumber)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Bug {errorLine.bugNumber} -{' '}
                    {errorLine.bugSummary && (
                      <span>{errorLine.bugSummary}</span>
                    )}
                  </a>
                  {!errorLine.bugNumber && (
                    <span className="line-option-text">
                      Classifed failure with no bug number
                    </span>
                  )}
                </span>
              )}
            </div>
          )}

          {((!errorLine.verified && isEditable) || !canClassify) && (
            <div>
              <FormGroup>
                <ul className="list-unstyled">
                  {options.map(
                    option =>
                      (showHidden || !option.hidden) && (
                        <li key={option.id}>
                          <LineOption
                            errorLine={errorLine}
                            optionModel={option}
                            selectedOption={selectedOption}
                            canClassify={canClassify}
                            onOptionChange={this.onOptionChange}
                            ignoreAlways={option.ignoreAlways}
                          />
                        </li>
                      ),
                  )}
                </ul>
                {this.hasHidden(options) && (
                  <Button
                    onClick={() =>
                      this.setState(prevState => ({
                        showHidden: !prevState.showHidden,
                      }))
                    }
                    className="link-style has-hidden"
                  >
                    {!showHidden ? <span>More…</span> : <span>Fewer</span>}
                  </Button>
                )}
                {canClassify && (
                  <ul className="list-unstyled extra-options">
                    {/* classification options for line */}
                    {extraOptions.map(option => (
                      <li key={option.id}>
                        <LineOption
                          errorLine={errorLine}
                          optionModel={option}
                          selectedOption={selectedOption}
                          canClassify={canClassify}
                          onOptionChange={this.onOptionChange}
                          onIgnoreAlwaysChange={this.onIgnoreAlwaysChange}
                          onManualBugNumberChange={this.onManualBugNumberChange}
                          manualBugNumber={option.manualBugNumber}
                          ignoreAlways={option.ignoreAlways}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </FormGroup>
            </div>
          )}

          {!errorLine.verified && !isEditable && canClassify && (
            <div>
              <StaticLineOption
                errorLine={errorLine}
                option={selectedOption}
                numOptions={options.length}
                canClassify={canClassify}
                setEditable={setEditable}
                ignoreAlways={selectedOption.ignoreAlways}
                manualBugNumber={selectedOption.manualBugNumber}
              />
            </div>
          )}
        </div>
      </div>
    );
  }
}

ErrorLine.propTypes = {
  selectedJob: PropTypes.object.isRequired,
  errorLine: PropTypes.object.isRequired,
  isSelected: PropTypes.bool.isRequired,
  isEditable: PropTypes.bool.isRequired,
  toggleSelect: PropTypes.func.isRequired,
  setErrorLineInput: PropTypes.func.isRequired,
  setEditable: PropTypes.func.isRequired,
  canClassify: PropTypes.bool.isRequired,
  repoName: PropTypes.string.isRequired,
  prevErrorLine: PropTypes.object,
};

ErrorLine.defaultProps = {
  prevErrorLine: null,
};

const mapStateToProps = ({ selectedJob: { selectedJob } }) => ({ selectedJob });

export default connect(mapStateToProps)(ErrorLine);
