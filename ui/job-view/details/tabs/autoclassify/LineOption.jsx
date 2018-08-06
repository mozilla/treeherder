import React from 'react';
import PropTypes from 'prop-types';
import { FormGroup, Label, Input } from 'reactstrap';
import Select from 'react-select';
import Highlighter from 'react-highlight-words';

import { getSearchWords } from '../../../../helpers/display';
import { isReftest } from '../../../../helpers/job';
import { getBugUrl, getLogViewerUrl, getReftestUrl } from '../../../../helpers/url';
import BugFiler from '../../BugFiler';
import { thEvents } from '../../../../js/constants';
import { getAllUrlParams } from '../../../../helpers/location';

/**
 * Editable option
 */
export default class LineOption extends React.Component {
  constructor(props) {
    super(props);
    const { $injector } = props;

    this.$rootScope = $injector.get('$rootScope');
    this.thNotify = $injector.get('thNotify');

    this.state = {
      isBugFilerOpen: false,
      repoName: getAllUrlParams().repo,
    };
  }

  componentDidMount() {
    this.fileBug = this.fileBug.bind(this);
    this.toggleBugFiler = this.toggleBugFiler.bind(this);
    this.bugFilerCallback = this.bugFilerCallback.bind(this);
  }

  fileBug() {
    const { selectedOption, optionModel } = this.props;

    selectedOption.id = optionModel.id;
    this.setState({ isBugFilerOpen: true });
  }

  toggleBugFiler() {
    this.setState({ isBugFilerOpen: !this.state.isBugFilerOpen });
  }

  bugFilerCallback(data) {
    const { addBug, onManualBugNumberChange, optionModel } = this.props;
    const bugId = data.success;

    addBug({ id: bugId });
    this.$rootScope.$evalAsync(this.$rootScope.$emit(thEvents.saveClassification));
    // Open the newly filed bug in a new tab or window for further editing
    window.open(getBugUrl(bugId));
    onManualBugNumberChange(optionModel, `${bugId}`);
  }

  render() {
    const {
      job,
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
    let logUrl = job.logs.filter(x => x.name.endsWith('_json'));
    logUrl = logUrl[0] ? logUrl[0].url : job.logs[0].url;

    return (
      <div className="classification-option">
        <span className="classification-icon">
          {option.isBest ?
            <span className="fa fa-star-o" title="Autoclassifier best match" /> :
            <span className="classification-no-icon">&nbsp;</span>}
        </span>

        <FormGroup check>
          <Label check>
            {!(option.type === 'classifiedFailure' && !option.bugNumber) && <Input
              type="radio"
              value={option}
              id={option.id}
              checked={selectedOption.id === option.id}
              name={errorLine.id}
              onChange={() => onOptionChange(option)}
              className={canClassify ? '' : 'hidden'}
            />}
            {!!option.bugNumber && <span className="line-option-text">
              {(!canClassify || job.id in pinnedJobs) &&
                <button
                  className="btn btn-xs btn-light-bordered"
                  onClick={() => addBug({ id: option.bugNumber }, job)}
                  title="add to list of bugs to associate with all pinned jobs"
                ><i className="fa fa-thumb-tack" /></button>}
              {!!option.bugResolution &&
                <span className="classification-bug-resolution"> [{option.bugResolution}] </span>}
              <a
                href={getBugUrl(option.bugNumber)}
                target="_blank"
                rel="noopener noreferrer"
              >{option.bugNumber} -
                <Highlighter
                  searchWords={getSearchWords(errorLine.data.bug_suggestions.search)}
                  textToHighlight={option.bugSummary}
                  caseSensitive
                  highlightTag="strong"
                />
              </a>
              <span> [ {Number.parseFloat(option.score).toPrecision(2)} ]</span>
            </span>}

            {option.type === 'classifiedFailure' && !option.bugNumber && <span>
              Autoclassified failure with no associated bug number
            </span>}

            {option.type === 'manual' &&
              <div className={`line-option-text manual-bug ${!canClassify ? 'hidden' : ''}`}>
                Other bug:
                <Input
                  className="manual-bug-input"
                  id={`${errorLine.id}-manual-bug`}
                  type="text"
                  size="7"
                  placeholder="Number"
                  value={manualBugNumber}
                  onChange={evt => onManualBugNumberChange(option, evt.target.value)}
                />
                <a
                  className="btn btn-xs btn-light-bordered btn-file-bug"
                  onClick={() => this.fileBug()}
                  title="File a bug for this failure"
                ><i className="fa fa-bug" /></a>

                {option.id === 'manual' && !!option.manualBugNumber &&
                <a
                  href={getBugUrl(option.manualBugNumber)}
                  target="_blank"
                  rel="noopener noreferrer"
                >[view]</a>}
              </div>}

            {option.type === 'ignore' && <span
              className={`line-option-text ignore ${canClassify ? '' : 'hidden'}`}
            >Ignore line
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
            </span>}
          </Label>
        </FormGroup>

        {option.type === 'classifiedFailure' && <div className="classification-matchers">
          Matched by:
          {option.matches && option.matches.map(match => (<span key={match.matcher.id}>
            {match.matcher.name} ({match.score})
          </span>))}
        </div>}
        {isBugFilerOpen && <BugFiler
          isOpen={isBugFilerOpen}
          toggle={this.toggleBugFiler}
          suggestion={errorLine.data.bug_suggestions}
          suggestions={[errorLine.data.bug_suggestions]}
          fullLog={logUrl}
          parsedLog={`${location.origin}/${getLogViewerUrl(job.id, repoName)}`}
          reftestUrl={isReftest(job) ? `${getReftestUrl(logUrl)}&only_show_unexpected=1` : ''}
          successCallback={this.bugFilerCallback}
          jobGroupName={job.job_group_name}
          notify={this.thNotify}
        />}
      </div>
    );
  }
}


LineOption.propTypes = {
  $injector: PropTypes.object.isRequired,
  job: PropTypes.object.isRequired,
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
