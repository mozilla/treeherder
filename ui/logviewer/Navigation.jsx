import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartBar, faFileAlt } from '@fortawesome/free-regular-svg-icons';
import { faTree, faGaugeHigh } from '@fortawesome/free-solid-svg-icons';
import { Button } from 'reactstrap';

import LogoMenu from '../shared/LogoMenu';
import { getPerfAnalysisUrl, isResourceUsageProfile } from '../helpers/url';

// Get the css class for the result, step buttons and other general use
const getShadingClass = (result) => `result-status-shading-${result}`;

export default class Navigation extends React.PureComponent {
  render() {
    const {
      jobExists,
      result,
      jobError,
      jobUrl,
      rawLogUrl,
      reftestUrl,
      collapseDetails,
      collapseJobDetails,
      copySelectedLogToBugFiler,
      job,
      jobDetails,
    } = this.props;
    const resultStatusShading = getShadingClass(result);
    const resourceUsageProfile = jobDetails?.find((artifact) =>
      isResourceUsageProfile(artifact.value),
    );

    return (
      <nav className="navbar navbar-dark bg-dark p-0" role="navigation">
        <div id="th-global-navbar-top">
          <div className="nav mr-auto flex-row">
            <span id="lv-logo">
              <LogoMenu menuText="Logviewer" />
            </span>
            {jobExists ? (
              <span
                className={`lightgray ${resultStatusShading} pt-2 pl-2 pr-2`}
                style={{ minWidth: '150px' }}
              >
                <strong>Result: </strong>
                {result}
              </span>
            ) : (
              <span className="alert-danger">
                <span title="The job does not exist or has expired">
                  {`Unavailable: ${jobError}`}
                </span>
              </span>
            )}
            <span>
              <a
                title={
                  jobUrl ? 'Open the Job in Treeherder' : 'Loading job data...'
                }
                className={`nav-link btn-view-nav ${!jobUrl ? 'disabled' : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                href={jobUrl || '#'}
                {...(!jobUrl && { onClick: (e) => e.preventDefault() })}
              >
                <FontAwesomeIcon
                  icon={faTree}
                  className="actionbtn-icon mr-1"
                />
                <span>open Job</span>
              </a>
            </span>
            <span>
              <a
                title="Open the raw log in a new window (Shift+L)"
                className="nav-link btn-view-nav"
                target="_blank"
                rel="noopener noreferrer"
                href={rawLogUrl}
              >
                <FontAwesomeIcon
                  icon={faFileAlt}
                  className="actionbtn-icon mr-1"
                />
                <span>open raw log</span>
              </a>
            </span>
            {resourceUsageProfile && (
              <span>
                <a
                  title="Show the resource usage profile in the Firefox Profiler (g)"
                  className="nav-link btn-view-nav"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={getPerfAnalysisUrl(resourceUsageProfile.url, job)}
                >
                  <FontAwesomeIcon
                    icon={faGaugeHigh}
                    className="actionbtn-icon mr-1"
                  />
                  <span>open profiler</span>
                </a>
              </span>
            )}
            {!!reftestUrl && (
              <span>
                <a
                  title="Open the Reftest Analyser in a new window"
                  className="nav-link btn-view-nav"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={reftestUrl}
                >
                  <FontAwesomeIcon
                    icon={faChartBar}
                    className="actionbtn-icon mr-1"
                  />
                  <span>open analyser</span>
                </a>
              </span>
            )}
            <span>
              <Button
                className="nav-link btn-view-nav"
                data-testid="log-lines-to-bug-filer"
                onClick={copySelectedLogToBugFiler}
              >
                Selected lines to bug filer
              </Button>
            </span>
            <span>
              <Button
                className="nav-link btn-view-nav"
                data-testid="show-job-info"
                onClick={collapseJobDetails}
              >
                {collapseDetails ? `Show Job Info` : `Hide Job Info`}
              </Button>
            </span>
          </div>
        </div>
      </nav>
    );
  }
}

Navigation.propTypes = {
  jobExists: PropTypes.bool.isRequired,
  result: PropTypes.string.isRequired,
  jobError: PropTypes.string.isRequired,
  rawLogUrl: PropTypes.string.isRequired,
  jobUrl: PropTypes.string,
  reftestUrl: PropTypes.string,
  collapseDetails: PropTypes.bool.isRequired,
  collapseJobDetails: PropTypes.func.isRequired,
  copySelectedLogToBugFiler: PropTypes.func.isRequired,
  job: PropTypes.shape({}),
  jobDetails: PropTypes.arrayOf(
    PropTypes.shape({
      url: PropTypes.string.isRequired,
      value: PropTypes.string.isRequired,
    }),
  ),
};

Navigation.defaultProps = {
  jobUrl: null,
  reftestUrl: null,
  job: null,
  jobDetails: [],
};
