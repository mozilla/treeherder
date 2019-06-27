import $ from 'jquery';
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

import { thEvents } from '../../../../helpers/constants';
import { getProjectJobUrl } from '../../../../helpers/location';
import TextLogErrorsModel from '../../../../models/textLogErrors';
import { withPinnedJobs } from '../../../context/PinnedJobs';
import { notify } from '../../../redux/stores/notifications';

import AutoclassifyToolbar from './AutoclassifyToolbar';
import ErrorLine from './ErrorLine';
import ErrorLineData from './ErrorLineModel';

class AutoclassifyTab extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      loadStatus: 'loading',
      errorLines: [],
      selectedLineIds: new Set(),
      editableLineIds: new Set(),
      // Map between line id and input selected in the UI
      inputByLine: new Map(),
      // Autoclassify status when the panel last loaded
      canClassify: false,
    };
  }

  static getDerivedStateFromProps(nextProps) {
    const { user } = nextProps;

    return { canClassify: user.isLoggedIn && user.isStaff };
  }

  async componentDidMount() {
    const { selectedJob } = this.props;
    // Load the data here
    if (selectedJob.id) {
      this.fetchErrorData();
    }
  }

  componentDidUpdate(prevProps) {
    const { selectedJob } = this.props;
    // Load the data here
    if (selectedJob.id !== prevProps.selectedJob.id) {
      this.fetchErrorData();
    }
  }

  /**
   * Save all pending lines
   */
  onSaveAll = pendingLines => {
    const { inputByLine } = this.state;
    const pending = pendingLines || Array.from(inputByLine.values());
    this.save(pending).then(() => {
      this.setState({ selectedLineIds: new Set() });
    });
  };

  /**
   * Save all selected lines
   */
  onSave = () => {
    this.save(this.getSelectedLines());
  };

  /**
   * Ignore selected lines
   */
  onIgnore = () => {
    window.dispatchEvent(new CustomEvent(thEvents.autoclassifyIgnore));
  };

  /**
   * Pin selected job to the pinBoard
   */
  onPin = () => {
    const { pinJob, selectedJob } = this.props;
    // TODO: consider whether this should add bugs or mark all lines as ignored
    pinJob(selectedJob);
  };

  onToggleEditable = () => {
    const { selectedLineIds, editableLineIds } = this.state;
    const selectedIds = Array.from(selectedLineIds);
    const editable = selectedIds.some(id => !editableLineIds.has(id));

    this.setEditable(selectedIds, editable);
  };

  getPendingLines = () => {
    const { errorLines } = this.state;

    return errorLines.filter(line => !line.verified);
  };

  getSelectedLines = () => {
    const { selectedLineIds, inputByLine } = this.state;

    return Array.from(selectedLineIds).reduce((lines, id) => {
      const settings = inputByLine.get(id);
      return settings ? [...lines, settings] : lines;
    }, []);
  };

  getLoadStatusText = () => {
    const { loadStatus, errorLines } = this.state;
    switch (loadStatus) {
      case 'job_pending':
        return 'Job not complete, please wait';
      case 'pending':
        return 'Logs not fully parsed, please wait';
      case 'failed':
        return 'Log parsing failed';
      case 'skipped-size':
        return 'Log parsing was skipped since the log file exceeds the size limit';
      case 'no_logs':
        return 'No errors logged';
      case 'error':
        return 'Error showing autoclassification data';
      case 'loading':
        return null;
      case 'ready':
        return !errorLines || errorLines.length === 0
          ? 'No error lines reported'
          : null;
      default:
        return `Unexpected status: ${loadStatus}`;
    }
  };

  setEditable = (lineIds, editable) => {
    const { editableLineIds } = this.state;
    const f = editable
      ? lineId => editableLineIds.add(lineId)
      : lineId => editableLineIds.delete(lineId);

    lineIds.forEach(f);
    this.setState({ editableLineIds });
  };

  setErrorLineInput = (id, input) => {
    const { inputByLine } = this.state;

    inputByLine.set(id, input);
    this.setState({ inputByLine });
  };

  /**
   * Get TextLogerror data from the API
   */
  fetchErrorData = async () => {
    const { selectedJob } = this.props;

    this.setState(
      {
        loadStatus: 'loading',
        errorLines: [],
        selectedLineIds: new Set(),
        editableLineIds: new Set(),
        inputByLine: new Map(),
      },
      async () => {
        if (selectedJob.id) {
          const errorLineResp = await fetch(
            getProjectJobUrl('/text_log_errors/', selectedJob.id),
          );
          const errorLineData = await errorLineResp.json();
          const errorLines = errorLineData
            .map(line => new ErrorLineData(line))
            .sort((a, b) => a.data.id - b.data.id);

          if (errorLines.length) {
            const selected = errorLines.find(line => !line.verified);
            this.setState({
              selectedLineIds: new Set([selected ? selected.id : null]),
            });
          }

          this.setState({
            errorLines,
            loadStatus: 'ready',
          });
        }
      },
    );
  };

  /**
   * Test if it is possible to save a specific line.
   * @param {number} lineId - Line id to test.
   */
  canSave = lineId => {
    const { inputByLine, canClassify } = this.state;
    const settings = inputByLine.get(lineId);

    if (!canClassify) {
      return false;
    }
    if (!settings) {
      // This can happen when we are switching jobs
      return false;
    }
    if (settings.type === null) {
      return false;
    }
    if (settings.type === 'ignore') {
      return true;
    }
    return !!(settings.classifiedFailureId || settings.bugNumber);
  };

  /**
   * Test if it is possible to save all in a list of lines.
   */
  canSaveAll = () => {
    const { canClassify } = this.state;
    const pendingLines = this.getPendingLines();

    return (
      canClassify &&
      !!pendingLines.length &&
      pendingLines.every(line => this.canSave(line.id))
    );
  };

  /**
   * Update and mark verified the classification of a list of lines on
   * the server.
   * @param {number[]} lines - Lines to test.
   */
  save = async lines => {
    if (!Object.keys(lines).length) {
      return Promise.reject('No lines to save');
    }
    const { errorLines } = this.state;
    const { notify } = this.props;
    const data = Object.values(lines).map(input => ({
      id: input.id,
      best_classification: input.classifiedFailureId || null,
      bug_number: input.bugNumber,
    }));

    this.setState({ loadStatus: 'loading' });
    const {
      data: results,
      failureStatus,
    } = await TextLogErrorsModel.verifyMany(data);
    if (!failureStatus) {
      const newErrorLines = results.reduce(
        (newLines, updatedLine) => {
          const idx = newLines.findIndex(line => line.id === updatedLine.id);
          newLines[idx] = new ErrorLineData(updatedLine);
          return newLines;
        },
        [...errorLines],
      );
      this.setState({ errorLines: newErrorLines, loadStatus: 'ready' });
    } else {
      const msg = `Error saving classifications: ${results}`;
      notify(msg, 'danger', { sticky: true });
    }
  };

  /**
   * Toggle the selection of a ErrorLine, if the click didn't happen on an interactive
   * element child of that line.
   */
  toggleSelect = (event, errorLine) => {
    const elem = $(event.target);
    const { selectedLineIds } = this.state;
    const interactive = new Set(['INPUT', 'BUTTON', 'TEXTAREA', 'A']);

    if (interactive.has(elem.prop('tagName'))) {
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      if (selectedLineIds.has(errorLine.id)) {
        // remove it from selection
        selectedLineIds.delete(errorLine.id);
      } else {
        // add it to selection
        selectedLineIds.add(errorLine.id);
      }
      this.setState({ selectedLineIds: new Set(selectedLineIds) });
    } else {
      this.setState({ selectedLineIds: new Set([errorLine.id]) });
    }
  };

  render() {
    const { user, repoName, selectedJob } = this.props;
    const {
      errorLines,
      loadStatus,
      selectedLineIds,
      editableLineIds,
      canClassify,
      errorMatchers,
    } = this.state;
    const loadStatusText = this.getLoadStatusText();
    const canSave = Array.from(selectedLineIds).every(id => this.canSave(id));
    const canSaveAll = this.canSaveAll();

    return (
      <div role="region" aria-label="Autoclassify">
        {canClassify && (
          <AutoclassifyToolbar
            autoclassifyStatus={selectedJob.autoclassify_status || 'pending'}
            user={user}
            hasSelection={!!selectedLineIds.size}
            canSave={canSave}
            canSaveAll={canSaveAll}
            canClassify={canClassify}
            onPin={this.onPin}
            onIgnore={this.onIgnore}
            onEdit={this.onToggleEditable}
            onSave={this.onSave}
            onSaveAll={() => this.onSaveAll()}
          />
        )}

        <div>
          {loadStatusText && <span>{loadStatusText}</span>}
          {loadStatus === 'loading' && (
            <div className="overlay">
              <div>
                <FontAwesomeIcon
                  icon={faSpinner}
                  pulse
                  className="th-spinner-lg"
                  title="Loading..."
                />
              </div>
            </div>
          )}
        </div>

        <span className="autoclassify-error-lines">
          <ul className="list-unstyled">
            {errorLines.map((errorLine, idx) => (
              <li key={errorLine.id}>
                <ErrorLine
                  errorMatchers={errorMatchers}
                  errorLine={errorLine}
                  prevErrorLine={errorLines[idx - 1]}
                  canClassify={canClassify}
                  isSelected={selectedLineIds.has(errorLine.id)}
                  isEditable={editableLineIds.has(errorLine.id)}
                  setEditable={() => this.setEditable([errorLine.id], true)}
                  setErrorLineInput={this.setErrorLineInput}
                  toggleSelect={this.toggleSelect}
                  repoName={repoName}
                />
              </li>
            ))}
          </ul>
        </span>
      </div>
    );
  }
}

AutoclassifyTab.propTypes = {
  user: PropTypes.object.isRequired,
  selectedJob: PropTypes.object.isRequired,
  pinJob: PropTypes.func.isRequired,
  notify: PropTypes.func.isRequired,
  repoName: PropTypes.string.isRequired,
};

const mapStateToProps = ({ selectedJob: { selectedJob } }) => ({ selectedJob });

export default connect(
  mapStateToProps,
  { notify },
)(withPinnedJobs(AutoclassifyTab));
