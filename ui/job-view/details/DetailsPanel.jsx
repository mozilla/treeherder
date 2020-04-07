import React from 'react';
import PropTypes from 'prop-types';
import chunk from 'lodash/chunk';
import { connect } from 'react-redux';
import uniqBy from 'lodash/uniqBy';

import { setPinBoardVisible } from '../redux/stores/pinnedJobs';
import { thEvents, thBugSuggestionLimit } from '../../helpers/constants';
import { addAggregateFields } from '../../helpers/job';
import {
  getLogViewerUrl,
  getReftestUrl,
  getArtifactsUrl,
} from '../../helpers/url';
import { formatArtifacts } from '../../helpers/display';
import { getData } from '../../helpers/http';
import BugJobMapModel from '../../models/bugJobMap';
import BugSuggestionsModel from '../../models/bugSuggestions';
import JobClassificationModel from '../../models/classification';
import JobModel from '../../models/job';
import JobDetailModel from '../../models/jobDetail';
import JobLogUrlModel from '../../models/jobLogUrl';
import TextLogStepModel from '../../models/textLogStep';
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
      reftestUrl: null,
      perfJobDetail: [],
      jobRevision: null,
      logParseStatus: 'unavailable',
      classifications: [],
      bugs: [],
      suggestions: [],
      errors: [],
      bugSuggestionsLoading: false,
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

  loadBugSuggestions = () => {
    const { currentRepo, selectedJob } = this.props;

    if (!selectedJob) {
      return;
    }
    BugSuggestionsModel.get(selectedJob.id).then(suggestions => {
      suggestions.forEach(suggestion => {
        suggestion.bugs.too_many_open_recent =
          suggestion.bugs.open_recent.length > thBugSuggestionLimit;
        suggestion.bugs.too_many_all_others =
          suggestion.bugs.all_others.length > thBugSuggestionLimit;
        suggestion.valid_open_recent =
          suggestion.bugs.open_recent.length > 0 &&
          !suggestion.bugs.too_many_open_recent;
        suggestion.valid_all_others =
          suggestion.bugs.all_others.length > 0 &&
          !suggestion.bugs.too_many_all_others &&
          // If we have too many open_recent bugs, we're unlikely to have
          // relevant all_others bugs, so don't show them either.
          !suggestion.bugs.too_many_open_recent;
      });

      // if we have no bug suggestions, populate with the raw errors from
      // the log (we can do this asynchronously, it should normally be
      // fast)
      if (!suggestions.length) {
        TextLogStepModel.get(selectedJob.id).then(textLogSteps => {
          const errors = textLogSteps
            .filter(step => step.result !== 'success')
            .map(step => ({
              name: step.name,
              result: step.result,
              logViewerUrl: getLogViewerUrl(
                selectedJob.id,
                currentRepo.name,
                step.finished_line_number,
              ),
            }));
          this.setState({ errors });
        });
      }

      this.setState({ bugSuggestionsLoading: false, suggestions });
    });
  };

  updateClassifications = async () => {
    const { selectedJob } = this.props;
    const classifications = await JobClassificationModel.getList({
      job_id: selectedJob.id,
    });
    const bugs = await BugJobMapModel.getList({ job_id: selectedJob.id });

    this.setState({ classifications, bugs });
  };

  findPush = pushId => {
    const { pushList } = this.props;

    return pushList.find(push => pushId === push.id);
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

        let jobDetails = [];
        const jobPromise =
          'logs' in selectedJob
            ? Promise.resolve(selectedJob)
            : JobModel.get(
                currentRepo.name,
                selectedJob.id,
                this.selectJobController.signal,
              );

        const jobDetailPromise = JobDetailModel.getJobDetails(
          { job_id: selectedJob.id },
          this.selectJobController.signal,
        );
        const artifactsParams = {
          jobId: selectedJob.id,
          taskId: selectedJob.task_id,
          run: selectedJob.retry_id,
          rootUrl: currentRepo.tc_root_url,
        };

        const jobArtifactsPromise = getData(getArtifactsUrl(artifactsParams));

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
          jobDetailPromise,
          jobLogUrlPromise,
          phSeriesPromise,
          jobArtifactsPromise,
        ])
          .then(
            async ([
              jobResult,
              jobDetailResult,
              jobLogUrlResult,
              phSeriesResult,
              jobArtifactsResult,
            ]) => {
              // This version of the job has more information than what we get in the main job list.  This
              // is what we'll pass to the rest of the details panel.
              // Don't update the job instance in the greater job field so as to not add the memory overhead
              // of all the extra fields in ``selectedJobFull``.  It's not that much for just one job, but as
              // one selects job after job, over the course of a day, it can add up.  Therefore, we keep
              // selectedJobFull data as transient only when the job is selected.
              const selectedJobFull = jobResult;
              const jobRevision = push.revision;

              addAggregateFields(selectedJobFull);

              const jobArtifacts = jobArtifactsResult.data.artifacts
                ? formatArtifacts(jobArtifactsResult.data.artifacts, {
                    ...artifactsParams,
                  })
                : [];

              jobDetails = uniqBy(
                [...jobDetailResult, ...jobArtifacts],
                'value',
              );

              // the third result comes from the jobLogUrl promise
              // exclude the json log URLs
              const jobLogUrls = jobLogUrlResult.filter(
                log => !log.name.endsWith('_json'),
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
              const reftestUrl = jobLogUrls.length
                ? getReftestUrl(jobLogUrls[0].url)
                : '';
              const performanceData = Object.values(phSeriesResult).reduce(
                (a, b) => [...a, ...b],
                [],
              );
              let perfJobDetail = [];

              if (performanceData.length) {
                const signatureIds = [
                  ...new Set(performanceData.map(perf => perf.signature_id)),
                ];
                const seriesListList = await Promise.all(
                  chunk(signatureIds, 20).map(signatureIdChunk =>
                    PerfSeriesModel.getSeriesList(currentRepo.name, {
                      id: signatureIdChunk,
                    }),
                  ),
                );

                const seriesList = seriesListList
                  .map(item => item.data)
                  .reduce((a, b) => [...a, ...b], []);

                perfJobDetail = performanceData
                  .map(d => ({
                    series: seriesList.find(s => d.signature_id === s.id),
                    ...d,
                  }))
                  .filter(d => !d.series.parentSignature)
                  .map(d => ({
                    url: `/perf.html#/graphs?series=${[
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
                  reftestUrl,
                  perfJobDetail,
                  jobRevision,
                },
                async () => {
                  await this.updateClassifications();
                  await this.loadBugSuggestions();
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
      reftestUrl,
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
              reftestUrl={reftestUrl}
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
  currentRepo: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  resizedHeight: PropTypes.number.isRequired,
  classificationTypes: PropTypes.array.isRequired,
  classificationMap: PropTypes.object.isRequired,
  setPinBoardVisible: PropTypes.func.isRequired,
  isPinBoardVisible: PropTypes.bool.isRequired,
  pushList: PropTypes.array.isRequired,
  selectedJob: PropTypes.object,
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
