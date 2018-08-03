import React from 'react';
import PropTypes from 'prop-types';
import { FormGroup, Input, FormFeedback } from 'reactstrap';
import $ from 'jquery';
import Mousetrap from 'mousetrap';

import { thEvents } from '../../js/constants';
import { formatModelError } from '../../helpers/errorMessage';
import { getJobBtnClass, getHoverText } from '../../helpers/job';
import { isSHAorCommit } from '../../helpers/revision';
import { getBugUrl } from '../../helpers/url';
import BugJobMapModel from '../../models/bugJobMap';
import JobClassificationModel from '../../models/classification';
import JobModel from '../../models/job';

export default class PinBoard extends React.Component {
  constructor(props) {
    super(props);

    const { $injector } = this.props;
    this.thNotify = $injector.get('thNotify');
    this.$timeout = $injector.get('$timeout');
    this.ThResultSetStore = $injector.get('ThResultSetStore');
    this.$rootScope = $injector.get('$rootScope');

    this.state = {
      failureClassificationId: 4,
      failureClassificationComment: '',
      enteringBugNumber: false,
      newBugNumber: null,
    };
  }

  componentDidMount() {
    this.bugNumberKeyPress = this.bugNumberKeyPress.bind(this);
    this.save = this.save.bind(this);
    this.handleRelatedBugDocumentClick = this.handleRelatedBugDocumentClick.bind(this);
    this.unPinAll = this.unPinAll.bind(this);
    this.retriggerAllPinnedJobs = this.retriggerAllPinnedJobs.bind(this);
    this.pasteSHA = this.pasteSHA.bind(this);

    this.addRelatedBugUnlisten = this.$rootScope.$on(thEvents.addRelatedBug, (event, job) => {
      this.props.pinJob(job);
      this.toggleEnterBugNumber(true);
    });

    this.saveClassificationUnlisten = this.$rootScope.$on(thEvents.saveClassification, () => {
      this.save();
    });
  }

  componentWillUnmount() {
    this.addRelatedBugUnlisten();
    this.saveClassificationUnlisten();
  }

  setClassificationId(evt) {
    this.setState({ failureClassificationId: parseInt(evt.target.value) });
  }

  setClassificationText(evt) {
    this.setState({ failureClassificationComment: evt.target.value });
  }

  unPinAll() {
    this.props.unPinAll();
    this.setState({
      failureClassificationId: 4,
      failureClassificationComment: '',
      enteringBugNumber: false,
      newBugNumber: null,
    });
  }

  save() {
    const { isLoggedIn, pinnedJobs } = this.props;

    let errorFree = true;
    if (this.state.enteringBugNumber) {
      // we should save this for the user, as they likely
      // just forgot to hit enter. Returns false if invalid
      errorFree = this.saveEnteredBugNumber();
      if (!errorFree) {
        this.$timeout(this.thNotify.send('Please enter a valid bug number', 'danger'));
      }
    }
    if (!this.canSaveClassifications() && isLoggedIn) {
      this.$timeout(this.thNotify.send('Please classify this failure before saving', 'danger'));
      errorFree = false;
    }
    if (!isLoggedIn) {
      this.$timeout(this.thNotify.send('Must be logged in to save job classifications', 'danger'));
      errorFree = false;
    }
    if (errorFree) {
      const jobs = Object.values(pinnedJobs);
      const classifyPromises = jobs.map(job => this.saveClassification(job));
      const bugPromises = jobs.map(job => this.saveBugs(job));
      Promise.all([...classifyPromises, ...bugPromises]).then(() => {
        this.$rootScope.$emit(thEvents.jobsClassified, { jobs: [...jobs] });
        this.unPinAll();
        this.completeClassification();
        this.setState({
          failureClassificationId: 4,
          failureClassificationComment: '',
          enteringBugNumber: false,
          newBugNumber: null,
        });
      });

      // HACK: it looks like Firefox on Linux and Windows doesn't
      // want to accept keyboard input after this change for some
      // reason which I don't understand. Chrome (any platform)
      // or Firefox on Mac works fine though.
      document.activeElement.blur();
    }
  }

  createNewClassification() {
    const { email } = this.props;
    const { failureClassificationId, failureClassificationComment } = this.state;

    return new JobClassificationModel({
      text: failureClassificationComment,
      who: email,
      failure_classification_id: failureClassificationId,
    });
  }

  saveClassification(job) {
    const classification = this.createNewClassification();

    // classification can be left unset making this a no-op
    if (classification.failure_classification_id > 0) {
      job.failure_classification_id = classification.failure_classification_id;
      // update the unclassified failure count for the page
      this.ThResultSetStore.updateUnclassifiedFailureMap(job);

      classification.job_id = job.id;
      return classification.create().then(() => {
          this.thNotify.send(`Classification saved for ${job.platform} ${job.job_type_name}`, 'success');
        }).catch((response) => {
          const message = `Error saving classification for ${job.platform} ${job.job_type_name}`;
          this.thNotify.send(formatModelError(response, message), 'danger');
        });
    }
  }

