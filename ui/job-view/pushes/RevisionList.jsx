import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkSquareAlt } from '@fortawesome/free-solid-svg-icons';

import { Revision } from './Revision';

export class RevisionList extends React.PureComponent {
  constructor(props) {
    super(props);
    this.hasMore = props.push.revision_count > props.push.revisions.length;
  }

  render() {
    const { push, repo } = this.props;

    return (
      <span className="revision-list col-5">
        <ul className="list-unstyled">
          {push.revisions.map(revision => (
            <Revision revision={revision} repo={repo} key={revision.revision} />
          ))}
          {this.hasMore && (
            <MoreRevisionsLink
              key="more"
              href={repo.getPushLogHref(push.revision)}
            />
          )}
        </ul>
      </span>
    );
  }
}

RevisionList.propTypes = {
  push: PropTypes.object.isRequired,
  repo: PropTypes.object.isRequired,
};

export function MoreRevisionsLink(props) {
  const { href } = props;
  return (
    <li>
      <a href={href} target="_blank" rel="noopener noreferrer">
        {'\u2026and more'}
        <FontAwesomeIcon icon={faExternalLinkSquareAlt} className="ml-1" />
      </a>
    </li>
  );
}

MoreRevisionsLink.propTypes = {
  href: PropTypes.string.isRequired,
};
