import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser } from '@fortawesome/free-regular-svg-icons';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';

import { parseAuthor } from '../helpers/revision';

import BugLinkify from './BugLinkify';
import Clipboard from './Clipboard';

export function AuthorInitials(props) {
  const str = props.author || '';
  const words = str.split(' ');
  const firstLetters = words
    .map((word) => word.replace(/\P{General_Category=Letter}/gu, '')[0])
    .filter((firstLetter) => typeof firstLetter !== 'undefined');
  let initials = '';

  if (firstLetters.length === 1) {
    // eslint-disable-next-line prefer-destructuring
    initials = firstLetters[0];
  } else if (firstLetters.length > 1) {
    initials = firstLetters[0] + firstLetters[firstLetters.length - 1];
  }

  return (
    <span title={props.title} className="text-nowrap">
      <span className="text-secondary">
        <FontAwesomeIcon icon={faUser} />
      </span>
      <span className="ms-1 icon-superscript font-italic font-weight-bold text-secondary user-push-initials">
        {initials}
      </span>
    </span>
  );
}

AuthorInitials.propTypes = {
  author: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
};

export class Revision extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      clipboardVisible: false,
    };
  }

  showClipboard = (show) => {
    this.setState({ clipboardVisible: show });
  };

  isBackout = (comment) => {
    // 'Revert' commits directly after migration to Git VCS when no `hg oops` equivalent available.
    return (
      comment.search('Backed out') >= 0 ||
      comment.search('Back out') >= 0 ||
      comment.startsWith('Revert')
    );
  };

  render() {
    const {
      revision: { comments, author, revision },
      repo,
      bugSummaryMap,
      commitShaClass,
      commentFont,
    } = this.props;
    const comment = comments.split('\n')[0];
    const bugMatches = comment.match(/-- ([0-9]+)|bug.([0-9]+)/gi);
    const { clipboardVisible } = this.state;
    const { name, email } = parseAuthor(author);
    const commitRevision = revision;
    const commentColor = this.isBackout(comment)
      ? 'text-danger'
      : 'text-secondary';

    return (
      <div className="revision d-flex flex-nowrap" data-testid="revision">
        <span
          onMouseEnter={() => this.showClipboard(true)}
          onMouseLeave={() => this.showClipboard(false)}
          className="pe-1 text-nowrap"
        >
          <Clipboard
            description="full hash"
            text={commitRevision}
            visible={clipboardVisible}
          />
          <a
            title={`Open revision ${commitRevision} on ${repo.url}`}
            href={repo.getRevisionHref(commitRevision)}
            className={commitShaClass}
          >
            {commitRevision.substring(0, 12)}
          </a>
        </span>
        <AuthorInitials title={`${name}: ${email}`} author={name} />
        <OverlayTrigger
          placement="auto"
          overlay={
            <Tooltip className="tooltip-content">
              {bugSummaryMap &&
                !!bugMatches &&
                bugMatches.map((bug) => {
                  const bugId = bug.split(' ')[1];
                  return (
                    <div key={bugId} className="mb-3">
                      Bug {bugId} - {bugSummaryMap[bugId]}
                    </div>
                  );
                })}
              <div>Commit:</div>
              <span>{comment}</span>
            </Tooltip>
          }
        >
          <span
            data-testid={comment}
            className={`ms-2 revision-comment overflow-hidden text-truncate ${commentColor} ${commentFont}`}
          >
            <span className="text-wrap">
              <BugLinkify id={revision}>{comment}</BugLinkify>
            </span>
          </span>
        </OverlayTrigger>
      </div>
    );
  }
}

Revision.propTypes = {
  revision: PropTypes.shape({
    comments: PropTypes.string.isRequired,
    author: PropTypes.string.isRequired,
    revision: PropTypes.string.isRequired,
  }).isRequired,
  repo: PropTypes.shape({
    url: PropTypes.string,
    revisionHrefPrefix: PropTypes.string,
  }).isRequired,
  commitShaClass: PropTypes.string,
  commentFont: PropTypes.string,
};

Revision.defaultProps = {
  commitShaClass: 'commit-sha',
  commentFont: '',
};
