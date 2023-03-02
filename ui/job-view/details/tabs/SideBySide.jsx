import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import {DropdownToggle, Table, UncontrolledDropdown} from 'reactstrap';

import { getJobsUrl } from '../../../helpers/url';
import { notify } from '../../redux/stores/notifications';
import { getData } from '../../../helpers/http';
import Clipboard from '../../../shared/Clipboard';
import SideBySideVideo from "./SideBySideVideo";
import DropdownMenuItems from "../../../shared/DropdownMenuItems";

class SideBySide extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      sideBySideLoading: false,
      sideBySideParams: undefined,
      coldVideoUrl: '',
      coldVideoValue: '',
      warmVideoUrl: '',
      warmVideoValue: '',
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
          <span> on platform </span>
          <code>{sideBySideParams.platform}</code>
        </h3>
        <h3 className="font-size-12 mb-2 d-flex flex-column">
          <div className="d-flex">
            <div className="pt-1">
              <strong>Before: </strong>
              {sideBySideParams.base_branch}
              <span> /</span>
              <a
                title={`Open revision ${sideBySideParams.base_revision} on ${sideBySideParams.base_branch}`}
                href={beforeJobLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-monospace ml-1"
              >
                {sideBySideParams.base_revision.substring(0, 12)}
              </a>
            </div>
            <Clipboard
              description="full hash"
              text={sideBySideParams.base_revision}
            />
            <div className="pt-1 ml-1">
              <strong>After: </strong>
              {sideBySideParams.new_branch}
              <span> /</span>
              <a
                title={`Open revision ${sideBySideParams.new_revision} on ${sideBySideParams.new_branch}`}
                href={afterJobLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-monospace ml-1"
              >
                {sideBySideParams.new_revision.substring(0, 12)}
              </a>
            </div>
            <Clipboard
              description="full hash"
              text={sideBySideParams.new_revision}
            />
          </div>
        </h3>
        {jobDetails && (
          <React.Fragment>
            <Table>
              <tbody>
                <tr>
                  <td>
                    Select video
                    <UncontrolledDropdown
                      className="mr-0 text-nowrap"
                      title={this.state.coldVideoValue || videos.cold[0].value}
                      aria-label={
                        this.state.coldVideoValue || videos.cold[0].value
                      }
                    >
                      <DropdownToggle caret outline>
                        {this.state.coldVideoValue || videos.cold[0].value}
                      </DropdownToggle>
                      <DropdownMenuItems
                        options={videos.cold.map((item) => item.value)}
                        selectedItem={
                          this.state.coldVideoValue || videos.cold[0].value
                        }
                        updateData={(value) =>
                          this.setState({
                            coldVideoValue: value,
                            coldVideoUrl: videos.cold.find(
                              (item) => item.value === value,
                            ).url,
                          })
                        }
                      />
                    </UncontrolledDropdown>
                    <SideBySideVideo
                      url={this.state.coldVideoUrl || videos.cold[0].url}
                      value={this.state.coldVideoValue || videos.cold[0].value}
                    />
                  </td>
                  <td>
                    Select video
                    <UncontrolledDropdown
                      className="mr-0 text-nowrap"
                      title={this.state.warmVideoValue || videos.warm[0].value}
                      aria-label={
                        this.state.warmVideoValue || videos.warm[0].value
                      }
                    >
                      <DropdownToggle caret outline>
                        {this.state.warmVideoValue || videos.warm[0].value}
                      </DropdownToggle>
                      <DropdownMenuItems
                        options={videos.warm.map((item) => item.value)}
                        selectedItem={
                          this.state.warmVideoValue || videos.warm[0].value
                        }
                        updateData={(value) =>
                          this.setState({
                            warmVideoValue: value,
                            warmVideoUrl: videos.warm.find(
                              (item) => item.value === value,
                            ).url,
                          })
                        }
                      />
                    </UncontrolledDropdown>
                    <SideBySideVideo
                      url={this.state.warmVideoUrl || videos.warm[0].url}
                      value={this.state.warmVideoValue || videos.warm[0].value}
                    />
                  </td>
                </tr>
              </tbody>
            </Table>
          </React.Fragment>
        )}
      </div>
    );
  }
}

SideBySide.propTypes = {
  jobDetails: PropTypes.arrayOf(PropTypes.object),
};

SideBySide.defaultProps = {
  jobDetails: [],
};

const mapStateToProps = (state) => ({
  decisionTaskMap: state.pushes.decisionTaskMap,
});
const mapDispatchToProps = { notify };

export default connect(mapStateToProps, mapDispatchToProps)(SideBySide);
