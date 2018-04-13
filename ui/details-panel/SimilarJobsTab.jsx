import PropTypes from 'prop-types';
import { react2angular } from "react2angular/index";

import { getBtnClass, getStatus } from '../helpers/jobHelper';
import { toDateStr, toShortDateStr } from '../helpers/displayHelper';
import { getSlaveHealthUrl } from '../helpers/urlHelper';
import treeherder from "../js/treeherder";
import { thEvents } from "../js/constants";

class SimilarJobsTab extends React.Component {
  constructor(props) {
    super(props);

    const { $injector } = this.props;
    this.ThJobModel = $injector.get('ThJobModel');
    this.$rootScope = $injector.get('$rootScope');
    this.ThTextLogStepModel = $injector.get('ThTextLogStepModel');
    this.ThResultSetModel = $injector.get('ThResultSetModel');
    this.thNotify = $injector.get('thNotify');
    this.thTabs = $injector.get('thTabs');
    this.thClassificationTypes = $injector.get('thClassificationTypes');

    this.pageSize = 20;
    this.tab = this.thTabs.tabs.similarJobs;

    this.state = {
      similarJobs: [],
      filterBuildPlatformId: true,
      filterOptionCollectionHash: true,
      page: 1,
      selectedSimilarJob: null,
      hasNextPage: false,
      selectedJob: null,
      isLoading: true,
    };

    // map between state fields and job fields
    this.filterMap = {
      filterBuildPlatformId: 'build_platform_id',
      filterOptionCollectionHash: 'option_collection_hash',
    };
  }

  componentDidMount() {
    this.getSimilarJobs = this.getSimilarJobs.bind(this);
    this.showNext = this.showNext.bind(this);
    this.toggleFilter = this.toggleFilter.bind(this);

    this.jobClickUnlisten = this.$rootScope.$on(thEvents.jobClick, (event, job) => {
      this.setState({ selectedJob: job, similarJobs: [], isLoading: true }, this.getSimilarJobs);
    });
  }

  componentWillUnmount() {
    this.jobClickUnlisten();
  }

  async getSimilarJobs() {
    const { page, selectedJob, similarJobs, selectedSimilarJob } = this.state;
    const { repoName } = this.props;
    const options = {
      // get one extra to detect if there are more jobs that can be loaded (hasNextPage)
      count: this.pageSize + 1,
      offset: (page - 1) * this.pageSize
    };

    ['filterBuildPlatformId', 'filterOptionCollectionHash']
      .forEach((key) => {
        if (this.state[key]) {
          const field = this.filterMap[key];
          options[field] = selectedJob[field];
        }
    });

    const newSimilarJobs = await this.ThJobModel.get_similar_jobs(repoName, selectedJob.id, options);

    if (newSimilarJobs.length > 0) {
      this.setState({ hasNextPage: newSimilarJobs.length > this.pageSize });
      newSimilarJobs.pop();
      // create an array of unique push ids
      const pushIds = [...new Set(newSimilarJobs.map(job => job.result_set_id))];
      // get pushes and revisions for the given ids
      const pushListResp = await this.ThResultSetModel.getResultSetList(repoName, pushIds, true);
      const pushList = pushListResp.data;
      //decorate the list of jobs with their result sets
      const pushes = pushList.results.reduce((acc, push) => (
        { ...acc, [push.id]: push }
      ), {});
      newSimilarJobs.forEach((simJob) => {
        simJob.result_set = pushes[simJob.result_set_id];
        simJob.revisionResultsetFilterUrl = `/#/jobs?repo=${repoName}&revision=${simJob.result_set.revisions[0].revision}`;
        simJob.authorResultsetFilterUrl = `/#/jobs?repo=${repoName}&author=${encodeURIComponent(simJob.result_set.author)}`;
      });
      this.setState({ similarJobs: [...similarJobs, ...newSimilarJobs] });
      // on the first page show the first element info by default
      if (!selectedSimilarJob && newSimilarJobs.length > 0) {
        this.showJobInfo(newSimilarJobs[0]);
      }
    }
    this.setState({ isLoading: false });
  }

  // this is triggered by the show previous jobs button
  showNext() {
    const { page } = this.state;
    this.setState({ page: page + 1, isLoading: true }, this.getSimilarJobs);
  }

  showJobInfo(job) {
    const { repoName } = this.props;

    this.ThJobModel.get(repoName, job.id)
      .then((nextJob) => {
        nextJob.result_status = getStatus(nextJob);
        nextJob.duration = nextJob.end_timestamp - nextJob.start_timestamp / 60;
        nextJob.failure_classification = this.thClassificationTypes.classifications[
          nextJob.failure_classification_id];

        //retrieve the list of error lines
        this.ThTextLogStepModel.query({
          project: repoName,
          jobId: nextJob.id
        }, (textLogSteps) => {
          nextJob.error_lines = textLogSteps.reduce((acc, step) => (
            [...acc, ...step.errors]), []);
          this.setState({ selectedSimilarJob: nextJob });
        });
      });
  }

