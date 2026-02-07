
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartBar, faFileAlt } from '@fortawesome/free-regular-svg-icons';
import { faTree, faGaugeHigh } from '@fortawesome/free-solid-svg-icons';
import { Button, Navbar, Nav } from 'react-bootstrap';

import LogoMenu from '../shared/LogoMenu';
import { getPerfAnalysisUrl, isResourceUsageProfile } from '../helpers/url';

// Get the css class for the result, step buttons and other general use
const getShadingClass = (result) => `result-status-shading-${result}`;

const Navigation = ({
  jobExists,
  result,
  jobError,
  jobUrl = null,
  rawLogUrl,
  reftestUrl = null,
  collapseDetails,
  collapseJobDetails,
  copySelectedLogToBugFiler,
  job = null,
  jobDetails = [],
}) => {
  const resourceUsageProfile = jobDetails?.find((artifact) =>
    isResourceUsageProfile(artifact.value),
  );
  const resultStatusShading = getShadingClass(result);

  return (
    <Navbar
      expand
      className="top-navbar navbar-dark bg-dark p-0"
      role="navigation"
    >
      <div className="d-flex align-items-center" id="lv-logo">
        <LogoMenu menuText="Logviewer" />
      </div>
      {jobExists ? (
        <span
          className={`lightgray ${resultStatusShading} d-flex align-items-center h-100 ps-2 pe-2`}
          style={{ minWidth: '150px' }}
        >
          <strong>Result:&nbsp;</strong>
          {result}
        </span>
      ) : (
        <span className="alert-danger d-flex align-items-center ps-2 pe-2">
          <span title="The job does not exist or has expired">
            {`Unavailable: ${jobError}`}
          </span>
        </span>
      )}
      <Nav className="me-auto">
        <Nav.Item>
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
            <FontAwesomeIcon icon={faTree} className="actionbtn-icon me-1" />
            <span>open Job</span>
          </a>
        </Nav.Item>
        <Nav.Item>
          <a
            title="Open the raw log in a new window (Shift+L)"
            className="nav-link btn-view-nav"
            target="_blank"
            rel="noopener noreferrer"
            href={rawLogUrl}
          >
            <FontAwesomeIcon icon={faFileAlt} className="actionbtn-icon me-1" />
            <span>open raw log</span>
          </a>
        </Nav.Item>
        {resourceUsageProfile && (
          <Nav.Item>
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
          </Nav.Item>
        )}
        {!!reftestUrl && (
          <Nav.Item>
            <a
              title="Open the Reftest Analyser in a new window"
              className="nav-link btn-view-nav"
              target="_blank"
              rel="noopener noreferrer"
              href={reftestUrl}
            >
              <FontAwesomeIcon
                icon={faChartBar}
                className="actionbtn-icon me-1"
              />
              <span>open analyser</span>
            </a>
          </Nav.Item>
        )}
        <Nav.Item>
          <Button
            className="nav-link btn-view-nav"
            data-testid="log-lines-to-bug-filer"
            onClick={copySelectedLogToBugFiler}
          >
            Selected lines to bug filer
          </Button>
        </Nav.Item>
        <Nav.Item>
          <Button
            className="nav-link btn-view-nav"
            data-testid="show-job-info"
            onClick={collapseJobDetails}
          >
            {collapseDetails ? 'Show Job Info' : 'Hide Job Info'}
          </Button>
        </Nav.Item>
      </Nav>
    </Navbar>
  );
};

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

export default Navigation;
