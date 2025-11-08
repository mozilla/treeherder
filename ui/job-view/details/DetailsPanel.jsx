import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Queue } from 'taskcluster-client-web';

import { setPinBoardVisible } from '../redux/stores/pinnedJobs';
import { thEvents } from '../../helpers/constants';
import { addAggregateFields } from '../../helpers/job';
import { getLogViewerUrl, getArtifactsUrl } from '../../helpers/url';
import { formatArtifacts } from '../../helpers/display';
import { getData } from '../../helpers/http';
import BugJobMapModel from '../../models/bugJobMap';
import JobClassificationModel from '../../models/classification';
import JobModel from '../../models/job';
import JobLogUrlModel from '../../models/jobLogUrl';
import PerfSeriesModel from '../../models/perfSeries';
import { Perfdocs } from '../../perfherder/perf-helpers/perfdocs';

import PinBoard from './PinBoard';
import SummaryPanel from './summary/SummaryPanel';
import TabsPanel from './tabs/TabsPanel';

export const pinboardHeight = 100;

class DetailsPanel extends React.Component {
  constructor(props) {
    super(props);

    // used to cancel all the ajax requests triggered by selectJob
    this.selectJobController = null;

    this.state = {
      selectedJobFull: null,
      jobDetails: [],
      jobLogUrls: [],
      jobDetailLoading: false,
      jobArtifactsLoading: false,
      logViewerUrl: null,
      logViewerFullUrl: null,
      perfJobDetail: [],
      jobRevision: null,
      logParseStatus: 'unavailable',
      classifications: [],
      testGroups: [],
      bugs: [],
    };
  }

  componentDidMount() {
    window.addEventListener(
      thEvents.classificationChanged,
      this.updateClassifications,
    );
  }

  componentDidUpdate(prevProps) {
    const { selectedJob } = this.props;

    if (selectedJob && prevProps.selectedJob) {
      const {
        id: prevId,
        state: prevState,
        result: prevResult,
        failure_classification_id: prevFci,
      } = prevProps.selectedJob;
      const { id, state, result, failure_classification_id: fci } = selectedJob;

      // Check the id in case the user switched to a new job.
      // But also check some of the fields of the selected job,
      // in case they have changed due to polling.
      if (
        prevId !== id ||
        prevState !== state ||
        prevResult !== result ||
        prevFci !== fci
      ) {
        this.selectJob();
      }
    } else if (selectedJob && selectedJob !== prevProps.selectedJob) {
      this.selectJob();
    }
  }

  componentWillUnmount() {
    window.removeEventListener(
      thEvents.classificationChanged,
      this.updateClassifications,
    );
  }

  togglePinBoardVisibility = () => {
    const { setPinBoardVisible, isPinBoardVisible } = this.props;

    setPinBoardVisible(!isPinBoardVisible);
  };

  fetchTaskData = async (taskId, rootUrl) => {
    let testGroups = [];
    let taskQueueId = null;

    if (!taskId || !rootUrl) {
      return { testGroups, taskQueueId };
    }

    const queue = new Queue({ rootUrl });
    const taskDefinition = await queue.task(taskId);
    if (taskDefinition) {
      taskQueueId = taskDefinition.taskQueueId;
      if (taskDefinition.payload.env?.MOZHARNESS_TEST_PATHS) {
        const testGroupsData = Object.values(
          JSON.parse(taskDefinition.payload.env.MOZHARNESS_TEST_PATHS),
        );
        if (testGroupsData.length) {
          [testGroups] = testGroupsData;
        }
      }
    }

    return { testGroups, taskQueueId };
  };

  updateClassifications = async (signal) => {
    const { selectedJob } = this.props;

    try {
      const [classifications, bugs] = await Promise.all([
        JobClassificationModel.getList({ job_id: selectedJob.id }, signal),
        BugJobMapModel.getList({ job_id: selectedJob.id }, signal),
      ]);

      this.setState({ classifications, bugs });
    } catch (error) {
      // Ignore abort errors when switching jobs
      if (error.name !== 'AbortError') {
        throw error;
      }
    }
  };

  findPush = (pushId) => {
    const { pushList } = this.props;

    return pushList.find((push) => pushId === push.id);
  };

