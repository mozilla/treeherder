import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser } from '@fortawesome/free-regular-svg-icons';

import { parseAuthor } from '../../helpers/revision';
import BugLinkify from '../../shared/BugLinkify';

export function Initials(props) {
  const { author, title } = props;
  const str = author || '';
  const words = str.split(' ');
  const firstLetters = words
    .map(word => word.replace(/[^A-Z]/gi, '')[0])
    .filter(firstLetter => typeof firstLetter !== 'undefined');
  let initials = '';

  if (firstLetters.length === 1) {
    // eslint-disable-next-line prefer-destructuring
    initials = firstLetters[0];
  } else if (firstLetters.length > 1) {
    initials = firstLetters[0] + firstLetters[firstLetters.length - 1];
  }

  return (
    <span title={title}>
      <span className="user-push-icon">
        <FontAwesomeIcon icon={faUser} />
      </span>
      <div className="icon-superscript user-push-initials">{initials}</div>
    </span>
  );
}

Initials.propTypes = {
  author: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
};

export class Revision extends React.PureComponent {
  constructor(props) {
    super(props);
    const { revision } = this.props;

    // eslint-disable-next-line prefer-destructuring
    this.comment = revision.comments.split('\n')[0];
    this.tags =
      this.comment.search('Backed out') >= 0 ||
      this.comment.search('Back out') >= 0
        ? 'backout'
        : '';
  }

  render() {
    const { revision, repo } = this.props;
    const { name, email } = parseAuthor(revision.author);
    const commitRevision = revision.revision;

    return (
      <li className="clearfix">
        <span className="revision" data-tags={this.tags}>
          <span className="revision-holder">
            <a
              title={`Open revision ${commitRevision} on ${repo.url}`}
              href={repo.getRevisionHref(commitRevision)}
            >
              {commitRevision.substring(0, 12)}
            </a>
          </span>
          <Initials title={`${name}: ${email}`} author={name} />
          <span title={this.comment}>
            <span className="revision-comment">
              <em>
                <BugLinkify>{this.comment}</BugLinkify>
              </em>
            </span>
          </span>
        </span>
      </li>
    );
  }
}

Revision.propTypes = {
  revision: PropTypes.object.isRequired,
  repo: PropTypes.object.isRequired,
};
