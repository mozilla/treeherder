import React from 'react';
import PropTypes from 'prop-types';
import { Button, Dropdown } from 'react-bootstrap';

import DropdownMenuItems from '../../../shared/DropdownMenuItems';

export default class SideBySideVideo extends React.Component {
  constructor(props) {
    super(props);
    const { videos } = this.props;
    this.state = {
      activeVideo: videos[0],
      inactiveVideo: videos[1],
      videoToReplay: videos[0],
    };
  }

  onReplayHandler = () => {
    const { activeVideo, inactiveVideo, videoToReplay } = this.state;

    this.setState({ activeVideo: { url: inactiveVideo } }, () =>
      this.setState({
        activeVideo: videoToReplay,
        videoToReplay,
        inactiveVideo: activeVideo,
      }),
    );
  };

  onSetVideoHandler = (value) => {
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
    const { url, value } = activeVideo;
    return (
      <div className="w-100">
        <div className="d-flex mb-1">
          <Dropdown
            className="mr-1 text-nowrap"
            title={value || videos[0].value}
            aria-label={value || videos[0].value}
          >
            <Dropdown.Toggle size="sm">
              {value || videos[0].value}
            </Dropdown.Toggle>
            <DropdownMenuItems
              options={videos.map((item) => item.value)}
              selectedItem={value || videos[0].value}
              updateData={(value) => this.onSetVideoHandler(value, videos)}
            />
          </Dropdown>
          <Button size="sm" onClick={this.onReplayHandler}>
            Reload
          </Button>
        </div>
        <div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open artifact in new tab"
          >
            <img src={url} width="100%" alt={activeVideo.value} />
          </a>
        </div>
      </div>
    );
  }
}

SideBySideVideo.propTypes = {
  videos: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};