  selectJob = () => {
    const { currentRepo, selectedJob, frameworks } = this.props;
    const push = this.findPush(selectedJob.push_id);

    this.setState(
      {
        suggestions: [],
        jobDetailLoading: true,
        jobArtifactsLoading: true,
      },
      () => {
        if (this.selectJobController !== null) {
          // Cancel the in-progress fetch requests.
          this.selectJobController.abort();
        }

        this.selectJobController = new AbortController();

        const jobPromise =
          'logs' in selectedJob
            ? Promise.resolve(selectedJob)
            : JobModel.get(
                currentRepo.name,
                selectedJob.id,
                this.selectJobController.signal,
              );

        const artifactsParams = {
          jobId: selectedJob.id,
          taskId: selectedJob.task_id,
          run: selectedJob.retry_id,
          rootUrl: currentRepo.tc_root_url,
        };

        const jobArtifactsPromise = getData(
          getArtifactsUrl(artifactsParams),
          this.selectJobController.signal,
        );
        let builtFromArtifactPromise;

        if (
          currentRepo.name === 'comm-central' ||
          currentRepo.name === 'try-comm-central'
        ) {
          builtFromArtifactPromise = getData(
            getArtifactsUrl({
              ...artifactsParams,
              ...{ artifactPath: 'public/build/built_from.json' },
            }),
          );
        }

        const jobLogUrlPromise = JobLogUrlModel.getList(
          { job_id: selectedJob.id },
          this.selectJobController.signal,
        );

        const performancePromise = PerfSeriesModel.getJobData(
          currentRepo.name,
          { job_id: selectedJob.id },
        ).then((rowOrResponse) => {
          const jobData = !rowOrResponse.failureStatus
            ? rowOrResponse.data
            : rowOrResponse;
          if (jobData.failureStatus) {
            this.setState({ perfJobDetail: [] });
            return;
          }

          const mappedFrameworks = {};
          frameworks.forEach((element) => {
            mappedFrameworks[element.id] = element.name;
          });

          const perfJobDetail = jobData.data.map((perfomanceData) => {
            const signature = perfomanceData.signature_data;
            return {
              url: `/perfherder/graphs?series=${[
                currentRepo.name,
                signature.id,
                1,
                signature.frameworkId,
              ]}&selected=${[signature.id, perfomanceData.id]}`,
              shouldAlert: signature.should_alert,
              value: perfomanceData.value,
              measurementUnit: signature.measurementUnit,
              lowerIsBetter: signature.lowerIsBetter,
              title: signature.name,
              suite: signature.suite,
              options: signature.options.join(' '),
              frameworkName: mappedFrameworks[signature.frameworkId],
              perfdocs: new Perfdocs(
                mappedFrameworks[signature.frameworkId],
                signature.suite,
                signature.platform,
                signature.name,
              ),
            };
          });
          perfJobDetail.sort((a, b) => {
            // Sort perfJobDetails by value of shouldAlert in a particular order:
            // first true values, after that null values and then false.
            if (a.shouldAlert === true) return -1;
            if (a.shouldAlert === false) return 1;
            if (a.shouldAlert === null && b.shouldAlert === true) return 1;
            if (a.shouldAlert === null && b.shouldAlert === false) return -1;
            return 0;
          });
          this.setState({ perfJobDetail });
        });

        Promise.all([
          jobPromise,
          jobLogUrlPromise,
          builtFromArtifactPromise,
          this.fetchTaskData(selectedJob.task_id, currentRepo.tc_root_url),
          this.updateClassifications(this.selectJobController.signal),
        ])
          .then(
            async ([
              jobResult,
              jobLogUrlResult,
              builtFromArtifactResult,
              taskData,
            ]) => {
              // This version of the job has more information than what we get in the main job list.  This
              // is what we'll pass to the rest of the details panel.
              // Don't update the job instance in the greater job field so as to not add the memory overhead
              // of all the extra fields in ``selectedJobFull``.  It's not that much for just one job, but as
              // one selects job after job, over the course of a day, it can add up.  Therefore, we keep
              // selectedJobFull data as transient only when the job is selected.
              const selectedJobFull = {
                ...jobResult,
                hasSideBySide: selectedJob.hasSideBySide,
                taskQueueId: taskData.taskQueueId,
              };
              const jobRevision = push ? push.revision : null;

              addAggregateFields(selectedJobFull);

              Promise.all([jobArtifactsPromise])
                .then(async ([jobArtifactsResult]) => {
                  let jobDetails = jobArtifactsResult.data.artifacts
                    ? formatArtifacts(jobArtifactsResult.data.artifacts, {
                        ...artifactsParams,
                      })
                    : [];

                  if (
                    builtFromArtifactResult &&
                    !builtFromArtifactResult.failureStatus
                  ) {
                    jobDetails = [
                      ...jobDetails,
                      ...builtFromArtifactResult.data,
                    ];
                  }
                  this.setState({
                    jobDetails,
                    jobArtifactsLoading: false,
                  });
                })
                .catch((error) => {
                  // Ignore abort errors when switching jobs quickly
                  if (error.name !== 'AbortError') {
                    throw error;
                  }
                });

              // the third result comes from the jobLogUrl promise
              // exclude the json log URLs
              const jobLogUrls = jobLogUrlResult.filter(
                (log) => !log.name.endsWith('_json'),
              );

              let logParseStatus = 'unavailable';
              // Provide a parse status as a scope variable for logviewer shortcut
              if (jobLogUrls.length && jobLogUrls[0].parse_status) {
                logParseStatus = jobLogUrls[0].parse_status;
              }

              const logViewerUrl = getLogViewerUrl(
                selectedJob.id,
                currentRepo.name,
                null,
                selectedJobFull,
              );
              const logViewerFullUrl = `${window.location.origin}${logViewerUrl}`;

              const newState = {
                selectedJobFull,
                jobLogUrls,
                logParseStatus,
                logViewerUrl,
                logViewerFullUrl,
                jobRevision,
                testGroups: taskData.testGroups,
              };

              // Only wait for the performance data before setting
              // jobDetailLoading to false if we will not be showing
              // the Failure Summary panel by default.
              if (
                !['busted', 'testfailed', 'exception'].includes(
                  selectedJobFull.resultStatus,
                )
              ) {
                this.setState(newState);
                await performancePromise;
                this.setState({ jobDetailLoading: false });
              } else {
                newState.jobDetailLoading = false;
                this.setState(newState);
              }
            },
          )
          .catch((error) => {
            // Ignore abort errors when switching jobs quickly
            if (error.name !== 'AbortError') {
              throw error;
            }
          })
          .finally(() => {
            this.selectJobController = null;
          });
      },
    );
  };

