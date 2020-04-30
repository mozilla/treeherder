import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartBar, faFileAlt } from '@fortawesome/free-regular-svg-icons';
import { faTree } from '@fortawesome/free-solid-svg-icons';

import LogoMenu from '../shared/LogoMenu';

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
    } = this.props;
    const resultStatusShading = getShadingClass(result);

    return (
      <nav className="navbar navbar-dark bg-dark mb-2 p-0" role="navigation">
        <div className="nav mr-auto flex-row">
          <span id="lv-logo">
            <LogoMenu menuText="Logviewer" />
          </span>
          {jobExists ? (
            <span className={`lightgray ${resultStatusShading} pt-2 pl-2 pr-2`}>
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
          {!!jobUrl && (
            <span>
              <a
                title="Open the Job in Treeherder"
                className="nav-link btn-view-nav"
                target="_blank"
                rel="noopener noreferrer"
                href={jobUrl}
              >
                <FontAwesomeIcon
                  icon={faTree}
                  className="actionbtn-icon mr-1"
                />
                <span>open Job</span>
              </a>
            </span>
          )}
          <span>
            <a
              title="Open the raw log in a new window"
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
};

Navigation.defaultProps = {
  jobUrl: null,
  reftestUrl: null,
};
