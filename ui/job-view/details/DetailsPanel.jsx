import React from 'react';
import PropTypes from 'prop-types';
import chunk from 'lodash/chunk';
import { connect } from 'react-redux';

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
    const { currentRepo, selectedJob } = this.props;
    const push = this.findPush(selectedJob.push_id);

    this.setState(
      { jobDetails: [], suggestions: [], jobDetailLoading: true },
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
          jobArtifactsPromise,
          builtFromArtifactPromise,
        ])
          .then(
            async ([
              jobResult,
              jobLogUrlResult,
              phSeriesResult,
              jobArtifactsResult,
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

              let jobDetails = jobArtifactsResult.data.artifacts
                ? formatArtifacts(jobArtifactsResult.data.artifacts, {
                    ...artifactsParams,
                  })
                : [];

              if (
                builtFromArtifactResult &&
                !builtFromArtifactResult.failureStatus
              ) {
                jobDetails = [...jobDetails, ...builtFromArtifactResult.data];
              }

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
              const logViewerFullUrl = `${window.location.origin}/${logViewerUrl}`;
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
                    value: d.value,
                    title: d.series.name,
                  }));
              }

              this.setState(
                {
                  selectedJobFull,
                  jobLogUrls,
                  jobDetails,
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
              jobDetailLoading={jobDetailLoading}
              latestClassification={
                classifications.length ? classifications[0] : null
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
