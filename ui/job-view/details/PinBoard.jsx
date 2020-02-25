import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  Button,
  ButtonGroup,
  FormGroup,
  Input,
  FormFeedback,
  DropdownMenu,
  DropdownItem,
  DropdownToggle,
  UncontrolledDropdown,
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlusSquare, faTimes } from '@fortawesome/free-solid-svg-icons';

import { thEvents } from '../../helpers/constants';
import { formatModelError } from '../../helpers/errorMessage';
import { findJobInstance, getBtnClass } from '../../helpers/job';
import { isSHAorCommit } from '../../helpers/revision';
import { getBugUrl } from '../../helpers/url';
import BugJobMapModel from '../../models/bugJobMap';
import JobClassificationModel from '../../models/classification';
import JobModel from '../../models/job';
import { notify } from '../redux/stores/notifications';
import { setSelectedJob } from '../redux/stores/selectedJob';
import { recalculateUnclassifiedCounts } from '../redux/stores/pushes';
import {
  addBug,
  removeBug,
  unPinJob,
  unPinAll,
  setClassificationId,
  setClassificationComment,
} from '../redux/stores/pinnedJobs';

class PinBoard extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      enteringBugNumber: false,
      newBugNumber: null,
    };
  }

  componentDidMount() {
    window.addEventListener(thEvents.saveClassification, this.save);
  }

  componentWillUnmount() {
    window.removeEventListener(thEvents.saveClassification, this.save);
  }

  unPinAll = () => {
    this.props.unPinAll();
    this.setState({
      enteringBugNumber: false,
      newBugNumber: null,
    });
  };

  save = () => {
    const {
      isLoggedIn,
      pinnedJobs,
      recalculateUnclassifiedCounts,
      notify,
    } = this.props;

    let errorFree = true;
    if (this.state.enteringBugNumber) {
      // we should save this for the user, as they likely
      // just forgot to hit enter. Returns false if invalid
      errorFree = this.saveEnteredBugNumber();
      if (!errorFree) {
        notify('Please enter a valid bug number', 'danger');
      }
    }
    if (!this.canSaveClassifications() && isLoggedIn) {
      notify('Please classify this failure before saving', 'danger');
      errorFree = false;
    }
    if (!isLoggedIn) {
      notify('Must be logged in to save job classifications', 'danger');
      errorFree = false;
    }
    if (errorFree) {
      const jobs = Object.values(pinnedJobs);
      const classifyPromises = jobs.map(job => this.saveClassification(job));
      const bugPromises = jobs.map(job => this.saveBugs(job));
      Promise.all([...classifyPromises, ...bugPromises]).then(() => {
        window.dispatchEvent(new CustomEvent(thEvents.classificationChanged));
        recalculateUnclassifiedCounts();
        this.unPinAll();
        this.setState({
          enteringBugNumber: false,
          newBugNumber: null,
        });
      });

      // HACK: it looks like Firefox on Linux and Windows doesn't
      // want to accept keyboard input after this change for some
      // reason which I don't understand. Chrome (any platform)
      // or Firefox on Mac works fine though.
      document.getElementById('keyboard-shortcuts').focus();
    }
  };

  createNewClassification = () => {
    const { email } = this.props;
    const {
      failureClassificationId,
      failureClassificationComment,
    } = this.props;

    return new JobClassificationModel({
      text: failureClassificationComment,
      who: email,
      failure_classification_id: failureClassificationId,
    });
  };

  saveClassification = async pinnedJob => {
    const { recalculateUnclassifiedCounts, notify, jobMap } = this.props;
    const classification = this.createNewClassification();
    // Ensure the version of the job we have is the one that is displayed in
    // the main job field.  Not the "full" selected job instance only shown in
    // the job details panel.
    const job = jobMap[pinnedJob.id];

    // classification can be left unset making this a no-op
    if (classification.failure_classification_id > 0) {
      job.failure_classification_id = classification.failure_classification_id;
      // update the unclassified failure count for the page
      recalculateUnclassifiedCounts();

      classification.job_id = job.id;
      const { data, failureStatus } = await classification.create();
      if (!failureStatus) {
        notify(`Classification saved for ${job.title}`, 'success');
        // update the job to show that it's now classified
        const jobInstance = findJobInstance(job.id);

        // Filter in case we are hiding unclassified.  Also causes a repaint on the job
        // to show it if has been newly classified or not.
        if (jobInstance) {
          jobInstance.refilter();
        }
      } else {
        const message = `Error saving classification for ${job.platform} ${job.job_type_name}: ${data}`;
        notify(message, 'danger');
      }
    }
  };

  saveBugs = job => {
    const { pinnedJobBugs, notify } = this.props;

    Object.values(pinnedJobBugs).forEach(bug => {
      const bjm = new BugJobMapModel({
        bug_id: bug.id,
        job_id: job.id,
        type: 'annotation',
      });

      bjm
        .create()
        .then(() => {
          notify(
            `Bug association saved for ${job.platform} ${job.job_type_name}`,
            'success',
          );
        })
        .catch(response => {
          const message = `Error saving bug association for ${job.platform} ${job.job_type_name}`;
          notify(formatModelError(response, message), 'danger');
        });
    });
  };

  // If the pasted data is (or looks like) a 12 or 40 char SHA,
  // or if the pasted data is an hg.m.o url, automatically select
  // the 'fixed by commit' classification type
  pasteSHA = evt => {
    const pastedData = evt.clipboardData.getData('text');

    if (isSHAorCommit(pastedData)) {
      this.props.setClassificationId(2);
    }
  };

  cancelAllPinnedJobsTitle = () => {
    if (!this.props.isLoggedIn) {
      return 'Not logged in';
    }

    if (!this.canCancelAllPinnedJobs()) {
      return 'No pending / running jobs in pinBoard';
    }

    return 'Cancel all the pinned jobs';
  };

  canCancelAllPinnedJobs = () => {
    const cancellableJobs = Object.values(this.props.pinnedJobs).filter(
      job => job.state === 'pending' || job.state === 'running',
    );

    return this.props.isLoggedIn && cancellableJobs.length > 0;
  };

  cancelAllPinnedJobs = () => {
    const { notify, currentRepo, pinnedJobs, decisionTaskMap } = this.props;

    if (
      window.confirm('This will cancel all the selected jobs. Are you sure?')
    ) {
      JobModel.cancel(
        Object.values(pinnedJobs),
        currentRepo,
        notify,
        decisionTaskMap,
      );
      this.unPinAll();
    }
  };

  canSaveClassifications = () => {
    const { pinnedJobBugs, isLoggedIn, currentRepo } = this.props;
    const {
      failureClassificationId,
      failureClassificationComment,
    } = this.props;

    return (
      this.hasPinnedJobs() &&
      isLoggedIn &&
      (!!Object.keys(pinnedJobBugs).length ||
        (failureClassificationId !== 4 && failureClassificationId !== 2) ||
        currentRepo.is_try_repo ||
        currentRepo.repository_group.name === 'project repositories' ||
        (failureClassificationId === 4 &&
          failureClassificationComment.length > 0) ||
        (failureClassificationId === 2 &&
          failureClassificationComment.length > 7))
    );
  };

  // Facilitates Clear all if no jobs pinned to reset pinBoard UI
  pinboardIsDirty = () => {
    const {
      failureClassificationId,
      failureClassificationComment,
    } = this.props;

    return (
      failureClassificationComment !== '' ||
      !!Object.keys(this.props.pinnedJobBugs).length ||
      failureClassificationId !== 4
    );
  };

  // Dynamic btn/anchor title for classification save
  saveUITitle = category => {
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
  };

  hasPinnedJobs = () => !!Object.keys(this.props.pinnedJobs).length;

  hasPinnedJobBugs = () => !!Object.keys(this.props.pinnedJobBugs).length;

  handleRelatedBugDocumentClick = event => {
    if (!event.target.classList.contains('add-related-bugs-input')) {
      this.saveEnteredBugNumber();
      document.removeEventListener('click', this.handleRelatedBugDocumentClick);
    }
  };

  handleRelatedBugEscape = event => {
    if (event.key === 'Escape') {
      this.toggleEnterBugNumber(false);
    }
  };

  toggleEnterBugNumber = tf => {
    this.setState(
      {
        enteringBugNumber: tf,
      },
      () => {
        if (tf) {
          document.getElementById('related-bug-input').focus();
          // Bind escape to canceling the bug entry.
          document.addEventListener('keydown', this.handleRelatedBugEscape);
          // Install a click handler on the document so that clicking
          // outside of the input field will close it. A blur handler
          // can't be used because it would have timing issues with the
          // click handler on the + icon.
          document.addEventListener(
            'click',
            this.handleRelatedBugDocumentClick,
          );
        } else {
          document.removeEventListener('keydown', this.handleRelatedBugEscape);
          document.removeEventListener(
            'click',
            this.handleRelatedBugDocumentClick,
          );
        }
      },
    );
  };

  isNumber = text => !text || /^[0-9]*$/.test(text);

  saveEnteredBugNumber = () => {
    const { newBugNumber, enteringBugNumber } = this.state;

    if (enteringBugNumber) {
      if (!newBugNumber) {
        this.toggleEnterBugNumber(false);
      } else if (this.isNumber(newBugNumber)) {
        this.props.addBug({ id: parseInt(newBugNumber, 10) });
        this.toggleEnterBugNumber(false);
        return true;
      }
    }
  };

  bugNumberKeyPress = ev => {
    if (ev.key === 'Enter') {
      this.saveEnteredBugNumber(ev.target.value);
      if (ev.ctrlKey) {
        // If ctrl+enter, then save the classification
        this.save();
      }
      ev.preventDefault();
    }
  };

  retriggerAllPinnedJobs = async () => {
    const { pinnedJobs, notify, currentRepo, decisionTaskMap } = this.props;
    const jobs = Object.values(pinnedJobs);

    JobModel.retrigger(jobs, currentRepo, notify, 1, decisionTaskMap);
  };

  render() {
    const {
      selectedJobFull,
      revisionTips,
      isLoggedIn,
      isPinBoardVisible,
      classificationTypes,
      pinnedJobs,
      pinnedJobBugs,
      removeBug,
      unPinJob,
      setSelectedJob,
      setClassificationId,
      setClassificationComment,
      failureClassificationId,
      failureClassificationComment,
    } = this.props;
    const { enteringBugNumber, newBugNumber } = this.state;
    const selectedJobId = selectedJobFull ? selectedJobFull.id : null;

    return (
      <div id="pinboard-panel" className={isPinBoardVisible ? '' : 'hidden'}>
        <div id="pinboard-contents">
          <div id="pinned-job-list">
            <div className="content">
              {!this.hasPinnedJobs() && (
                <span className="pinboard-preload-txt">
                  press spacebar to pin a selected job
                </span>
              )}
              {Object.values(pinnedJobs).map(job => (
                <span className="btn-group" key={job.id}>
                  <Button
                    className={`pinned-job mb-1 ${getBtnClass(
                      job.resultStatus,
                      job.failure_classification_id,
                    )} ${selectedJobId === job.id ? 'selected-job' : ''}`}
                    title={job.hoverText}
                    onClick={() => setSelectedJob(job)}
                    data-job-id={job.job_id}
                    size={selectedJobId === job.id ? 'large' : 'small'}
                    outline
                  >
                    {job.job_type_symbol}
                  </Button>
                  <Button
                    color="secondary"
                    outline
                    className={`pinned-job-close-btn ${
                      selectedJobId === job.id
                        ? 'btn-lg selected-job'
                        : 'btn-xs'
                    }`}
                    onClick={() => unPinJob(job)}
                    title="un-pin this job"
                  >
                    <FontAwesomeIcon icon={faTimes} title="Unpin job" />
                  </Button>
                </span>
              ))}
            </div>
          </div>

          {/* Related bugs */}
          <div id="pinboard-related-bugs">
            <div className="content">
              <Button
                color="link"
                id="add-related-bug-button"
                onClick={() => this.toggleEnterBugNumber(!enteringBugNumber)}
                className="pointable p-0"
                title="Add a related bug"
              >
                <FontAwesomeIcon
                  icon={faPlusSquare}
                  className="add-related-bugs-icon"
                  title="Add related bugs"
                />
              </Button>
              {!this.hasPinnedJobBugs() && (
                <Button
                  color="link"
                  className="pinboard-preload-txt pinboard-related-bug-preload-txt p-0 text-decoration-none"
                  onClick={() => {
                    this.toggleEnterBugNumber(!enteringBugNumber);
                  }}
                >
                  click to add a related bug
                </Button>
              )}
              {enteringBugNumber && (
                <span className="add-related-bugs-form">
                  <Input
                    id="related-bug-input"
                    data-bug-input
                    type="text"
                    pattern="[0-9]*"
                    className="add-related-bugs-input"
                    placeholder="enter bug number"
                    invalid={!this.isNumber(newBugNumber)}
                    onKeyPress={this.bugNumberKeyPress}
                    onChange={ev =>
                      this.setState({ newBugNumber: ev.target.value })
                    }
                  />
                  <FormFeedback>Please enter only numbers</FormFeedback>
                </span>
              )}
              {Object.values(pinnedJobBugs).map(bug => (
                <span key={bug.id}>
                  <span className="btn-group pinboard-related-bugs-btn">
                    <a
                      className="btn btn-xs related-bugs-link"
                      title={bug.summary}
                      href={getBugUrl(bug.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <em>{bug.id}</em>
                    </a>
                    <Button
                      color="secondary"
                      outline
                      className="btn-xs pinned-job-close-btn"
                      onClick={() => removeBug(bug.id)}
                      title="remove this bug"
                    >
                      <FontAwesomeIcon icon={faTimes} title="Remove bug" />
                    </Button>
                  </span>
                </span>
              ))}
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
                  onChange={evt =>
                    setClassificationId(parseInt(evt.target.value, 10))
                  }
                >
                  {classificationTypes.map(opt => (
                    <option value={opt.id} key={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </Input>
              </FormGroup>
              {/* Classification comment */}
              <div className="classification-comment-container">
                <input
                  id="classification-comment"
                  type="text"
                  className="form-control add-classification-input"
                  onChange={evt => setClassificationComment(evt.target.value)}
                  onPaste={this.pasteSHA}
                  placeholder="click to add comment"
                  value={failureClassificationComment}
                />
                {failureClassificationId === 2 && (
                  <div>
                    <FormGroup>
                      <Input
                        id="pinboard-revision-select"
                        className="classification-select"
                        type="select"
                        defaultValue={0}
                        onChange={evt =>
                          setClassificationComment(evt.target.value)
                        }
                      >
                        <option value="0" disabled>
                          Choose a recent commit
                        </option>
                        {revisionTips.slice(0, 20).map(tip => (
                          <option
                            title={tip.title}
                            value={tip.revision}
                            key={tip.revision}
                          >
                            {tip.revision.slice(0, 12)} {tip.author}
                          </option>
                        ))}
                      </Input>
                    </FormGroup>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Save UI */}
          <div
            id="pinboard-controls"
            className="btn-group-vertical"
            title={this.hasPinnedJobs() ? '' : 'No pinned jobs'}
          >
            <ButtonGroup className="save-btn-group">
              <Button
                className={`btn-light-bordered save-btn ${
                  !isLoggedIn || !this.canSaveClassifications()
                    ? 'disabled'
                    : ''
                }`}
                outline
                size="xs"
                title={this.saveUITitle('classification')}
                onClick={this.save}
              >
                save
              </Button>
              <UncontrolledDropdown>
                <DropdownToggle
                  size="xs"
                  caret
                  className={`btn-light-bordered ${
                    !this.hasPinnedJobs() && !this.pinboardIsDirty()
                      ? 'disabled'
                      : ''
                  }`}
                  title={
                    !this.hasPinnedJobs() && !this.pinboardIsDirty()
                      ? 'No pinned jobs'
                      : 'Additional pinboard functions'
                  }
                  outline
                />
                <DropdownMenu className="save-btn-dropdown-menu">
                  <DropdownItem
                    tag="a"
                    title={
                      !isLoggedIn ? 'Not logged in' : 'Repeat the pinned jobs'
                    }
                    className={!isLoggedIn ? 'disabled' : ''}
                    onClick={() => !isLoggedIn || this.retriggerAllPinnedJobs()}
                  >
                    Retrigger all
                  </DropdownItem>
                  <DropdownItem
                    tag="a"
                    title={this.cancelAllPinnedJobsTitle()}
                    className={this.canCancelAllPinnedJobs() ? '' : 'disabled'}
                    onClick={() =>
                      this.canCancelAllPinnedJobs() &&
                      this.cancelAllPinnedJobs()
                    }
                  >
                    Cancel all
                  </DropdownItem>
                  <DropdownItem tag="a" onClick={() => this.unPinAll()}>
                    Clear all
                  </DropdownItem>
                </DropdownMenu>
              </UncontrolledDropdown>
            </ButtonGroup>
          </div>
        </div>
      </div>
    );
  }
}

PinBoard.propTypes = {
  recalculateUnclassifiedCounts: PropTypes.func.isRequired,
  decisionTaskMap: PropTypes.object.isRequired,
  jobMap: PropTypes.object.isRequired,
  classificationTypes: PropTypes.array.isRequired,
  isLoggedIn: PropTypes.bool.isRequired,
  isPinBoardVisible: PropTypes.bool.isRequired,
  pinnedJobs: PropTypes.object.isRequired,
  pinnedJobBugs: PropTypes.object.isRequired,
  addBug: PropTypes.func.isRequired,
  removeBug: PropTypes.func.isRequired,
  unPinJob: PropTypes.func.isRequired,
  unPinAll: PropTypes.func.isRequired,
  setClassificationId: PropTypes.func.isRequired,
  setClassificationComment: PropTypes.func.isRequired,
  setSelectedJob: PropTypes.func.isRequired,
  notify: PropTypes.func.isRequired,
  currentRepo: PropTypes.object.isRequired,
  failureClassificationId: PropTypes.number.isRequired,
  failureClassificationComment: PropTypes.string.isRequired,
  selectedJobFull: PropTypes.object,
  email: PropTypes.string,
  revisionTips: PropTypes.array,
};

PinBoard.defaultProps = {
  selectedJobFull: null,
  email: null,
  revisionTips: [],
};

const mapStateToProps = ({
  pushes: { revisionTips, decisionTaskMap, jobMap },
  pinnedJobs: {
    isPinBoardVisible,
    pinnedJobs,
    pinnedJobBugs,
    failureClassificationId,
    failureClassificationComment,
  },
}) => ({
  revisionTips,
  decisionTaskMap,
  jobMap,
  isPinBoardVisible,
  pinnedJobs,
  pinnedJobBugs,
  failureClassificationId,
  failureClassificationComment,
});

export default connect(mapStateToProps, {
  notify,
  setSelectedJob,
  recalculateUnclassifiedCounts,
  addBug,
  removeBug,
  unPinJob,
  unPinAll,
  setClassificationId,
  setClassificationComment,
})(PinBoard);
