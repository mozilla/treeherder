import PropTypes from 'prop-types';
import React from 'react';

import ErrorLineData from './autoclassify/ErrorLineModel';
import AutoclassifyToolbar from './autoclassify/AutoclassifyToolbar';
import ErrorLine from './autoclassify/ErrorLine';
import { getLogViewerUrl, getApiUrl, getProjectJobUrl } from "../helpers/urlHelper";
import { thEvents } from "../js/constants";
import treeherder from "../js/treeherder";

class AutoclassifyTab extends React.Component {
  static getDerivedStateFromProps(nextProps) {
    const { user } = nextProps;
    return { canClassify: user.loggedin && user.is_staff };
  }

  constructor(props) {
    super(props);

    const { $injector } = this.props;

    this.$rootScope = $injector.get('$rootScope');
    this.thNotify = $injector.get('thNotify');
    this.thPinboard = $injector.get('thPinboard');
    this.ThTextLogErrorsModel = $injector.get('ThTextLogErrorsModel');

    this.state = {
      loadStatus: "loading",
      errorLines: [],
      selectedLineIds: new Set(),
      editableLineIds: new Set(),
      // Map between line id and input selected in the UI
      inputByLine: new Map(),
      // Autoclassify status when the panel last loaded
      autoclassifyStatusOnLoad: null,
      canClassify: false,
    };
  }

  componentDidMount() {
    this.$rootScope.$on(thEvents.jobClick, () => {
      this.setState({
        loadStatus: "loading",
        errorLines: [],
        selectedLineIds: new Set(),
        editableLineIds: new Set(),
        inputByLine: new Map(),
        autoclassifyStatusOnLoad: null,
        canClassify: false,
      });
    });

    this.$rootScope.$on(
      thEvents.autoclassifyChangeSelection,
      (ev, direction, clear) => this.onChangeSelection(direction, clear));

    this.$rootScope.$on(
      thEvents.autoclassifySaveAll,
      () => {
        const pendingLines = Array.from(this.state.inputByLine.values());
        if (this.canSave(pendingLines)) {
          this.onSaveAll(pendingLines);
        } else {
          const msg = (this.state.canClassify ? "lines not classified" : "Not logged in");
          this.thNotify.send(`Can't save: ${msg}`, "danger");
        }
      });

    this.$rootScope.$on(
      thEvents.autoclassifySave,
      () => {
        if (this.canSave()) {
          this.onSave();
        } else {
          const msg = (this.state.canClassify ? "selected lines not classified" : "Not logged in");
          this.thNotify.send(`Can't save: ${msg}`, "danger");
        }
      }
    );

    this.$rootScope.$on(
      thEvents.autoclassifyToggleEdit,
      () => this.onToggleEditable());

    this.$rootScope.$on(
      thEvents.autoclassifyOpenLogViewer,
      () => this.onOpenLogViewer());

    // TODO: Once we're not using ng-react any longer and
    // are hosted completely in React, then try moving this
    // .bind code to the constructor.
    this.toggleSelect = this.toggleSelect.bind(this);
    this.setErrorLineInput = this.setErrorLineInput.bind(this);
    this.jobChanged = this.jobChanged.bind(this);
    this.onToggleEditable = this.onToggleEditable.bind(this);
    this.onChangeSelection = this.onChangeSelection.bind(this);
    this.onOpenLogViewer = this.onOpenLogViewer.bind(this);
    this.onIgnore = this.onIgnore.bind(this);
    this.onSave = this.onSave.bind(this);
    this.onSaveAll = this.onSaveAll.bind(this);
    this.onPin = this.onPin.bind(this);
    this.save = this.save.bind(this);

    // Load the data here
    if (this.props.job.id) {
      this.fetchErrorData();
    }
  }

  componentDidUpdate(prevProps) {
    // Load the data here
    if (this.props.job.id !== prevProps.job.id) {
      this.fetchErrorData();
    }
  }

  /**
   * Save all pending lines
   */
  onSaveAll(pendingLines) {
    const pending = pendingLines || Array.from(this.state.inputByLine.values());
    this.save(pending)
      .then(() => {
        this.signalFullyClassified();
        this.setState({ selectedLineIds: new Set() });
      });
  }

