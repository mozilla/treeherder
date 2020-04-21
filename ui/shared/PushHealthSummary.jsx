import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Spinner, Table } from 'reactstrap';
import { faHeart, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import broken from '../img/push-health-broken.png';
import ok from '../img/push-health-ok.png';
import { getPushHealthUrl } from '../helpers/url';

class PushHealthSummary extends PureComponent {
  render() {
    const { healthStatus, revision, repoName } = this.props;
    const status = healthStatus || {};
    const {
      needInvestigation,
      testFailureCount,
      buildFailureCount,
      lintFailureCount,
      unsupported,
    } = status;
    const heartSize = 25;

    return (
      <div>
        <a
          href={getPushHealthUrl({ revision, repo: repoName })}
          title="View Push Health details for this push"
        >
          <div>
            {healthStatus !== null ? (
              <img
                src={needInvestigation ? broken : ok}
                alt={needInvestigation ? 'Broken' : 'OK'}
                width={heartSize}
                height={heartSize}
                className="mr-1"
              />
            ) : (
              <span className="ml-1 text-darker-secondary">
                <FontAwesomeIcon
                  icon={faHeart}
                  height={heartSize}
                  width={heartSize}
                  color="darker-secondary"
                />
              </span>
            )}
            Push Health Summary
            <FontAwesomeIcon
              icon={faExternalLinkAlt}
              className="ml-1 icon-superscript"
            />
          </div>
        </a>
        {healthStatus ? (
          <Table className="ml-3 w-100 small-text row-height-tight">
            <tbody>
              <tr className={`${buildFailureCount ? 'font-weight-bold' : ''}`}>
                <td className="py-1">Build Failures</td>
                <td className="py-1">{buildFailureCount}</td>
              </tr>
              <tr
                className={`${testFailureCount ? 'font-weight-bold' : ''} py-1`}
              >
                <td className="py-1">Test Failures</td>
                <td className="py-1">{testFailureCount}</td>
              </tr>
              <tr
                className={`${lintFailureCount ? 'font-weight-bold' : ''} py-1`}
              >
                <td className="py-1">Linting Failures</td>
                <td className="py-1">{lintFailureCount}</td>
              </tr>
              <tr className={`${unsupported ? 'font-weight-bold' : ''} py-1`}>
                <td className="py-1">Unsupported</td>
                <td className="py-1">{unsupported}</td>
              </tr>
            </tbody>
          </Table>
        ) : (
          <Spinner />
        )}
      </div>
    );
  }
}

PushHealthSummary.propTypes = {
  revision: PropTypes.string.isRequired,
  repoName: PropTypes.string.isRequired,
  healthStatus: PropTypes.shape({
    needInvestigation: PropTypes.number,
    testFailureCount: PropTypes.number,
    buildFailureCount: PropTypes.number,
    lintFailureCount: PropTypes.number,
    unsupported: PropTypes.number,
  }),
};

PushHealthSummary.defaultProps = {
  healthStatus: {},
};

export default PushHealthSummary;