  saveBugs(job) {
    const { pinnedJobBugs } = this.props;

    Object.values(pinnedJobBugs).forEach((bug) => {
      const bjm = new BugJobMapModel({
        bug_id: bug.id,
        job_id: job.id,
        type: 'annotation',
      });

      bjm.create()
        .then(() => {
          this.thNotify.send(`Bug association saved for ${job.platform} ${job.job_type_name}`, 'success');
        })
        .catch((response) => {
          const message = `Error saving bug association for ${job.platform} ${job.job_type_name}`;
          this.thNotify.send(formatModelError(response, message), 'danger');
      });
    });
  }

  // If the pasted data is (or looks like) a 12 or 40 char SHA,
  // or if the pasted data is an hg.m.o url, automatically select
  // the 'fixed by commit' classification type
  pasteSHA(evt) {
    const pastedData = evt.clipboardData.getData('text');

    if (isSHAorCommit(pastedData)) {
      this.setState({ failureClassificationId: 2 });
    }
  }

  retriggerAllPinnedJobs() {
    // pushing pinned jobs to a list.
    const jobIds = Object.keys(this.props.pinnedJobs);
    const plurality = jobIds.length > 1 ? 's' : '';

    JobModel.retrigger(this.$rootScope.repoName, jobIds)
      .then((resp) => {
        if (resp.ok) {
          this.thNotify.send(
            `Retrigger request sent for ${jobIds.length} pinned job${plurality}`,
            'success');
        } else {
          throw new Error(formatModelError(resp, `Unable to send retrigger${plurality}`));
        }
      })
      .catch(error => this.$timeout(this.thNotify.send(error, 'danger')))
      .finally(() => this.$rootScope.$apply());
  }

  cancelAllPinnedJobsTitle() {
    if (!this.props.isLoggedIn) {
      return 'Not logged in';
    } else if (!this.canCancelAllPinnedJobs()) {
      return 'No pending / running jobs in pinBoard';
    }

    return 'Cancel all the pinned jobs';
  }

  canCancelAllPinnedJobs() {
    const cancellableJobs = Object.values(this.props.pinnedJobs).filter(
      job => (job.state === 'pending' || job.state === 'running'));

    return this.props.isLoggedIn && cancellableJobs.length > 0;
  }

  async cancelAllPinnedJobs() {
    if (window.confirm('This will cancel all the selected jobs. Are you sure?')) {
      await JobModel.cancel(this.$rootScope.repoName, Object.keys(this.props.pinnedJobs));
      this.unPinAll();
    }
  }

  canSaveClassifications() {
    const { pinnedJobBugs, isLoggedIn } = this.props;
    const { failureClassificationId, failureClassificationComment } = this.state;

    return this.hasPinnedJobs() && isLoggedIn &&
      (!!Object.keys(pinnedJobBugs).length ||
        (failureClassificationId !== 4 && failureClassificationId !== 2) ||
        this.$rootScope.currentRepo.is_try_repo ||
        this.$rootScope.currentRepo.repository_group.name === 'project repositories' ||
        (failureClassificationId === 4 && failureClassificationComment.length > 0) ||
        (failureClassificationId === 2 && failureClassificationComment.length > 7));
  }

  // Facilitates Clear all if no jobs pinned to reset pinBoard UI
  pinboardIsDirty() {
    const { failureClassificationId, failureClassificationComment } = this.state;

    return failureClassificationComment !== '' ||
      !!Object.keys(this.props.pinnedJobBugs).length ||
      failureClassificationId !== 4;
  }

  // Dynamic btn/anchor title for classification save
  saveUITitle(category) {
    let title = '';

    if (!this.props.isLoggedIn) {
      title = title.concat('not logged in / ');
    }

    if (category === 'classification') {
      if (!this.canSaveClassifications()) {
        title = title.concat('ineligible classification data / ');
      }
      if (!this.hasPinnedJobs()) {
        title = title.concat('no pinned jobs');
      }
      // We don't check pinned jobs because the menu dropdown handles it
    } else if (category === 'bug') {
      if (!this.hasPinnedJobBugs()) {
        title = title.concat('no related bugs');
      }
    }

    if (title === '') {
      title = `Save ${category} data`;
    } else {
      // Cut off trailing '/ ' if one exists, capitalize first letter
      title = title.replace(/\/ $/, '');
      title = title.replace(/^./, l => l.toUpperCase());
    }
    return title;
  }

  hasPinnedJobs() {
    return !!Object.keys(this.props.pinnedJobs).length;
  }

