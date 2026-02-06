import React from 'react';
import PropTypes from 'prop-types';
import { Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';

import { tooltipMessages } from '../perf-helpers/constants';

const TagsList = ({ tags }) => {
  if (tags.length > 0) {
    return tags.map((tag) => (
      <OverlayTrigger
        key={tag}
        placement="top"
        overlay={<Tooltip>{tooltipMessages[tag]}</Tooltip>}
      >
        <Badge className="me-2" pill>
          <span data-testid={`performance-tag ${tag}`}>{tag}</span>
        </Badge>
      </OverlayTrigger>
    ));
  }

  return null;
};

TagsList.propTypes = {
  tags: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export default TagsList;
