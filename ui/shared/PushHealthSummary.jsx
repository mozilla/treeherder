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

    return (
      <div>
        <a
          href={getPushHealthUrl({ revision, repo: repoName })}
          title="View Push Health details for this push"
        >
          <h4>
            Push Health Summary
            <FontAwesomeIcon icon={faExternalLinkAlt} className="ml-1" />
            {healthStatus !== null ? (
              <img
                src={needInvestigation ? broken : ok}
                alt={needInvestigation ? 'Broken' : 'OK'}
                width="30"
                height="30"
                className="ml-1"
              />
            ) : (
              <span className="ml-1 text-darker-secondary">
                <FontAwesomeIcon
                  icon={faHeart}
                  height="30"
                  width="30"
                  color="darker-secondary"
                />
              </span>
            )}
          </h4>
        </a>
        {healthStatus ? (
          <Table className="ml-1 w-100">
            <tbody>
              <tr>
                <th className="ml-2" scope="row">
                  Test Failures
                </th>
                <td>{testFailureCount}</td>
              </tr>
              <tr>
                <th scope="row">Build Failures</th>
                <td>{buildFailureCount}</td>
              </tr>
              <tr>
                <th scope="row">Linting Failures</th>
                <td>{lintFailureCount}</td>
              </tr>
              <tr>
                <th scope="row">Unsupported</th>
                <td>{unsupported}</td>
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
