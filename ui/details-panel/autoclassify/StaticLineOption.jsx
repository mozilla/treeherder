import PropTypes from 'prop-types';
import Highlighter from 'react-highlight-words';

import { getBugUrl } from "../../helpers/urlHelper";
import { getSearchWords } from "../../helpers/displayHelper";

/**
 * Non-editable best option
 */
export default function StaticLineOption(props) {
  const {
    job,
    canClassify,
    errorLine,
    option,
    numOptions,
    setEditable,
    ignoreAlways,
    manualBugNumber,
    pinBoard,
  } = props;

  const optionCount = numOptions - 1;
  const ignoreAlwaysText = ignoreAlways ? 'for future classifications' : 'here only';

  return (
    <div className="static-classification-option">
      <div className="classification-icon">
        {option.isBest ?
          <span className="fa fa-star-o" title="Autoclassifier best match" /> :
          <span className="classification-no-icon">&nbsp;</span>}
      </div>

      {!!option.bugNumber && <span className="line-option-text">
        {!canClassify || pinBoard.isPinned(job) &&
          <button
            className="btn btn-xs btn-light-bordered"
            onClick={pinBoard.addBug({ id: option.bugNumber }, job)}
            title="add to list of bugs to associate with all pinned jobs"
          ><i className="fa fa-thumb-tack" /></button>}
        {!!option.bugResolution &&
          <span className="classification-bug-resolution">[{option.bugResolution}]</span>}
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
        <span>[ {Number.parseFloat(option.score).toPrecision(2)} ]</span>
      </span>}

      {option.type === 'classifiedFailure' && !option.bugNumber && <span>
        Autoclassified failure with no associated bug number
      </span>}

      {option.type === 'manual' && <span className="line-option-text">
        Bug
        {!!manualBugNumber && <a
          href={getBugUrl(option.manualBugNumber)}
          target="_blank"
          rel="noopener"
        >{manualBugNumber}</a>}
        {!!manualBugNumber && <span>No bug number specified</span>}
      </span>}

      {option.type==='ignore' &&
        <span className="line-option-text">Ignore {ignoreAlwaysText}</span>}
      {optionCount > 0 && <span>, {optionCount} other {optionCount === 1 ? 'option' : 'options'}

      </span>}
      <div>
        <a onClick={setEditable} className="link-style">Edit…</a>
      </div>
    </div>
  );
}

StaticLineOption.propTypes = {
  job: PropTypes.object.isRequired,
  errorLine: PropTypes.object.isRequired,
  option: PropTypes.object.isRequired,
  pinBoard: PropTypes.object.isRequired,
  numOptions: PropTypes.number.isRequired,
  ignoreAlways: PropTypes.bool.isRequired,
  canClassify: PropTypes.bool.isRequired,
  setEditable: PropTypes.func.isRequired,
  manualBugNumber: PropTypes.number,
};

StaticLineOption.defaultProps = {
  manualBugNumber: undefined,
};
