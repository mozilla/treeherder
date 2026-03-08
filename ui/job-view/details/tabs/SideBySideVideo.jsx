import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Button, Dropdown } from 'react-bootstrap';

import DropdownMenuItems from '../../../shared/DropdownMenuItems';

function SideBySideVideo({ videos }) {
  const [activeVideo, setActiveVideo] = useState(videos[0]);
  const [inactiveVideo, setInactiveVideo] = useState(videos[1]);
  const [videoToReplay, setVideoToReplay] = useState(videos[0]);

  const onReplayHandler = useCallback(() => {
    setActiveVideo({ url: inactiveVideo });
    // Use a microtask to ensure the state update above triggers a re-render
    // before setting the real active video (forces video element to reload)
    setTimeout(() => {
      setActiveVideo(videoToReplay);
      setVideoToReplay(videoToReplay);
      setInactiveVideo(activeVideo);
    }, 0);
  }, [activeVideo, inactiveVideo, videoToReplay]);

  const onSetVideoHandler = useCallback((value) => {
    const selected = videos.find((item) => item.value === value);
    setActiveVideo(selected);
    setVideoToReplay(selected);
  }, [videos]);

  const { url, value } = activeVideo;

  return (
    <div className="w-100">
      <div className="d-flex mb-1">
        <Dropdown
          className="me-1 text-nowrap"
          title={value || videos[0].value}
          aria-label={value || videos[0].value}
        >
          <Dropdown.Toggle size="sm">
            {value || videos[0].value}
          </Dropdown.Toggle>
          <DropdownMenuItems
            options={videos.map((item) => item.value)}
            selectedItem={value || videos[0].value}
            updateData={(val) => onSetVideoHandler(val)}
          />
        </Dropdown>
        <Button size="sm" onClick={onReplayHandler}>
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

SideBySideVideo.propTypes = {
  videos: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

export default SideBySideVideo;