  /**
   * Save all selected lines
   */
  onSave() {
    this.save(this.getSelectedLines())
      .then(() => {
        if (this.getPendingLines().length === 0) {
          this.signalFullyClassified();
        }
      });
  }

  /**
   * Ignore selected lines
   */
  onIgnore() {
    this.$rootScope.$emit(thEvents.autoclassifyIgnore);
  }

  /**
   * Pin selected job to the pinboard
   */
  onPin() {
    //TODO: consider whether this should add bugs or mark all lines as ignored
    this.thPinboard.pinJob(this.props.job);
  }

  onToggleEditable() {
    const { selectedLineIds, editableLineIds } = this.state;
    const selectedIds = Array.from(selectedLineIds);
    const editable = selectedIds.some(id => !editableLineIds.has(id));

    this.setEditable(selectedIds, editable);
  }

  onOpenLogViewer() {
    const { job } = this.props;
    const { selectedLineIds, errorLines } = this.state;
    let lineNumber = null;

    if (selectedLineIds.size) {
      lineNumber = errorLines.find(line => selectedLineIds.has(line.id)).data.line_number + 1;
    }
    window.open(getLogViewerUrl(job.id, this.$rootScope.repoName, lineNumber));
  }

  /**
   * Pre-determined selection changes, typically for use in response to
   * key events.
   * @param {string} direction - 'next': select the row after the last selected row or
   *                                     the next job if this is the last row (and clear
   *                                     is false)
   *                             'previous': select the row before the first selected row
   *                                         or move to the previous job if the first row
   *                                         is selected and clear is false.
   *                             'all_next': Select all rows in the current job after the
   *                                         current selected row.
   * @param {boolean} clear - Clear the current selection before selecting new elements
   */
  onChangeSelection(direction, clear) {
    const { errorLines, selectedLineIds } = this.state;

    if (selectedLineIds.size) {
      // something already selected, determine the next selection
      const selectedLines = errorLines.filter(line => selectedLineIds.has(line.id));
      const lastSelected = selectedLines[selectedLines.length - 1];
      const firstSelected = selectedLines[0];

      if (clear) {
        selectedLineIds.clear();
      }
      if (direction === 'next') {
        // try to select the next line.
        const nextIdx = errorLines.indexOf(lastSelected) + 1;
        const toAdd = errorLines.length > nextIdx ? errorLines[nextIdx] : lastSelected;

        selectedLineIds.add(toAdd.id);
      } else if (direction === 'previous') {
        // try to select the previous line.
        const prevIdx = errorLines.indexOf(firstSelected) - 1;
        const toAdd = prevIdx >= 0 ? errorLines[prevIdx] : firstSelected;

        selectedLineIds.add(toAdd.id);
      } else if (direction === 'all_next') {
        const toAdd = errorLines.slice(errorLines.indexOf(lastSelected));
        toAdd.forEach(line => selectedLineIds.add(line.id));
      }
    } else {
      const firstUnverified = errorLines.find(line => !line.verified);
      if (firstUnverified) {
        selectedLineIds.add(firstUnverified.id);
      }
    }
    this.setState({ selectedLineIds });

    // Scroll the first selected index into view
    const newFirstSelectedIdx = errorLines.findIndex(line => selectedLineIds.has(line.id));
    $(".autoclassify-error-lines .error-line")[newFirstSelectedIdx]
        .scrollIntoView({ behavior: "smooth", block: "start" });
  }

  getPendingLines() {
    const { errorLines } = this.state;

    return errorLines.filter(line => !line.verified);
  }

  getSelectedLines() {
    const { selectedLineIds, inputByLine } = this.state;

    return Array.from(selectedLineIds).reduce((lines, id) => {
      const settings = inputByLine.get(id);
      return settings ? [...lines, settings] : lines;
    }, []);
  }