  toggleFilter(filterField) {
    this.setState(
      { [filterField]: !this.state[filterField], similarJobs: [], isLoading: true },
      this.getSimilarJobs
    );
  }

  render() {
    const {
      similarJobs,
      selectedSimilarJob,
      hasNextPage,
      filterOptionCollectionHash,
      filterBuildPlatformId,
      isLoading,
    } = this.state;
    const button_class = job => getBtnClass(getStatus(job));
    const selectedSimilarJobId = selectedSimilarJob ? selectedSimilarJob.id : null;

    return (
      <div className="similar_jobs w-100">
        <div className="left_panel">
          <table className="table table-super-condensed table-hover">
            <thead>
              <tr>
                <th>Job</th>
                <th>Pushed</th>
                <th>Author</th>
                <th>Revision</th>
              </tr>
            </thead>
            <tbody>
              {similarJobs.map(similarJob => (
                <tr
                  key={similarJob.id}
                  onClick={() => this.showJobInfo(similarJob)}
                  className={selectedSimilarJobId === similarJob.id ? 'table-active' : ''}
                >
                  <td>
                    <button
                      className={`btn btn-similar-jobs btn-xs ${button_class(similarJob)}`}
                    >{similarJob.job_type_symbol}
                      {similarJob.failure_classification_id > 1 &&
                      <span>*</span>}
                    </button>
                  </td>
                  <td
                    title={toDateStr(similarJob.result_set.push_timestamp)}
                  >{toShortDateStr(similarJob.result_set.push_timestamp)}</td>
                  <td>
                    <a href={similarJob.authorResultsetFilterUrl}>
                      {similarJob.result_set.author}
                    </a>
                  </td>
                  <td>
                    <a href={similarJob.revisionResultsetFilterUrl}>
                      {similarJob.result_set.revisions[0].revision}
                    </a>
                  </td>
                </tr>))}
            </tbody>
          </table>
          {hasNextPage &&
          <button
            className="btn btn-light-bordered btn-sm link-style"
            onClick={this.showNext}
          >Show previous jobs</button>}
        </div>
        <div className="right_panel">
          <form className="form form-inline">
            <div className="checkbox">
              <input
                onChange={() => this.toggleFilter('filterBuildPlatformId')}
                type="checkbox"
                checked={filterBuildPlatformId}
              />
              <small>Same platform</small>

            </div>
            <div className="checkbox">
              <input
                onChange={() => this.toggleFilter('filterOptionCollectionHash')}
                type="checkbox"
                checked={filterOptionCollectionHash}
              />
              <small>Same options</small>

            </div>
          </form>
          <div className="similar_job_detail">
            {selectedSimilarJob && <table className="table table-super-condensed">
              <tbody>
                <tr>
                  <th>Result</th>
                  <td>{selectedSimilarJob.result_status}</td>
                </tr>
                <tr>
                  <th>Machine name</th>
                  <td>
                    <a
                      target="_blank"
                      rel="noopener"
                      href={getSlaveHealthUrl(selectedSimilarJob.machine_name)}
                    >{selectedSimilarJob.machine_name}</a>
                  </td>
                </tr>
                <tr>
                  <th>Build</th>
                  <td>
                    {selectedSimilarJob.build_architecture} {selectedSimilarJob.build_platform} {selectedSimilarJob.build_os}
                  </td>
                </tr>
                <tr>
                  <th>Build option</th>
                  <td>
                    {selectedSimilarJob.platform_option}
                  </td>
                </tr>
                <tr>
                  <th>Job name</th>
                  <td>{selectedSimilarJob.job_type_name}</td>
                </tr>
                <tr>
                  <th>Started</th>
                  <td>{toDateStr(selectedSimilarJob.start_timestamp)}</td>
                </tr>
                <tr>
                  <th>Duration</th>
                  <td>
                    {selectedSimilarJob.duration >= 0 ? selectedSimilarJob.duration.toFixed(0) + ' minute(s)' : 'unknown'}
                  </td>
                </tr>
                <tr>
                  <th>Classification</th>
                  <td>
                    <label
                      className={`badge ${selectedSimilarJob.failure_classification.star}`}
                    >{selectedSimilarJob.failure_classification.name}</label>
                  </td>
                </tr>
                {!!selectedSimilarJob.error_lines && <tr>
                  <td colSpan={2}>
                    <ul className="list-unstyled error_list">
                      {selectedSimilarJob.error_lines.map(error => (<li key={error.id}>
                        <small title={error.line}>{error.line}</small>
                      </li>))}
                    </ul>
                  </td>
                </tr>}
              </tbody>
            </table>}
          </div>
        </div>
        {isLoading && <div className="overlay">
          <div>
            <span className="fa fa-spinner fa-pulse th-spinner-lg" />
          </div>
        </div>}
      </div>
  );
  }
}

SimilarJobsTab.propTypes = {
  $injector: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
};

treeherder.component('similarJobsTab', react2angular(
  SimilarJobsTab,
  ['repoName'],
  ['$injector']));
