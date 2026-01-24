import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faExternalLinkAlt,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import { Table } from 'react-bootstrap';

import { getJobsUrl } from '../../../helpers/url';
import { notify } from '../../redux/stores/notifications';
import { getData } from '../../../helpers/http';
import Clipboard from '../../../shared/Clipboard';

import SideBySideVideo from './SideBySideVideo';

class SideBySide extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      sideBySideLoading: false,
      sideBySideParams: undefined,
    };
  }

  componentDidMount() {
    const { sideBySideParams } = this.state;
    if (!sideBySideParams) {
      this.getSideBySideParams();
    }
  }

  getSideBySideParams() {
    const { jobDetails = [] } = this.props;

    this.setState(
      {
        sideBySideLoading: true,
      },
      () => {
        if (jobDetails && jobDetails.length > 3) {
          const sideBySideParamsPromise = getData(jobDetails[3].url, {
            'Access-Control-Allow-Origin': ['*'],
          });
          Promise.all([sideBySideParamsPromise]).then(
            async ([sideBySideParamsResult]) => {
              const sideBySideParams = sideBySideParamsResult.data;

              this.setState(
                {
                  sideBySideParams,
                },
                async () => {
                  this.setState({ sideBySideLoading: false });
                },
              );
            },
          );
        }
      },
    );
  }

  render() {
    const { jobDetails = [] } = this.props;
    const { sideBySideLoading, sideBySideParams } = this.state;

    if (!sideBySideParams) {
      return null;
    }
    if (jobDetails.length === 0) {
      return null;
    }

    const beforeJobLink = getJobsUrl({
      repo: sideBySideParams.base_branch,
      revision: sideBySideParams.base_revision,
      searchStr: [
        sideBySideParams.platform,
        '/opt-',
        sideBySideParams.test_name,
      ].join(''),
      group_state: 'expanded',
    });
    const afterJobLink = getJobsUrl({
      repo: sideBySideParams.new_branch,
      revision: sideBySideParams.new_revision,
      searchStr: [
        sideBySideParams.test_name,
        '/opt-',
        sideBySideParams.platform,
      ].join(''),
      group_state: 'expanded',
    });

    const videos = {
      cold: [jobDetails[0], jobDetails[2]],
      warm: [jobDetails[4], jobDetails[6]],
    };

    return sideBySideLoading ? (
      <div className="overlay">
        <div>
          <FontAwesomeIcon
            icon={faSpinner}
            pulse
            className="th-spinner-lg"
            title="Loading..."
          />
        </div>
      </div>
    ) : (
      <div>
        <h3 className="font-size-16 mt-3 mb-2">
          <strong>Side by side comparison for test </strong>
          <code>{sideBySideParams.test_name}</code>
          <strong> on platform </strong>
          <code>{sideBySideParams.platform}</code>
        </h3>
        <h3 className="font-size-12 mb-2 d-flex flex-column">
          <div className="d-flex">
            <div className="pt-1">
              <strong>Before: </strong>

              <span>
                {sideBySideParams.base_branch} /{' '}
                {sideBySideParams.base_revision.substring(0, 12)}
              </span>
              <a
                title={`Open revision ${sideBySideParams.base_revision} on ${sideBySideParams.base_branch}`}
                href={beforeJobLink}
                target="_blank"
                rel="noopener noreferrer"
                className="font-monospace ms-1"
              >
                (<FontAwesomeIcon icon={faExternalLinkAlt} className="me-2" />
                job)
              </a>
            </div>
            <Clipboard description="job link" text={beforeJobLink} />
            <div className="pt-1 ms-1">
              <strong>After: </strong>

              <span>
                {sideBySideParams.new_branch} /{' '}
                {sideBySideParams.new_revision.substring(0, 12)}
              </span>
              <a
                title={`Open revision ${sideBySideParams.new_revision} on ${sideBySideParams.new_branch}`}
                href={afterJobLink}
                target="_blank"
                rel="noopener noreferrer"
                className="font-monospace ms-1"
              >
                (<FontAwesomeIcon icon={faExternalLinkAlt} className="me-2" />
                job)
              </a>
            </div>
            <Clipboard description="job link" text={afterJobLink} />
          </div>
        </h3>
        {jobDetails && (
          <Table>
            <tbody>
              <tr className="d-flex">
                <td>
                  <div className="d-flex mb-1">
                    <span>Select video</span>
                  </div>
                  <SideBySideVideo videos={videos.cold} />
                </td>
                <td>
                  <div className="d-flex mb-1">
                    <span>Select video</span>
                  </div>
                  <SideBySideVideo videos={videos.warm} />
                </td>
              </tr>
            </tbody>
          </Table>
        )}
      </div>
    );
  }
}

SideBySide.propTypes = {
  jobDetails: PropTypes.arrayOf(PropTypes.shape({})),
};

const mapStateToProps = (state) => ({
  decisionTaskMap: state.pushes.decisionTaskMap,
});
const mapDispatchToProps = { notify };

export default connect(mapStateToProps, mapDispatchToProps)(SideBySide);
