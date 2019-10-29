import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faClipboard } from '@fortawesome/free-regular-svg-icons';

import { parseAuthor } from '../../helpers/revision';
import BugLinkify from '../../shared/BugLinkify';

export function Initials(props) {
  const str = props.author || '';
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
    <span title={props.title}>
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
  static copyToClipboard(text) {
    navigator.clipboard.writeText(text);
  }

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
      <li>
        <span className="revision" data-tags={this.tags}>
          <span className="pl-4 pr-1 revision-holder">
            <span
              role="button"
              tabIndex="-1"
              className="pointer"
              onClick={() => Revision.copyToClipboard(commitRevision)}
            >
              <FontAwesomeIcon icon={faClipboard} title="Copy full hash" />
            </span>
            <a
              title={`Open revision ${commitRevision} on ${repo.url}`}
              href={repo.getRevisionHref(commitRevision)}
              className="text-monospace commit-sha"
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