  getLoadStatusText() {
    switch (this.state.loadStatus) {
      case 'job_pending': return 'Job not complete, please wait';
      case 'pending': return 'Logs not fully parsed, please wait';
      case 'failed': return 'Log parsing failed';
      case 'no_logs': return 'No errors logged';
      case 'error': return 'Error showing autoclassification data';
      case 'loading': return null;
      case 'ready': return (!this.state.errorLines || this.state.errorLines.length === 0) ? 'No error lines reported' : null;
      default: return `Unexpected status: ${this.state.loadStatus}`;
    }
  }

  setEditable(lineIds, editable) {
    const { editableLineIds } = this.state;
    const f = editable ? lineId => editableLineIds.add(lineId) :
      lineId => editableLineIds.delete(lineId);

    lineIds.forEach(f);
    this.setState({ editableLineIds });
  }

  setErrorLineInput(id, input) {
    const { inputByLine } = this.state;

    inputByLine.set(id, input);
    this.setState({ inputByLine });
  }

  /**
   * Emit an event indicating that the job has been fully classified
   */
  signalFullyClassified() {
    const { job } = this.props;

    // Emit this event to get the main UI to update
    this.$rootScope.$emit(thEvents.autoclassifyVerified, { jobs: { [job.id]: job } });
  }

  /**
   * Get TextLogerror data from the API
   */
  async fetchErrorData() {
    const { job } = this.props;

    if (job.id) {
      const matcherResp = await fetch(getApiUrl("/matcher/"));
      const matcherData = await matcherResp.json();
      const errorMatchers = matcherData.reduce(
        (matchersById, matcher) => matchersById.set(matcher.id, matcher), new Map());
      const errorLineResp = await fetch(getProjectJobUrl('/text_log_errors/', job.id));
      const errorLineData = await errorLineResp.json();
      const errorLines = errorLineData.map(line => new ErrorLineData(line))
        .sort((a, b) => a.data.id - b.data.id);
      // Lines that are selected
      let selectedLineIds;
      let editableLines;

      if (errorLines.length) {
        const selected = errorLines.find(line => !line.verified);
        selectedLineIds = new Set([selected.id]);
        editableLines = errorLines.reduce((pending, line) => (
          !line.verified ? { ...pending, [line.id]: line } : pending
        ), {});
      }

      this.setState({
        errorLines,
        errorMatchers,
        selectedLineIds,
        editableLines,
        loadStatus: 'ready'
      });
    }
  }


  /**
   * Test if it is possible to save a specific line.
   * @param {number} lineId - Line id to test.
   */
  canSave(lineId) {
    const { inputByLine, canClassify } = this.state;
    const settings = inputByLine.get(lineId);

    if (!canClassify) {
      return false;
    }
    if (!settings) {
      //This can happen when we are switching jobs
      return false;
    }
    if (settings.type === null) {
      return false;
    }
    if (settings.type === "ignore") {
      return true;
    }
    return !!(settings.classifiedFailureId || settings.bugNumber);
  }

  /**
   * Test if it is possible to save all in a list of lines.
   */
  canSaveAll() {
    const pendingLines = this.getPendingLines();

    return (this.state.canClassify && !!pendingLines.length &&
      pendingLines.every(line => this.canSave(line.id)));
  }

  /**
   * Update and mark verified the classification of a list of lines on
   * the server.
   * @param {number[]} lines - Lines to test.
   */
  save(lines) {
    if (!Object.keys(lines).length) {
      return Promise.reject('No lines to save');
    }
    const { errorLines } = this.state;
    const data = Object.values(lines).map(input => ({
      id: input.id,
      best_classification: input.classifiedFailureId || null,
      bug_number: input.bugNumber
    }));

    this.setState({ loadStatus: "loading" });
    return this.ThTextLogErrorsModel
      .verifyMany(data)
      .then((resp) => {
        const newErrorLines = resp.data.reduce((newLines, updatedLine) => {
          const idx = newLines.findIndex(line => line.id === updatedLine.id);
          newLines[idx] = new ErrorLineData(updatedLine);
          return newLines;
        }, errorLines);
        this.setState({ errorLines: [...newErrorLines], loadStatus: "ready" });
      })
      .catch((err) => {
        const prefix = "Error saving classifications: ";
        const msg = err.stack ? `${prefix}${err}${err.stack}` : `${prefix}${err.statusText} - ${err.data.detail}`;
        this.thNotify.send(msg, "danger", { sticky: true });
      });
  }

