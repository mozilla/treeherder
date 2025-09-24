import React from 'react';
import PropTypes from 'prop-types';
import { Badge, UncontrolledTooltip } from 'reactstrap';

import { tooltipMessages } from '../perf-helpers/constants';

const TagsList = ({ tags }) => {
  if (tags.length > 0) {
    return tags.map((tag) => (
      <Badge key={tag} className="mr-2" pill>
        <span data-testid={`performance-tag ${tag}`} id={`${tag}-perf-tag`}>
          {tag}
        </span>
        <UncontrolledTooltip placement="top" target={`${tag}-perf-tag`}>
          {tooltipMessages[tag]}
        </UncontrolledTooltip>
      </Badge>
    ));
  }

  return null;
};

TagsList.propTypes = {
  tags: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export default TagsList;
