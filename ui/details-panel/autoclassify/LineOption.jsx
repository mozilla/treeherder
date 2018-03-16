import PropTypes from 'prop-types';
import { FormGroup, Label, Input } from 'reactstrap';
import Select from 'react-select';
import 'react-select/dist/react-select.css';
import Highlighter from 'react-highlight-words';

import { getBugUrl, getLogViewerUrl, getReftestUrl } from "../../helpers/urlHelper";
import { isReftest } from "../../helpers/jobHelper";
import { getSearchWords } from "../../helpers/displayHelper";
import intermittentTemplate from '../../partials/main/intermittent.html';

/**
 * Editable option
 */
export default class LineOption extends React.Component {
  constructor(props) {
    super(props);
    const { $injector } = props;

    this.$uibModal = $injector.get('$uibModal');
    this.$rootScope = $injector.get('$rootScope');
  }

  componentDidMount() {
    this.fileBug = this.fileBug.bind(this);
  }

  fileBug() {
    const { job, errorLine, selectedOption, optionModel, onManualBugNumberChange } = this.props;
    const repoName = this.$rootScope.repoName;
    let logUrl = job.logs.filter(x => x.name.endsWith("_json"));
    logUrl = logUrl[0] ? logUrl[0].url : job.logs[0];
    const reftestUrl = getReftestUrl(logUrl);
    const crashSignatures = [];
    const crashRegex = /application crashed \[@ (.+)\]$/g;
    const crash = errorLine.data.bug_suggestions.search.match(crashRegex);

    if (crash) {
      const signature = crash[0].split("application crashed ")[1];
      if (!crashSignatures.includes(signature)) {
        crashSignatures.push(signature);
      }
    }

    const modalInstance = this.$uibModal.open({
       template: intermittentTemplate,
       controller: 'BugFilerCtrl',
       size: 'lg',
       openedClass: 'filer-open',
       resolve: {
         summary: () => errorLine.data.bug_suggestions.search,
         search_terms: () => errorLine.data.bug_suggestions.search_terms,
         fullLog: () => logUrl,
         parsedLog: () => `${location.origin}/${getLogViewerUrl(job.id, repoName)}`,
         reftest: () => (isReftest(job) ? `${reftestUrl}&only_show_unexpected=1` : ''),
         selectedJob: () => job,
         allFailures: () => [errorLine.data.bug_suggestions.search.split(" | ")],
         crashSignatures: () => crashSignatures,
         successCallback: () => (data) => {
           const bugId = data.success;
           window.open(getBugUrl(bugId));
           onManualBugNumberChange(optionModel, `${bugId}`);
         }
       }
     });

    selectedOption.id = optionModel.id;
    modalInstance.opened.then(() => modalInstance.initiate());
  }

  render() {
    const {
      job,
      errorLine,
      optionModel,
      selectedOption,
      canClassify,
      pinBoard,
      onOptionChange,
      onIgnoreAlwaysChange,
      ignoreAlways,
      manualBugNumber,
      onManualBugNumberChange,
    } = this.props;
    const option = optionModel;

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
              {(!canClassify || pinBoard.isPinned(job)) &&
                <button
                  className="btn btn-xs btn-light-bordered"
                  onClick={() => pinBoard.addBug({ id: option.bugNumber }, job)}
                  title="add to list of bugs to associate with all pinned jobs"
                ><i className="fa fa-thumb-tack" /></button>}
              {!!option.bugResolution &&
                <span className="classification-bug-resolution"> [{option.bugResolution}] </span>}
              <a
                href={getBugUrl(option.bugNumber)}
                target="_blank"
                rel="noopener"
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
                  rel="noopener"
                >[view]</a>}
              </div>}

            {option.type ==='ignore' && <span
              className={`line-option-text ignore ${canClassify ? '' : 'hidden'}`}
            >Ignore line
              <Select
                value={ignoreAlways}
                clearable={false}
                className="ignore-option"
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
  pinBoard: PropTypes.object.isRequired,
  selectedOption: PropTypes.object.isRequired,
  onOptionChange: PropTypes.func.isRequired,
  onIgnoreAlwaysChange: PropTypes.func,
  onManualBugNumberChange: PropTypes.func,
  manualBugNumber: PropTypes.number,
};

LineOption.defaultProps = {
  onManualBugNumberChange: null,
  onIgnoreAlwaysChange: null,
  manualBugNumber: undefined,
};
