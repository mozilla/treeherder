import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faExternalLinkAlt,
  faLeftRight,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import { Table } from 'reactstrap';

import { getJobsUrl } from '../../../helpers/url';
import { notify } from '../../redux/stores/notifications';
import { getData } from '../../../helpers/http';
import {thEvents} from "../../../helpers/constants";

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
    const { jobDetails } = this.props;

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
              console.log(sideBySideParamsResult);
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
    const { jobDetails } = this.props;
    const { sideBySideLoading, sideBySideParams } = this.state;

    if (!sideBySideParams) {
      return null;
    }
    if (jobDetails.length === 0) {
      return null;
    }

    // const sideBySideParams = {
    //   test_name: 'browsertime-tp6-essential-firefox-amazon',
    //   new_test_name: null,
    //   base_revision: 'fcc6a3eb9c660cce5574084c2b01521022a30d1f',
    //   new_revision: 'cb9000cac930a412240edae67ceff231ec13018a',
    //   base_branch: 'try',
    //   new_branch: 'try',
    //   platform: 'test-linux1804-64-shippable-qr',
    //   new_platform: null,
    //   overwrite: false,
    //   cold: false,
    //   warm: false,
    //   most_similar: false,
    //   search_crons: false,
    //   skip_download: false,
    //   output: null,
    //   metric: 'speedindex',
    //   vismetPath: false,
    //   original: false,
    //   skip_slow_gif: false,
    // };

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
        <h3 className="font-size-16 mb-2">
          <strong>Side by side comparison</strong>
        </h3>
        <h3 className="font-size-12 mb-2 d-flex">
          <div className="mr-2">{sideBySideParams.test_name}</div>
          <div>
            <a
              title=""
              href={beforeJobLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              before
            </a>
            <FontAwesomeIcon className="ml-1 mr-1" icon={faLeftRight} />
            <a
              title=""
              href={afterJobLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              after
            </a>
          </div>
        </h3>
        {jobDetails && (
          <Table>
            <thead>
              <tr>
                <th>Videos 1x</th>
                <th>Videos 0.1x</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div>
                    <img
                      src={jobDetails[0].url}
                      width="100%"
                      alt={jobDetails[0].value}
                    />
                  </div>
                  <div>
                    <a href={jobDetails[0].url}>{jobDetails[0].value}</a>
                  </div>
                </td>
                <td>
                  <div>
                    <img
                      src={jobDetails[2].url}
                      width="100%"
                      alt={jobDetails[2].value}
                    />
                  </div>
                  <div>
                    <a href={jobDetails[2].url}>{jobDetails[2].value}</a>
                  </div>
                </td>
              </tr>
              <tr>
                <td>
                  <div>
                    <img
                      src={jobDetails[4].url}
                      width="100%"
                      alt={jobDetails[4].value}
                    />
                  </div>
                  <div>
                    <a href={jobDetails[4].url}>{jobDetails[4].value}</a>
                  </div>
                </td>
                <td>
                  <div>
                    <img
                      src={jobDetails[6].url}
                      width="100%"
                      alt={jobDetails[6].value}
                    />
                  </div>
                  <div>
                    <a href={jobDetails[6].url}>{jobDetails[6].value}</a>
                  </div>
                </td>
              </tr>
            </tbody>
          </Table>
        )}
        <div className="mb-2 ml-1">
          {Object.keys(sideBySideParams).map((key) =>
            sideBySideParams[key] ? (
              <div key={key}>
                <strong>{key}:</strong> {sideBySideParams[key]}
              </div>
            ) : null,
          )}
        </div>
      </div>
    );
  }
}

SideBySide.propTypes = {
  jobDetails: PropTypes.arrayOf(PropTypes.object),
  // perfJobDetail: PropTypes.arrayOf(PropTypes.object),
  // sideBySideParams: PropTypes.shape({}),
  // revision: PropTypes.string,
  // decisionTaskMap: PropTypes.shape({}).isRequired,
};

SideBySide.defaultProps = {
  jobDetails: [],
  // perfJobDetail: [],
  // sideBySideParams: {},
  // revision: '',
};

const mapStateToProps = (state) => ({
  decisionTaskMap: state.pushes.decisionTaskMap,
});
const mapDispatchToProps = { notify };

export default connect(mapStateToProps, mapDispatchToProps)(SideBySide);