  /**
   * Update the panel for a new job selection
   */
  jobChanged() {
    const { autoclassifyStatus, hasLogs, logsParsed, logParseStatus, job } = this.props;
    const { loadStatus, autoclassifyStatusOnLoad } = this.state;

    let newLoadStatus = 'loading';
    if (job.state === "pending" || job.state === "running") {
      newLoadStatus = "job_pending";
    } else if (!logsParsed || autoclassifyStatus === "pending") {
      newLoadStatus = "pending";
    } else if (logParseStatus === 'failed') {
      newLoadStatus = "failed";
    } else if (!hasLogs) {
      newLoadStatus = "no_logs";
    } else if (autoclassifyStatusOnLoad === null || autoclassifyStatusOnLoad === "cross_referenced") {
      if (loadStatus !== "ready") {
        newLoadStatus = "loading";
      }
      this.fetchErrorData()
        .then(data => this.buildLines(data))
        .catch(() => {
          this.setState({ loadStatus: "error" });
        });
    }

    this.setState({
      loadStatus: newLoadStatus,
      selectedLineIds: new Set(),
      editableLines: new Set(),
      inputByLine: new Map(),
      autoclassifyStatusOnLoad: null,
    });
  }

  /**
   * Toggle the selection of a ErrorLine, if the click didn't happen on an interactive
   * element child of that line.
   */
  toggleSelect(event, errorLine) {
    const elem = $(event.target);
    const { selectedLineIds } = this.state;
    const interactive = new Set(["INPUT", "BUTTON", "TEXTAREA", "A"]);

    if (interactive.has(elem.prop("tagName"))) {
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
  }

  render() {
    const { job, autoclassifyStatus, user, $injector } = this.props;
    const {
      errorLines,
      loadStatus,
      selectedLineIds,
      editableLineIds,
      canClassify,
      errorMatchers
    } = this.state;
    const loadStatusText = this.getLoadStatusText();
    const canSave = Array.from(selectedLineIds).every(id => this.canSave(id));
    const canSaveAll = this.canSaveAll();

    return (
      <React.Fragment>
        {canClassify && <AutoclassifyToolbar
          loadStatus={loadStatus}
          autoclassifyStatus={autoclassifyStatus}
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
        />}

        <div>
          {loadStatusText && <span>{loadStatusText}</span>}
          {loadStatus === 'loading' && <div className="overlay">
            <div>
              <span className="fa fa-spinner fa-pulse th-spinner-lg" />
            </div>
          </div>}
        </div>

        <span className="autoclassify-error-lines">
          <ul className="list-unstyled">
            {errorLines.map((errorLine, idx) => (<li key={errorLine.id}>
              <ErrorLine
                job={job}
                errorMatchers={errorMatchers}
                errorLine={errorLine}
                prevErrorLine={errorLines[idx - 1]}
                canClassify={canClassify}
                $injector={$injector}
                isSelected={selectedLineIds.has(errorLine.id)}
                isEditable={editableLineIds.has(errorLine.id)}
                setEditable={() => this.setEditable([errorLine.id], true)}
                setErrorLineInput={this.setErrorLineInput}
                toggleSelect={this.toggleSelect}
              />
            </li>))}
          </ul>
        </span>
      </React.Fragment>
    );
  }
}

AutoclassifyTab.propTypes = {
  $injector: PropTypes.object.isRequired,
  job: PropTypes.object.isRequired,
  hasLogs: PropTypes.bool.isRequired,
  autoclassifyStatus: PropTypes.string,
  user: PropTypes.object,
  logsParsed: PropTypes.bool,
  logParseStatus: PropTypes.string,
};

AutoclassifyTab.defaultProps = {
  autoclassifyStatus: 'pending',
  user: { is_staff: false, loggedin: false },
  logsParsed: false,
  logParseStatus: 'pending',
};

treeherder.directive('autoclassifyTab', ['reactDirective', '$injector', (reactDirective, $injector) =>
  reactDirective(AutoclassifyTab, undefined, {}, { $injector })]);