  hasPinnedJobBugs() {
    return !!Object.keys(this.props.pinnedJobBugs).length;
  }

  handleRelatedBugDocumentClick(event) {
    if (!$(event.target).hasClass('add-related-bugs-input')) {
      this.saveEnteredBugNumber();

      $(document).off('click', this.handleRelatedBugDocumentClick);
    }
  }

  toggleEnterBugNumber(tf) {
    this.setState({
      enteringBugNumber: tf,
    }, () => {
      $('#related-bug-input').focus();
    });

    // document.off('click', this.handleRelatedBugDocumentClick);
    if (tf) {
      // Rebind escape to canceling the bug entry, pressing escape
      // again will close the pinBoard as usual.
      Mousetrap.bind('escape', () => {
        const cancel = this.toggleEnterBugNumber.bind(this, false);
        cancel();
      });

      // Install a click handler on the document so that clicking
      // outside of the input field will close it. A blur handler
      // can't be used because it would have timing issues with the
      // click handler on the + icon.
      window.setTimeout(() => {
        $(document).on('click', this.handleRelatedBugDocumentClick);
      }, 0);
    }
  }

  completeClassification() {
    this.$rootScope.$broadcast('blur-this', 'classification-comment');
  }

  isNumber(text) {
    return !text || /^[0-9]*$/.test(text);
  }

  saveEnteredBugNumber() {
    const { newBugNumber, enteringBugNumber } = this.state;

    if (enteringBugNumber) {
      if (!newBugNumber) {
        this.toggleEnterBugNumber(false);
      } else if (this.isNumber(newBugNumber)) {
        this.props.addBug({ id: parseInt(newBugNumber) });
        this.toggleEnterBugNumber(false);
        return true;
      }
    }
  }

  bugNumberKeyPress(ev) {
    if (ev.key === 'Enter') {
      this.saveEnteredBugNumber(ev.target.value);
      if (ev.ctrlKey) {
        // If ctrl+enter, then save the classification
        this.save();
      }
      ev.preventDefault();
    }
  }

  viewJob(job) {
    this.$rootScope.selectedJob = job;
    this.$rootScope.$emit(thEvents.jobClick, job);
  }

