/* eslint import/no-unresolved: [2, { ignore: ['@mozilla/glean/web$'] }] */

import React from 'react';
import PropTypes from 'prop-types';
import chunk from 'lodash/chunk';
import { connect } from 'react-redux';
import Glean from '@mozilla/glean/web';

import { notify } from '../redux/stores/notifications';
import { setPinBoardVisible } from '../redux/stores/pinnedJobs';
import { thEvents } from '../../helpers/constants';
import { addAggregateFields } from '../../helpers/job';
import { getUrlParam } from '../../helpers/location';
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

    this.gleanInitialized = false;

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

  initializeGlean = () => {
    const { notify } = this.props;
    if (!this.gleanInitialized && !getUrlParam('noTelemetry')) {
      if (!localStorage.getItem('glean_notify')) {
        notify(
          `Collecting telemetry data about failure classification. turn off in user menu`,
          'success',
        );
        localStorage.setItem('glean_notify', 'displayed');
      }
      // for development (data sent to: https://debug-ping-preview.firebaseapp.com/pings/treeherder)
      // Glean.setLogPings(true);
      // Glean.setDebugViewTag('treeherder');
      Glean.initialize('treeherder', true);
      this.gleanInitialized = true;
    }
  };

  togglePinBoardVisibility = () => {
    const { setPinBoardVisible, isPinBoardVisible } = this.props;

    setPinBoardVisible(!isPinBoardVisible);
  };

  updateClassifications = async () => {
    const { selectedJob } = this.props;
    const classifications = await JobClassificationModel.getList({
      job_id: selectedJob.id,
    });
    const bugs = await BugJobMapModel.getList({ job_id: selectedJob.id });

    this.setState({ classifications, bugs });
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
        jobDetails: [],
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

        const phSeriesPromise = PerfSeriesModel.getSeriesData(
          currentRepo.name,
          {
            job_id: selectedJob.id,
          },
        );

        Promise.all([
          jobPromise,
          jobLogUrlPromise,
          phSeriesPromise,
          builtFromArtifactPromise,
        ])
          .then(
            async ([
              jobResult,
              jobLogUrlResult,
              phSeriesResult,
              builtFromArtifactResult,
            ]) => {
              // This version of the job has more information than what we get in the main job list.  This
              // is what we'll pass to the rest of the details panel.
              // Don't update the job instance in the greater job field so as to not add the memory overhead
              // of all the extra fields in ``selectedJobFull``.  It's not that much for just one job, but as
              // one selects job after job, over the course of a day, it can add up.  Therefore, we keep
              // selectedJobFull data as transient only when the job is selected.
              const selectedJobFull = jobResult;
              const jobRevision = push ? push.revision : null;

              addAggregateFields(selectedJobFull);

              Promise.all([jobArtifactsPromise]).then(
                async ([jobArtifactsResult]) => {
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
                },
              );

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
              );
              const logViewerFullUrl = `${window.location.origin}${logViewerUrl}`;
              const performanceData = Object.values(phSeriesResult).reduce(
                (a, b) => [...a, ...b],
                [],
              );
              let perfJobDetail = [];

              if (performanceData.length) {
                const signatureIds = [
                  ...new Set(performanceData.map((perf) => perf.signature_id)),
                ];
                const seriesListList = await Promise.all(
                  chunk(signatureIds, 20).map((signatureIdChunk) =>
                    PerfSeriesModel.getSeriesList(currentRepo.name, {
                      id: signatureIdChunk,
                    }),
                  ),
                );
                const mappedFrameworks = {};
                frameworks.forEach((element) => {
                  mappedFrameworks[element.id] = element.name;
                });

                const seriesList = seriesListList
                  .map((item) => item.data)
                  .reduce((a, b) => [...a, ...b], []);

                perfJobDetail = performanceData
                  .map((d) => ({
                    series: seriesList.find((s) => d.signature_id === s.id),
                    ...d,
                  }))
                  .map((d) => ({
                    url: `/perfherder/graphs?series=${[
                      currentRepo.name,
                      d.signature_id,
                      1,
                      d.series.frameworkId,
                    ]}&selected=${[d.signature_id, d.id]}`,
                    shouldAlert: d.series.should_alert,
                    value: d.value,
                    measurementUnit: d.series.measurementUnit,
                    lowerIsBetter: d.series.lowerIsBetter,
                    title: d.series.name,
                    suite: d.series.suite,
                    options: d.series.options.join(' '),
                    perfdocs: new Perfdocs(
                      mappedFrameworks[d.series.frameworkId],
                      d.series.suite,
                      d.series.platform,
                      d.series.name,
                    ),
                  }));
              }
              perfJobDetail.sort((a, b) => {
                // Sort perfJobDetails by value of shouldAlert in a particular order:
                // first true values, after that null values and then false.
                if (a.shouldAlert === true) {
                  return -1;
                }
                if (a.shouldAlert === false) {
                  return 1;
                }
                if (a.shouldAlert === null && b.shouldAlert === true) {
                  return 1;
                }
                if (a.shouldAlert === null && b.shouldAlert === false) {
                  return -1;
                }
                return 0;
              });

              this.setState(
                {
                  selectedJobFull,
                  jobLogUrls,
                  logParseStatus,
                  logViewerUrl,
                  logViewerFullUrl,
                  perfJobDetail,
                  jobRevision,
                },
                async () => {
                  await this.updateClassifications();
                  this.setState({ jobDetailLoading: false });
                },
              );
            },
          )
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
      isPinBoardVisible,
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
    } = this.state;
    const detailsPanelHeight = isPinBoardVisible
      ? resizedHeight - pinboardHeight
      : resizedHeight;

    return (
      <div
        id="details-panel"
        style={{ height: `${detailsPanelHeight}px` }}
        className={selectedJobFull ? 'details-panel-slide' : 'hidden'}
      >
        <PinBoard
          currentRepo={currentRepo}
          isLoggedIn={user.isLoggedIn || false}
          isStaff={user.isStaff || false}
          classificationTypes={classificationTypes}
          selectedJobFull={selectedJobFull}
          initializeGlean={this.initializeGlean}
        />
        {!!selectedJobFull && (
          <div id="details-panel-content">
            <SummaryPanel
              selectedJobFull={selectedJobFull}
              currentRepo={currentRepo}
              classificationMap={classificationMap}
              jobLogUrls={jobLogUrls}
              logParseStatus={logParseStatus}
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
              taskId={selectedJobFull.task_id}
              rootUrl={currentRepo.tc_root_url}
              initializeGlean={this.initializeGlean}
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
  classificationTypes: PropTypes.arrayOf(PropTypes.object).isRequired,
  classificationMap: PropTypes.shape({}).isRequired,
  setPinBoardVisible: PropTypes.func.isRequired,
  isPinBoardVisible: PropTypes.bool.isRequired,
  pushList: PropTypes.arrayOf(PropTypes.object).isRequired,
  selectedJob: PropTypes.shape({}),
  notify: PropTypes.func.isRequired,
};

DetailsPanel.defaultProps = {
  selectedJob: null,
};

const mapStateToProps = ({
  selectedJob: { selectedJob },
  pushes: { pushList },
  pinnedJobs: { isPinBoardVisible },
}) => ({ selectedJob, pushList, isPinBoardVisible });

export default connect(mapStateToProps, { notify, setPinBoardVisible })(
  DetailsPanel,
);
