import PropTypes from 'prop-types';
import React from 'react';

export default function Author(props) {
  const authorMatch = props.author.match(/<(.*?)>+/);
  const authorEmail = authorMatch ? authorMatch[1] : props.author;

  return (
    <span title="View pushes by this user" className="push-author">
      <a href={props.url}>{authorEmail}</a>
    </span>
  );
}

Author.propTypes = {
  author: PropTypes.string.isRequired,
  url: PropTypes.string.isRequired,
};
