import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Alert, Button } from 'reactstrap';
import {
  faInfoCircle,
  faExternalLinkAlt,
  faRedo,
  faTable,
  faFilm,
} from '@fortawesome/free-solid-svg-icons';
import { faYoutube } from '@fortawesome/free-brands-svg-icons';

import {
  getCompareChooserUrl,
  getJobsUrl,
  getPerfAnalysisUrl,
} from '../../../helpers/url';
import { triggerTask } from '../../../helpers/performance';
import { notify } from '../../redux/stores/notifications';
import { isPerfTest } from '../../../helpers/job';
import {
  geckoProfileTaskName,
  sxsJobTypeName,
  sxsTaskName,
} from '../../../helpers/constants';

import SideBySide from './SideBySide';
import PerfData from './PerfData';
/**
 * The performance tab shows performance-oriented information about a test run.
 * It helps users interact with the Firefox Profiler, and summarizes test
 * timing information.
 */
class PerformanceTab extends React.PureComponent {
  constructor(props) {
    super(props);
    const { selectedJobFull } = this.props;
    this.state = {
      triggeredGeckoProfiles: 0,
      showSideBySide: selectedJobFull.job_type_name.includes(sxsJobTypeName),
    };
  }

  createGeckoProfile = async () => {
    const {
      selectedJobFull,
      notify,
      decisionTaskMap,
      currentRepo,
    } = this.props;
    await triggerTask(
      selectedJobFull,
      notify,
      decisionTaskMap,
      currentRepo,
      geckoProfileTaskName,
    );
    this.setState((state) => ({
      triggeredGeckoProfiles: state.triggeredGeckoProfiles + 1,
    }));
  };

  createSideBySide = async () => {
    const {
      selectedJobFull,
      notify,
      decisionTaskMap,
      currentRepo,
    } = this.props;
    await triggerTask(
      selectedJobFull,
      notify,
      decisionTaskMap,
      currentRepo,
      sxsTaskName,
    );
  };

  maybeGetFirefoxProfilerLink() {
    // Look for a profiler artifact.
    const jobDetail = this.props.jobDetails.find(
      ({ url, value }) =>
        url &&
        value.startsWith('profile_') &&
        (value.endsWith('.zip') || value.endsWith('.json')),
    );

    if (jobDetail) {
      return (
        <a
          title={jobDetail.value}
          href={getPerfAnalysisUrl(jobDetail.url)}
          className="btn btn-darker-secondary btn-sm"
          target="_blank"
          rel="noopener noreferrer"
        >
          <FontAwesomeIcon icon={faExternalLinkAlt} className="mr-2" />
          Open in Firefox Profiler
        </a>
      );
    }

    return null;
  }

  render() {
    const {
      repoName,
      revision,
      selectedJobFull,
      jobDetails,
      perfJobDetail,
    } = this.props;
    const { triggeredGeckoProfiles, showSideBySide } = this.state;
    const profilerLink = this.maybeGetFirefoxProfilerLink();

    return (
      <div
        className="performance-panel h-100 overflow-auto"
        role="region"
        aria-label="Performance"
      >
        <div className="performance-panel-actions d-flex">
          {
            // If there is a profiler link, show this first. This is most likely
            // the primary action of the user here.
            profilerLink
          }
          {
            // Just to be safe, use the same isPerfTest check the other
            // "Create Gecko Profile" button uses in the action menu.
            isPerfTest(selectedJobFull) ? (
              <Button
                className={`btn ${
                  // Only make this primary if there is no profiler link.
                  profilerLink
                    ? 'btn-outline-darker-secondary'
                    : 'btn-darker-secondary'
                } btn-sm`}
                onClick={this.createGeckoProfile}
                title={
                  'Trigger another run of this test with the profiler enabled. The ' +
                  'profile can then be viewed in the Firefox Profiler.'
                }
              >
                <FontAwesomeIcon icon={faRedo} className="mr-2" />
                {profilerLink
                  ? 'Re-trigger performance profile'
                  : 'Generate performance profile'}
              </Button>
            ) : null
          }
          {selectedJobFull.hasSideBySide && (
            <a
              title="Open side-by-side job"
              href={getJobsUrl({
                repo: repoName,
                revision,
                searchStr: selectedJobFull.hasSideBySide,
                group_state: 'expanded',
              })}
              className="btn btn-darker-secondary btn-sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FontAwesomeIcon icon={faExternalLinkAlt} className="mr-2" />
              <FontAwesomeIcon icon={faYoutube} className="mr-2" />
              Open side-by-side job
            </a>
          )}
          {isPerfTest(selectedJobFull) && !selectedJobFull.hasSideBySide && (
            <Button
              className="btn btn-darker-secondary btn-sm"
              onClick={this.createSideBySide}
              title="Generate side-by-side"
            >
              <FontAwesomeIcon icon={faFilm} className="mr-2" />
              Generate side-by-side
            </Button>
          )}
          <a
            href={getCompareChooserUrl({
              newProject: repoName,
              newRevision: revision,
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline-darker-secondary btn-sm"
          >
            <FontAwesomeIcon icon={faTable} className="mr-2" />
            Compare against another revision
          </a>
        </div>
        {
          // It can be confusing after triggering a profile what happens next. The
          // job list only gets populated later. This notification will help the
          // user know the next action.
          triggeredGeckoProfiles > 0 ? (
            <Alert color="info" className="m-1">
              <FontAwesomeIcon icon={faInfoCircle} className="mr-1" />
              {triggeredGeckoProfiles === 1
                ? `Triggered ${triggeredGeckoProfiles} profiler run. It will show up ` +
                  `as a new entry in the job list once the task has been scheduled.`
                : `Triggered ${triggeredGeckoProfiles} profiler runs. They will show up ` +
                  `as new entries in the job list once the task has been scheduled.`}
            </Alert>
          ) : null
        }
        {perfJobDetail.length !== 0 && (
          <PerfData
            perfJobDetail={perfJobDetail}
            selectedJobFull={selectedJobFull}
          />
        )}
        {showSideBySide && <SideBySide jobDetails={jobDetails} />}
      </div>
    );
  }
}

PerformanceTab.propTypes = {
  repoName: PropTypes.string.isRequired,
  jobDetails: PropTypes.arrayOf(PropTypes.object),
  perfJobDetail: PropTypes.arrayOf(PropTypes.object),
  revision: PropTypes.string,
  decisionTaskMap: PropTypes.shape({}).isRequired,
};

PerformanceTab.defaultProps = {
  jobDetails: [],
  perfJobDetail: [],
  revision: '',
};

const mapStateToProps = (state) => ({
  decisionTaskMap: state.pushes.decisionTaskMap,
});
const mapDispatchToProps = { notify };

export default connect(mapStateToProps, mapDispatchToProps)(PerformanceTab);
