import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faInfoCircle,
  faExternalLinkAlt,
  faRedo,
  faTable,
} from '@fortawesome/free-solid-svg-icons';

import { getCompareChooserUrl, getPerfAnalysisUrl } from '../../../helpers/url';
import { triggerGeckoProfileTask } from '../../../helpers/performance';
import { notify } from '../../redux/stores/notifications';
import { isPerfTest } from '../../../helpers/job';

/**
 * The performance tab shows performance-oriented information about a test run.
 * It helps users interact with the Firefox Profiler, and summarizes test
 * timing information.
 */
class PerformanceTab extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      triggeredGeckoProfiles: 0,
    };
  }

  createGeckoProfile = async () => {
    const {
      selectedJobFull,
      notify,
      decisionTaskMap,
      currentRepo,
    } = this.props;
    await triggerGeckoProfileTask(
      selectedJobFull,
      notify,
      decisionTaskMap,
      currentRepo,
    );
    this.setState((state) => ({
      triggeredGeckoProfiles: state.triggeredGeckoProfiles + 1,
    }));
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
          className="btn btn-primary btn-sm"
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
    const { repoName, revision, perfJobDetail, selectedJobFull } = this.props;
    const { triggeredGeckoProfiles } = this.state;
    const profilerLink = this.maybeGetFirefoxProfilerLink();
    const sortedDetails = perfJobDetail ? perfJobDetail.slice() : [];

    sortedDetails.sort((a, b) => a.title.localeCompare(b.title));

    return (
      <div
        className="performance-panel h-100 overflow-auto"
        role="region"
        aria-label="Performance"
      >
        <div className="performance-panel-actions">
          {
            // If there is a profiler link, show this first. This is most likely
            // the primary action of the user here.
            profilerLink
          }
          {
            // Just to be safe, use the same isPerfTest check the other
            // "Create Gecko Profile" button uses in the action menu.
            isPerfTest(selectedJobFull) ? (
              <button
                type="button"
                className={`btn btn-${
                  // Only make this primary if there is no profiler link.
                  profilerLink ? 'secondary' : 'primary'
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
              </button>
            ) : null
          }
          <a
            href={getCompareChooserUrl({
              newProject: repoName,
              newRevision: revision,
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
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
            <div className="alert alert-info m-1" role="alert">
              <FontAwesomeIcon icon={faInfoCircle} className="mr-1" />
              {triggeredGeckoProfiles === 1
                ? `Triggered ${triggeredGeckoProfiles} profiler run. It will show up ` +
                  `as a new entry in the job list once the task has been scheduled.`
                : `Triggered ${triggeredGeckoProfiles} profiler runs. They will show up ` +
                  `as new entries in the job list once the task has been scheduled.`}
            </div>
          ) : null
        }
        {!!sortedDetails.length && (
          <ul>
            <li>
              Perfherder:
              {sortedDetails.map((detail, idx) => (
                <ul
                  key={idx} // eslint-disable-line react/no-array-index-key
                >
                  <li>
                    {detail.title}:<a href={detail.url}> {detail.value}</a>
                  </li>
                </ul>
              ))}
            </li>
          </ul>
        )}
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
