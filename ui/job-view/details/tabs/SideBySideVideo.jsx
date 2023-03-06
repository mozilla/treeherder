import React from 'react';
import PropTypes from 'prop-types';
import { Button, DropdownToggle, UncontrolledDropdown } from 'reactstrap';

import DropdownMenuItems from '../../../shared/DropdownMenuItems';

export default class SideBySideVideo extends React.Component {
  constructor(props) {
    super(props);
    const { videos } = this.props;
    this.state = {
      activeVideo: videos[0],
      videoToReplay: videos[0],
    };
  }

  onReplayHandler = () => {
    const { videoToReplay } = this.state;

    this.setState({ activeVideo: { url: '' } }, () =>
      this.setState({ activeVideo: videoToReplay }),
    );
  };

  onSetVideo = (value) => {
    const { videos } = this.props;
    const activeVideo = videos.find((item) => item.value === value);
    this.setState({
      activeVideo,
      videoToReplay: activeVideo,
    });
  };

  render() {
    const { videos } = this.props;
    const { activeVideo } = this.state;
    return (
      <div className="w-100">
        <div className="d-flex mb-1">
          <UncontrolledDropdown
            className="mr-1 text-nowrap"
            title={activeVideo.value || videos[0].value}
            aria-label={activeVideo.value || videos[0].value}
          >
            <DropdownToggle size="sm" caret outline>
              {activeVideo.value || videos[0].value}
            </DropdownToggle>
            <DropdownMenuItems
              options={videos.map((item) => item.value)}
              selectedItem={activeVideo.value || videos[0].value}
              updateData={(value) => this.onSetVideo(value, videos)}
            />
          </UncontrolledDropdown>
          <Button size="sm" onClick={this.onReplayHandler}>
            Reload
          </Button>
          <a href={activeVideo.url} className="m-1">
            {activeVideo.value}
          </a>
        </div>
        <div>
          <img src={activeVideo.url} width="100%" alt={activeVideo.value} />
        </div>
      </div>
    );
  }
}

SideBySideVideo.propTypes = {
  videos: PropTypes.arrayOf(PropTypes.object).isRequired,
};