  render() {
    const {
      user,
      currentRepo,
      resizedHeight,
      classificationMap,
      classificationTypes,
      selectedJob,
    } = this.props;
    const {
      selectedJobFull,
      jobDetails,
      jobRevision,
      jobLogUrls,
      jobDetailLoading,
      jobArtifactsLoading,
      perfJobDetail,
      suggestions,
      errors,
      bugSuggestionsLoading,
      logParseStatus,
      classifications,
      logViewerUrl,
      logViewerFullUrl,
      bugs,
      testGroups,
    } = this.state;

    return (
      <div
        id="details-panel"
        style={{ height: `${resizedHeight}px` }}
        className={selectedJobFull ? 'details-panel-slide' : 'hidden'}
      >
        <PinBoard
          currentRepo={currentRepo}
          isLoggedIn={user.isLoggedIn || false}
          isStaff={user.isStaff || false}
          classificationTypes={classificationTypes}
          selectedJobFull={selectedJobFull}
        />
        {!!selectedJobFull && (
          <div id="details-panel-content">
            <SummaryPanel
              selectedJobFull={selectedJobFull}
              currentRepo={currentRepo}
              classificationMap={classificationMap}
              jobLogUrls={jobLogUrls}
              logParseStatus={logParseStatus}
              jobDetails={jobDetails}
              jobDetailLoading={jobDetailLoading}
              latestClassification={
                classifications.length
                  ? classifications[classifications.length - 1]
                  : null
              }
              logViewerUrl={logViewerUrl}
              logViewerFullUrl={logViewerFullUrl}
              bugs={bugs}
              user={user}
            />
            <span className="job-tabs-divider" />
            <TabsPanel
              selectedJob={selectedJob}
              selectedJobFull={selectedJobFull}
              currentRepo={currentRepo}
              jobDetails={jobDetails}
              jobArtifactsLoading={jobArtifactsLoading}
              perfJobDetail={perfJobDetail}
              repoName={currentRepo.name}
              jobRevision={jobRevision}
              suggestions={suggestions}
              errors={errors}
              bugSuggestionsLoading={bugSuggestionsLoading}
              logParseStatus={logParseStatus}
              classifications={classifications}
              classificationMap={classificationMap}
              jobLogUrls={jobLogUrls}
              bugs={bugs}
              togglePinBoardVisibility={() => this.togglePinBoardVisibility()}
              logViewerFullUrl={logViewerFullUrl}
              testGroups={testGroups}
            />
          </div>
        )}
        <div id="clipboard-container">
          <textarea id="clipboard" />
        </div>
      </div>
    );
  }
}

DetailsPanel.propTypes = {
  currentRepo: PropTypes.shape({}).isRequired,
  user: PropTypes.shape({}).isRequired,
  resizedHeight: PropTypes.number.isRequired,
  classificationTypes: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  classificationMap: PropTypes.shape({}).isRequired,
  setPinBoardVisible: PropTypes.func.isRequired,
  isPinBoardVisible: PropTypes.bool.isRequired,
  pushList: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  selectedJob: PropTypes.shape({}),
};

DetailsPanel.defaultProps = {
  selectedJob: null,
};

const mapStateToProps = ({
  selectedJob: { selectedJob },
  pushes: { pushList },
  pinnedJobs: { isPinBoardVisible },
}) => ({ selectedJob, pushList, isPinBoardVisible });

export default connect(mapStateToProps, { setPinBoardVisible })(DetailsPanel);