  render() {
    const {
      selectedJob, revisionList, isLoggedIn, isVisible, classificationTypes,
      pinnedJobs, pinnedJobBugs, removeBug, unPinJob,
    } = this.props;
    const {
      failureClassificationId, failureClassificationComment,
      enteringBugNumber, newBugNumber,
    } = this.state;
    const selectedJobId = selectedJob ? selectedJob.id : null;

    return (
      <div
        id="pinboard-panel"
        className={isVisible ? '' : 'hidden'}
      >
        <div id="pinboard-contents">
          <div id="pinned-job-list">
            <div className="content">
              {!this.hasPinnedJobs() && <span
                className="pinboard-preload-txt"
              >press spacebar to pin a selected job</span>}
              {Object.values(pinnedJobs).map(job => (
                <span className="btn-group" key={job.id}>
                  <span
                    className={`btn pinned-job ${getJobBtnClass(job)} ${selectedJobId === job.id ? 'btn-lg selected-job' : 'btn-xs'}`}
                    title={getHoverText(job)}
                    onClick={() => this.viewJob(job)}
                    data-job-id={job.job_id}
                  >{job.job_type_symbol}</span>
                  <span
                    className={`btn btn-ltgray pinned-job-close-btn ${selectedJobId === job.id ? 'btn-lg selected-job' : 'btn-xs'}`}
                    onClick={() => unPinJob(job.id)}
                    title="un-pin this job"
                  ><i className="fa fa-times" /></span>
                </span>
              ))}
            </div>
          </div>

          {/* Related bugs */}
          <div id="pinboard-related-bugs">
            <div className="content">
              <span
                onClick={() => this.toggleEnterBugNumber(!enteringBugNumber)}
                className="pointable"
                title="Add a related bug"
              ><i className="fa fa-plus-square add-related-bugs-icon" /></span>
              {!this.hasPinnedJobBugs() && <span
                className="pinboard-preload-txt pinboard-related-bug-preload-txt"
                onClick={() => {
                  this.toggleEnterBugNumber(!enteringBugNumber);
                }}
              >click to add a related bug</span>}
              {enteringBugNumber && <span
                className="add-related-bugs-form"
              >
                <Input
                  id="related-bug-input"
                  data-bug-input
                  type="text"
                  pattern="[0-9]*"
                  className="add-related-bugs-input"
                  placeholder="enter bug number"
                  invalid={!this.isNumber(newBugNumber)}
                  onKeyPress={this.bugNumberKeyPress}
                  onChange={ev => this.setState({ newBugNumber: ev.target.value })}
                />
                <FormFeedback>Please enter only numbers</FormFeedback>
              </span>}
              {Object.values(pinnedJobBugs).map(bug => (<span key={bug.id}>
                <span className="btn-group pinboard-related-bugs-btn">
                  <a
                    className="btn btn-xs related-bugs-link"
                    title={bug.summary}
                    href={getBugUrl(bug.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                  ><em>{bug.id}</em></a>
                  <span
                    className="btn btn-ltgray btn-xs pinned-job-close-btn"
                    onClick={() => removeBug(bug.id)}
                    title="remove this bug"
                  ><i className="fa fa-times" /></span>
                </span>
              </span>))}
            </div>
          </div>

          {/* Classification dropdown */}
          <div id="pinboard-classification">
            <div className="pinboard-label">classification</div>
            <div id="pinboard-classification-content" className="content">
              <FormGroup>
                <Input
                  type="select"
                  name="failureClassificationId"
                  id="pinboard-classification-select"
                  className="classification-select"
                  value={failureClassificationId}
                  onChange={evt => this.setClassificationId(evt)}
                >
                  {classificationTypes.classificationOptions.map(opt => (
                    <option value={opt.id} key={opt.id}>{opt.name}</option>
                  ))}
                </Input>
              </FormGroup>
              {/* Classification comment */}
              <div className="classification-comment-container">
                <input
                  id="classification-comment"
                  type="text"
                  className="form-control add-classification-input"
                  onChange={evt => this.setClassificationText(evt)}
                  onPaste={this.pasteSHA}
                  placeholder="click to add comment"
                  value={failureClassificationComment}
                />
                {failureClassificationId === 2 && <div>
                  <FormGroup>
                    <Input
                      id="pinboard-revision-select"
                      className="classification-select"
                      type="select"
                      defaultValue={0}
                      onChange={evt => this.setClassificationText(evt)}
                    >
                      <option value="0" disabled>Choose a recent
                        commit
                      </option>
                      {revisionList.slice(0, 20).map(tip => (<option
                        title={tip.title}
                        value={tip.revision}
                        key={tip.revision}
                      >{tip.revision.slice(0, 12)} {tip.author}</option>))}
                    </Input>
                  </FormGroup>
                </div>}
              </div>
            </div>
          </div>

          {/* Save UI */}
          <div
            id="pinboard-controls"
            className="btn-group-vertical"
            title={this.hasPinnedJobs() ? '' : 'No pinned jobs'}
          >
            <div className="btn-group save-btn-group dropdown">
              <button
                className={`btn btn-light-bordered btn-xs save-btn ${!isLoggedIn || !this.canSaveClassifications() ? 'disabled' : ''}`}
                title={this.saveUITitle('classification')}
                onClick={this.save}
              >save
              </button>
              <button
                className={`btn btn-light-bordered btn-xs dropdown-toggle save-btn-dropdown ${!this.hasPinnedJobs() && !this.pinboardIsDirty() ? 'disabled' : ''}`}
                title={!this.hasPinnedJobs() && !this.pinboardIsDirty() ? 'No pinned jobs' : 'Additional pinboard functions'}
                type="button"
                data-toggle="dropdown"
              >
                <span className="caret" />
              </button>
              <ul className="dropdown-menu save-btn-dropdown-menu">
                <li
                  className={!isLoggedIn ? 'disabled' : ''}
                  title={!isLoggedIn ? 'Not logged in' : 'Repeat the pinned jobs'}
                >
                  <a
                    className="dropdown-item"
                    onClick={() => !isLoggedIn || this.retriggerAllPinnedJobs()}
                  >Retrigger all</a></li>
                <li
                  className={this.canCancelAllPinnedJobs() ? '' : 'disabled'}
                  title={this.cancelAllPinnedJobsTitle()}
                >
                  <a
                    className="dropdown-item"
                    onClick={() => this.canCancelAllPinnedJobs() && this.cancelAllPinnedJobs()}
                  >Cancel all</a>
                </li>
                <li><a className="dropdown-item" onClick={() => this.unPinAll()}>Clear
                  all</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

PinBoard.propTypes = {
  $injector: PropTypes.object.isRequired,
  classificationTypes: PropTypes.object.isRequired,
  isLoggedIn: PropTypes.bool.isRequired,
  isVisible: PropTypes.bool.isRequired,
  pinnedJobs: PropTypes.object.isRequired,
  pinnedJobBugs: PropTypes.object.isRequired,
  addBug: PropTypes.func.isRequired,
  removeBug: PropTypes.func.isRequired,
  unPinJob: PropTypes.func.isRequired,
  pinJob: PropTypes.func.isRequired,
  unPinAll: PropTypes.func.isRequired,
  selectedJob: PropTypes.object,
  email: PropTypes.string,
  revisionList: PropTypes.array,
};

PinBoard.defaultProps = {
  selectedJob: null,
  email: null,
  revisionList: [],
};
