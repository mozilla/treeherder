import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Alert, Button } from 'react-bootstrap';
import {
  faInfoCircle,
  faExternalLinkAlt,
  faRedo,
  faTable,
  faFilm,
} from '@fortawesome/free-solid-svg-icons';
import { faYoutube } from '@fortawesome/free-brands-svg-icons';

import {
  getPerfCompareChooserUrl,
  getJobsUrl,
  getPerfAnalysisUrl,
} from '../../../helpers/url';
import { triggerTask } from '../../../helpers/performance';
import { notify } from '../../redux/stores/notifications';
import { isPerfTest } from '../../../helpers/job';
import { geckoProfileTaskName, sxsTaskName } from '../../../helpers/constants';

import SideBySide from './SideBySide';
import PerfData from './PerfData';

const PROFILE_ZIP_RELEVANCE = 4;
const PROFILE_RESOURCE_RELEVANCE = 3;
const PROFILE_BUILD_RELEVANCE = 2;
const PROFILE_JSON_RELEVANCE = 1;
const NO_PROFILE_RELEVANCE = 0;
const NON_PERFTEST_RELEVANCES = [
  PROFILE_RESOURCE_RELEVANCE,
  PROFILE_BUILD_RELEVANCE,
];

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
      showSideBySide: selectedJobFull.job_type_symbol.includes(sxsTaskName),
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

  getProfileRelevance = (jobDetail) => {
    const { url, value } = jobDetail;
    if (!url) {
      return NO_PROFILE_RELEVANCE;
    }

    if (!value.startsWith('profile_')) {
      return NO_PROFILE_RELEVANCE;
    }

    if (value.endsWith('.zip')) {
      return PROFILE_ZIP_RELEVANCE;
    }

    if (!value.endsWith('.json')) {
      return NO_PROFILE_RELEVANCE;
    }

    if (value === 'profile_resource-usage.json') {
      return PROFILE_RESOURCE_RELEVANCE;
    }

    if (value === 'profile_build_resources.json') {
      return PROFILE_BUILD_RELEVANCE;
    }

    return PROFILE_JSON_RELEVANCE;
  };

  // Returns profile-related job details, ordered by the relevance.
  getProfiles = (perfTestOnly) => {
    const profiles = [];
    for (const jobDetail of this.props.jobDetails) {
      const relevance = this.getProfileRelevance(jobDetail);
      if (relevance === NO_PROFILE_RELEVANCE) {
        continue;
      }
      if (perfTestOnly) {
        if (NON_PERFTEST_RELEVANCES.includes(relevance)) {
          continue;
        }
      }

      profiles.push({ jobDetail, relevance });
    }
    return profiles.sort((a, b) => b.relevance - a.relevance);
  };

  maybeGetFirefoxProfilerLink = (perfTestOnly) => {
    const profiles = this.getProfiles(perfTestOnly);

    if (profiles.length === 0) {
      return null;
    }

    // Use the most relevant profile.
    const { jobDetail } = profiles[0];
    const { selectedJobFull } = this.props;

    return (
      <a
        title={jobDetail.value}
        href={getPerfAnalysisUrl(jobDetail.url, selectedJobFull)}
        className="btn btn-darker-secondary btn-sm"
        target="_blank"
        rel="noopener noreferrer"
        data-testid="open-profiler"
      >
        <FontAwesomeIcon icon={faExternalLinkAlt} className="me-2" />
        Open in Firefox Profiler
      </a>
    );
  };

  render() {
    const {
      repoName,
      revision,
      selectedJobFull,
      jobDetails,
      perfJobDetail,
    } = this.props;
    const { triggeredGeckoProfiles, showSideBySide } = this.state;

    // Just to be safe, use the same isPerfTest check the other
    // "Create Gecko Profile" button uses in the action menu.
    const perfTest = isPerfTest(selectedJobFull);

    const profilerLink = this.maybeGetFirefoxProfilerLink(perfTest);

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
          {perfTest ? (
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
              data-testid="generate-profile"
            >
              <FontAwesomeIcon icon={faRedo} className="me-2" />
              {profilerLink
                ? 'Re-trigger performance profile'
                : 'Generate performance profile'}
            </Button>
          ) : null}
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
              <FontAwesomeIcon icon={faExternalLinkAlt} className="me-2" />
              <FontAwesomeIcon icon={faYoutube} className="me-2" />
              Open side-by-side job
            </a>
          )}
          {perfTest && !showSideBySide && !selectedJobFull.hasSideBySide && (
            <Button
              className="btn btn-darker-secondary btn-sm"
              onClick={this.createSideBySide}
              title="Generate side-by-side"
            >
              <FontAwesomeIcon icon={faFilm} className="me-2" />
              Generate side-by-side
            </Button>
          )}
          <a
            href={getPerfCompareChooserUrl({
              newRepo: repoName,
              newRev: revision,
              frameworkName: perfJobDetail[0].frameworkName,
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline-darker-secondary btn-sm"
          >
            <FontAwesomeIcon icon={faTable} className="me-2" />
            Compare against another revision
          </a>
        </div>
        {
          // It can be confusing after triggering a profile what happens next. The
          // job list only gets populated later. This notification will help the
          // user know the next action.
          triggeredGeckoProfiles > 0 ? (
            <Alert variant="info" className="m-1">
              <FontAwesomeIcon icon={faInfoCircle} className="me-1" />
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
  jobDetails: PropTypes.arrayOf(PropTypes.shape({})),
  perfJobDetail: PropTypes.arrayOf(PropTypes.shape({})),
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
