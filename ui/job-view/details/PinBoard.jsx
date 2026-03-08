import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, ButtonGroup, Form, Dropdown } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlusSquare, faTimes } from '@fortawesome/free-solid-svg-icons';

import { thEvents } from '../../helpers/constants';
import { formatModelError } from '../../helpers/errorMessage';
import { getBtnClass } from '../../helpers/job';
import { isSHAorCommit } from '../../helpers/revision';
import { getBugUrl } from '../../helpers/url';
import BugJobMapModel from '../../models/bugJobMap';
import JobClassificationModel from '../../models/classification';
import JobClassificationTypeAndBugsModel from '../../models/classificationTypeAndBugs';
import JobModel from '../../models/job';
import { setSelectedJob } from '../stores/selectedJobStore';
import { notify } from '../stores/notificationStore';
import {
  usePushesStore,
  recalculateUnclassifiedCounts,
} from '../stores/pushesStore';
import {
  usePinnedJobsStore,
  addBug,
  removeBug,
  unPinJob,
  unPinAll,
  setClassificationId,
  setClassificationComment,
} from '../stores/pinnedJobsStore';

function PinBoard({
  selectedJobFull = null,
  isLoggedIn,
  isStaff = false,
  classificationTypes,
  currentRepo,
}) {
  const revisionTips = usePushesStore((state) => state.revisionTips) || [];
  const decisionTaskMap = usePushesStore((state) => state.decisionTaskMap);
  const jobMap = usePushesStore((state) => state.jobMap);

  const {
    isPinBoardVisible,
    pinnedJobs,
    pinnedJobBugs,
    failureClassificationId,
    failureClassificationComment,
  } = usePinnedJobsStore();

  const [enteringBugNumber, setEnteringBugNumber] = useState(false);
  const [newBugNumber, setNewBugNumber] = useState(null);
  const bugInputRef = useRef(null);

  const hasPinnedJobs = !!Object.keys(pinnedJobs).length;
  const hasPinnedJobBugs = !!pinnedJobBugs.length;
  const selectedJobId = selectedJobFull ? selectedJobFull.id : null;

  // Focus bug input when entering bug number mode
  useEffect(() => {
    if (enteringBugNumber && bugInputRef.current) {
      bugInputRef.current.focus();
    }
  }, [enteringBugNumber]);

  const handleUnPinAll = useCallback(() => {
    unPinAll();
    setEnteringBugNumber(false);
    setNewBugNumber(null);
  }, []);

  const createNewClassification = useCallback(() => {
    const state = usePinnedJobsStore.getState();
    return new JobClassificationModel({
      text: state.failureClassificationComment,
      who: null,
      failure_classification_id: state.failureClassificationId,
    });
  }, []);

  const saveClassification = useCallback(
    async (pinnedJob) => {
      const classification = createNewClassification();
      const job = jobMap[pinnedJob.id];

      if (classification.failure_classification_id > 0) {
        job.failure_classification_id = classification.failure_classification_id;
        recalculateUnclassifiedCounts();

        classification.job_id = job.id;
        const { data, failureStatus } = await classification.create();
        if (!failureStatus) {
          return job;
        }
        const message = `Error saving classification for ${job.platform} ${job.job_type_name}: ${data}`;
        notify(message, 'danger');
      }
      return null;
    },
    [createNewClassification, jobMap],
  );

  const saveBugs = useCallback((job) => {
    const { pinnedJobBugs: bugs, newBug } = usePinnedJobsStore.getState();

    bugs.forEach((bug) => {
      const bjm = new BugJobMapModel({
        bug_id: bug.dupe_of ?? bug.id ?? null,
        internal_id: bug.internal_id ?? null,
        job_id: job.id,
        type: 'annotation',
        bug_open: newBug.has(bug.id),
      });

      bjm.create().catch((response) => {
        const message = `Error saving bug association for ${job.platform} ${job.job_type_name}`;
        notify(formatModelError(response, message), 'danger');
      });

      if (!bug.id) {
        window.dispatchEvent(
          new CustomEvent(thEvents.internalIssueClassification, {
            detail: { internalBugId: bug.internal_id },
          }),
        );
      }
    });
  }, []);

  const isValidBugNumber = (text) => !text || /^i?[0-9]*$/.test(text);

  const toggleEnterBugNumber = useCallback((tf) => {
    setEnteringBugNumber(tf);
    if (!tf) {
      // Reset bug number when closing
    }
  }, []);

  const saveEnteredBugNumber = useCallback(() => {
    // Read latest values from state via closure-safe pattern
    setEnteringBugNumber((prevEntering) => {
      if (!prevEntering) return prevEntering;

      setNewBugNumber((prevBugNumber) => {
        if (!prevBugNumber) {
          setEnteringBugNumber(false);
        } else if (isValidBugNumber(prevBugNumber)) {
          if (prevBugNumber[0] === 'i') {
            addBug({ internal_id: prevBugNumber.slice(1) });
          } else {
            addBug({ id: parseInt(prevBugNumber, 10) });
          }
          setEnteringBugNumber(false);
        }
        return prevBugNumber;
      });

      return prevEntering;
    });
  }, []);

  // Use a ref-based pattern for the save handler to avoid stale closures in the event listener
  const saveRef = useRef(null);

  const save = useCallback(() => {
    const { pinnedJobs: currentPinnedJobs } = usePinnedJobsStore.getState();

    let errorFree = true;

    // Check if entering bug number — read current DOM state
    setEnteringBugNumber((prevEntering) => {
      if (prevEntering) {
        setNewBugNumber((prevBugNumber) => {
          if (prevBugNumber && isValidBugNumber(prevBugNumber)) {
            if (prevBugNumber[0] === 'i') {
              addBug({ internal_id: prevBugNumber.slice(1) });
            } else {
              addBug({ id: parseInt(prevBugNumber, 10) });
            }
            setEnteringBugNumber(false);
          } else if (prevBugNumber) {
            notify('Please enter a valid bug number', 'danger');
            errorFree = false;
          } else {
            setEnteringBugNumber(false);
          }
          return prevBugNumber;
        });
      }
      return prevEntering;
    });

    // Re-check canSaveClassifications using getState for freshest values
    const {
      pinnedJobBugs: currentBugs,
      failureClassificationId: currentClassId,
      failureClassificationComment: currentComment,
    } = usePinnedJobsStore.getState();

    const hasPinned = !!Object.keys(currentPinnedJobs).length;
    const canSave =
      hasPinned &&
      isLoggedIn &&
      (!!currentBugs.length ||
        (currentClassId !== 4 && currentClassId !== 2) ||
        currentRepo.is_try_repo ||
        currentRepo.repository_group.name === 'project repositories' ||
        (currentClassId === 4 && currentComment.length > 0) ||
        (currentClassId === 2 && currentComment.length > 7));

    if (!canSave && isLoggedIn) {
      notify('Please classify this failure before saving', 'danger');
      errorFree = false;
    }
    if (!isLoggedIn) {
      notify('Must be logged in to save job classifications', 'danger');
      errorFree = false;
    }
    if (errorFree) {
      const jobs = Object.values(currentPinnedJobs);
      const classifyPromises = jobs.map((job) => saveClassification(job));
      const bugPromises = jobs.map((job) => saveBugs(job));
      Promise.all([...classifyPromises, ...bugPromises]).then(
        (results) => {
          // Collect successfully classified jobs (saveClassification returns the job or null)
          const classifiedJobs = results
            .slice(0, jobs.length)
            .filter(Boolean);
          if (classifiedJobs.length) {
            // Group updated jobs by push_id and dispatch applyNewJobs
            // so Push components re-render JobButtons with new styling
            const jobsByPush = classifiedJobs.reduce((acc, job) => {
              const pushJobs = acc[job.push_id]
                ? [...acc[job.push_id], job]
                : [job];
              return { ...acc, [job.push_id]: pushJobs };
            }, {});
            window.dispatchEvent(
              new CustomEvent(thEvents.applyNewJobs, {
                detail: { jobs: jobsByPush },
              }),
            );
          }
          window.dispatchEvent(
            new CustomEvent(thEvents.classificationChanged),
          );
          recalculateUnclassifiedCounts();
          handleUnPinAll();
        },
      );
    }
  }, [
    isLoggedIn,
    currentRepo,
    saveClassification,
    saveBugs,
    handleUnPinAll,
  ]);

  saveRef.current = save;

  // Event listener for saveClassification custom event
  useEffect(() => {
    const handler = () => saveRef.current();
    window.addEventListener(thEvents.saveClassification, handler);
    return () => {
      window.removeEventListener(thEvents.saveClassification, handler);
    };
  }, []);

  const pasteSHA = (evt) => {
    const pastedData = evt.clipboardData.getData('text');
    if (isSHAorCommit(pastedData)) {
      setClassificationId(2);
    }
  };

  const cancelAllPinnedJobsTitle = () => {
    if (!isLoggedIn) return 'Not logged in';
    if (!canCancelAllPinnedJobs()) return 'No pending / running jobs in pinBoard';
    return 'Cancel all the pinned jobs';
  };

  const canCancelAllPinnedJobs = () => {
    const cancellableJobs = Object.values(pinnedJobs).filter(
      (job) => job.state === 'pending' || job.state === 'running',
    );
    return isLoggedIn && cancellableJobs.length > 0;
  };

  const cancelAllPinnedJobs = () => {
    if (
      window.confirm('This will cancel all the selected jobs. Are you sure?')
    ) {
      JobModel.cancel(
        Object.values(pinnedJobs),
        currentRepo,
        notify,
        decisionTaskMap,
      );
      handleUnPinAll();
    }
  };

  const unclassifyAllPinnedJobsTitle = () => {
    if (!isStaff) return 'Must be employee or sheriff';
    if (!canCancelAllPinnedJobs()) return 'No jobs in pinboard';
    return 'Unclassify all the pinned jobs';
  };

  const canUnclassifyAllPinnedJobs = () => {
    return isStaff && Object.values(pinnedJobs).length > 0;
  };

  const unclassifyAllPinnedJobs = async () => {
    const { data, failureStatus } =
      await JobClassificationTypeAndBugsModel.destroy(
        Object.values(pinnedJobs),
        currentRepo,
        notify,
      );

    if (!failureStatus) {
      const updatedJobs = [];
      for (const pinnedJob of Object.values(pinnedJobs)) {
        const job = jobMap[pinnedJob.id];
        job.failure_classification_id = 1;
        updatedJobs.push(job);
      }
      // Dispatch applyNewJobs so Push components re-render JobButtons
      const jobsByPush = updatedJobs.reduce((acc, job) => {
        const pushJobs = acc[job.push_id]
          ? [...acc[job.push_id], job]
          : [job];
        return { ...acc, [job.push_id]: pushJobs };
      }, {});
      window.dispatchEvent(
        new CustomEvent(thEvents.applyNewJobs, {
          detail: { jobs: jobsByPush },
        }),
      );
      handleUnPinAll();
      window.dispatchEvent(new CustomEvent(thEvents.classificationChanged));
      recalculateUnclassifiedCounts();
    } else {
      const message = `Error deleting classifications: ${data}`;
      notify(message, 'danger');
    }
  };

  const canSaveClassifications = () => {
    return (
      hasPinnedJobs &&
      isLoggedIn &&
      (!!pinnedJobBugs.length ||
        (failureClassificationId !== 4 && failureClassificationId !== 2) ||
        currentRepo.is_try_repo ||
        currentRepo.repository_group.name === 'project repositories' ||
        (failureClassificationId === 4 &&
          failureClassificationComment.length > 0) ||
        (failureClassificationId === 2 &&
          failureClassificationComment.length > 7))
    );
  };

  const pinboardIsDirty = () => {
    return (
      failureClassificationComment !== '' ||
      !!pinnedJobBugs.length ||
      failureClassificationId !== 4
    );
  };

  const saveUITitle = (category) => {
    let title = '';

    if (!isLoggedIn) {
      title = title.concat('not logged in / ');
    }

    if (category === 'classification') {
      if (!canSaveClassifications()) {
        title = title.concat('ineligible classification data / ');
      }
      if (!hasPinnedJobs) {
        title = title.concat('no pinned jobs');
      }
    } else if (category === 'bug') {
      if (!hasPinnedJobBugs) {
        title = title.concat('no related bugs');
      }
    }

    if (title === '') {
      title = `Save ${category} data`;
    } else {
      title = title.replace(/\/ $/, '');
      title = title.replace(/^./, (l) => l.toUpperCase());
    }
    return title;
  };

  const bugNumberKeyPress = (ev) => {
    if (ev.key === 'Enter') {
      saveEnteredBugNumber();
      if (ev.ctrlKey) {
        save();
      }
      ev.preventDefault();
    } else if (ev.key === 'Escape') {
      toggleEnterBugNumber(false);
    }
  };

  const retriggerAllPinnedJobs = async () => {
    const jobs = Object.values(pinnedJobs);
    JobModel.retrigger(jobs, currentRepo, notify, 1, decisionTaskMap);
  };

  return (
    <div id="pinboard-panel" className={isPinBoardVisible ? '' : 'hidden'}>
      <div id="pinboard-contents">
        <div id="pinned-job-list">
          <div className="content">
            {!hasPinnedJobs && (
              <span className="pinboard-preload-txt">
                press spacebar to pin a selected job
              </span>
            )}
            {Object.values(pinnedJobs).map((job) => {
              const { status, isClassified } = getBtnClass(
                job.resultStatus,
                job.failure_classification_id,
              );
              return (
                <span className="btn-group" key={job.id}>
                  <Button
                    className={`pinned-job mb-1 job-btn ${
                      selectedJobId === job.id ? 'selected-job' : ''
                    }`}
                    title={job.hoverText}
                    onClick={() => setSelectedJob(job)}
                    data-job-id={job.job_id}
                    data-status={status}
                    data-classified={isClassified ? 'true' : undefined}
                    size={selectedJobId === job.id ? 'large' : 'small'}
                  >
                    {job.job_type_symbol}
                  </Button>
                  <Button
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
              );
            })}
          </div>
        </div>

        {/* Related bugs */}
        <div id="pinboard-related-bugs">
          <div className="content">
            <Button
              variant="link"
              id="add-related-bug-button"
              onClick={() => toggleEnterBugNumber(!enteringBugNumber)}
              className="pointable p-0"
              title="Add a related bug"
            >
              <FontAwesomeIcon
                icon={faPlusSquare}
                className="add-related-bugs-icon"
                title="Add related bugs"
              />
            </Button>
            {!hasPinnedJobBugs && (
              <Button
                variant="link"
                className="pinboard-preload-txt pinboard-related-bug-preload-txt p-0 text-decoration-none"
                onClick={() => toggleEnterBugNumber(!enteringBugNumber)}
              >
                click to add a related bug
              </Button>
            )}
            {enteringBugNumber && (
              <span className="add-related-bugs-form d-flex align-items-start">
                <div>
                  <Form.Control
                    id="related-bug-input"
                    ref={bugInputRef}
                    data-bug-input
                    type="text"
                    pattern="[0-9]*"
                    className="add-related-bugs-input"
                    placeholder="enter bug number"
                    isInvalid={!isValidBugNumber(newBugNumber)}
                    onKeyPress={bugNumberKeyPress}
                    onChange={(ev) => {
                      setNewBugNumber(ev.target.value);
                    }}
                    onBlur={saveEnteredBugNumber}
                  />
                  <Form.Control.Feedback>
                    Please enter only numbers
                  </Form.Control.Feedback>
                </div>
                <Button
                  variant="link"
                  id="clear-related-bug-button"
                  onClick={() => {
                    setEnteringBugNumber(false);
                    setNewBugNumber(null);
                  }}
                  className="pointable p-0"
                  title="Close a related bug"
                >
                  <FontAwesomeIcon
                    icon={faTimes}
                    className="text-danger ms-2"
                    title="Close related bugs"
                  />
                </Button>
              </span>
            )}
            {Array.from(pinnedJobBugs).map((bug) => (
              <span
                key={bug.id ? `bug-${bug.id}` : `internal-${bug.internal_id}`}
              >
                <span className="pinboard-related-bugs-btn">
                  {!bug.id && (
                    <span className="btn btn-xs text-dark">
                      <em>i{bug.internal_id}</em>
                    </span>
                  )}
                  {bug.id && (
                    <a
                      className="btn btn-xs related-bugs-link text-dark"
                      href={getBugUrl(bug.dupe_of ?? bug.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`pinboard-bug-${bug.id}`}
                    >
                      <em>{bug.dupe_of ?? bug.id}</em>
                    </a>
                  )}
                  <Button
                    variant="link"
                    className="btn btn-xs pinned-job-close-btn border-0 px-0 py-3"
                    onClick={() => removeBug(bug)}
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
            <Form.Group>
              <Form.Control
                as="select"
                name="failureClassificationId"
                id="pinboard-classification-select"
                className="classification-select"
                value={failureClassificationId}
                onChange={(evt) =>
                  setClassificationId(parseInt(evt.target.value, 10))
                }
              >
                {classificationTypes.map((opt) => (
                  <option value={opt.id} key={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </Form.Control>
            </Form.Group>
            {/* Classification comment */}
            <div className="classification-comment-container">
              <input
                id="classification-comment"
                type="text"
                className="form-control add-classification-input"
                onChange={(evt) => setClassificationComment(evt.target.value)}
                onPaste={pasteSHA}
                placeholder="click to add comment"
                value={failureClassificationComment}
              />
              {failureClassificationId === 2 && (
                <div>
                  <Form.Group>
                    <Form.Control
                      id="pinboard-revision-select"
                      className="classification-select"
                      as="select"
                      defaultValue={0}
                      onChange={(evt) =>
                        setClassificationComment(evt.target.value)
                      }
                    >
                      <option value="0" disabled>
                        Choose a recent commit
                      </option>
                      {revisionTips.slice(0, 20).map((tip) => (
                        <option
                          title={tip.title}
                          value={tip.revision}
                          key={tip.revision}
                        >
                          {tip.revision.slice(0, 12)} {tip.author}
                        </option>
                      ))}
                    </Form.Control>
                  </Form.Group>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Save UI */}
        <div
          id="pinboard-controls"
          className="btn-group-vertical"
          title={hasPinnedJobs ? '' : 'No pinned jobs'}
        >
          <ButtonGroup className="save-btn-group">
            <Button
              className={`save-btn ${
                !isLoggedIn || !canSaveClassifications() ? 'disabled' : ''
              }`}
              variant="outline-secondary"
              size="xs"
              title={saveUITitle('classification')}
              onClick={save}
            >
              save
            </Button>
            <Dropdown>
              <Dropdown.Toggle
                size="xs"
                className={`bg-light ${
                  !hasPinnedJobs && !pinboardIsDirty() ? 'disabled' : ''
                }`}
                title={
                  !hasPinnedJobs && !pinboardIsDirty()
                    ? 'No pinned jobs'
                    : 'Additional pinboard functions'
                }
                variant="outline-secondary"
              />
              <Dropdown.Menu className="save-btn-dropdown-menu">
                <Dropdown.Item
                  tag="a"
                  title={
                    !isLoggedIn ? 'Not logged in' : 'Repeat the pinned jobs'
                  }
                  className={!isLoggedIn ? 'disabled' : ''}
                  onClick={() => !isLoggedIn || retriggerAllPinnedJobs()}
                >
                  Retrigger all
                </Dropdown.Item>
                <Dropdown.Item
                  tag="a"
                  title={cancelAllPinnedJobsTitle()}
                  className={canCancelAllPinnedJobs() ? '' : 'disabled'}
                  onClick={() =>
                    canCancelAllPinnedJobs() && cancelAllPinnedJobs()
                  }
                >
                  Cancel all
                </Dropdown.Item>
                <Dropdown.Item
                  tag="a"
                  title={unclassifyAllPinnedJobsTitle()}
                  className={canUnclassifyAllPinnedJobs() ? '' : 'disabled'}
                  onClick={() =>
                    canUnclassifyAllPinnedJobs() && unclassifyAllPinnedJobs()
                  }
                >
                  Unclassify all
                </Dropdown.Item>
                <Dropdown.Item tag="a" onClick={() => handleUnPinAll()}>
                  Clear all
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </ButtonGroup>
        </div>
      </div>
    </div>
  );
}

export default PinBoard;
