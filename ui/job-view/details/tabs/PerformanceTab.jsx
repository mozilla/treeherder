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
} from '@fortawesome/free-solid-svg-icons';

import { getCompareChooserUrl, getPerfAnalysisUrl } from '../../../helpers/url';
import { triggerGeckoProfileTask } from '../../../helpers/performance';
import { notify } from '../../redux/stores/notifications';
import { isPerfTest } from '../../../helpers/job';

import SideBySide from './SideBySide';

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
      showSideBySide: selectedJobFull.job_type_name.includes(
        'perftest-linux-side-by-side',
      ),
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

  maybeRenderPerfData() {
    const { perfJobDetail, selectedJobFull } = this.props;
    if (perfJobDetail.length === 0) {
      return null;
    }

    const sortedDetails = perfJobDetail.slice();

    // These styles are shared across all of the table cells.
    const cellClassName = 'nowrap pl-2 pr-2';

    return (
      <>
        <h3 className="font-size-16 mt-3 mb-2">
          Results for: {selectedJobFull.job_type_name}
        </h3>
        <table className="table table-sm performance-panel-data">
          <thead>
            <tr>
              <th scope="col" className={`text-right ${cellClassName}`}>
                Value
              </th>
              <th scope="col" className={cellClassName}>
                Unit
              </th>
              <th scope="col" className={cellClassName}>
                Better
              </th>
              <th scope="col" className={cellClassName}>
                History
              </th>
              <th scope="col" className={cellClassName}>
                Name
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedDetails.map(
              (
                {
                  value,
                  url,
                  measurementUnit,
                  lowerIsBetter,
                  title,
                  suite,
                  perfdocs,
                },
                idx,
              ) => (
                // eslint-disable-next-line react/no-array-index-key
                <tr key={idx}>
                  {/* Ensure the value and measurement are visually next to each
                  other in the chart, by aligning the value to the right. */}
                  <td className={`text-right ${cellClassName}`}>{value}</td>
                  <td className={cellClassName}>{measurementUnit || '–'}</td>
                  <td className={cellClassName}>
                    {lowerIsBetter ? 'Lower' : 'Higher'}
                  </td>
                  <td className={cellClassName}>
                    <a
                      href={url}
                      className="btn btn-outline-darker-secondary btn-sm performance-panel-view-button"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View
                    </a>
                  </td>
                  <td className="w-100">
                    {perfdocs.hasDocumentation() ? (
                      <div>
                        <a
                          href={perfdocs.documentationURL}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {`${suite} `}
                        </a>
                        {`${perfdocs.remainingName}`}
                      </div>
                    ) : (
                      title
                    )}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </>
    );
  }

  render() {
    const { repoName, revision, selectedJobFull, jobDetails } = this.props;
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
        {this.maybeRenderPerfData()}
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
