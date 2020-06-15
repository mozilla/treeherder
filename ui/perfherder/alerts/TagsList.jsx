import React from 'react';
import PropTypes from 'prop-types';
import { Badge } from 'reactstrap';

const TagsList = ({ tags }) => {
  if (tags.length > 0) {
    return tags.map((tag) => (
      <Badge key={tag} className="mr-2" pill>
        <span data-testid={`performance-tag ${tag}`}>{tag}</span>
      </Badge>
    ));
  }

  return null;
};

TagsList.propTypes = {
  tags: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export default TagsList;
