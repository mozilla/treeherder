import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser } from '@fortawesome/free-regular-svg-icons';
import { faPhabricator } from '@fortawesome/free-brands-svg-icons';
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
      commitShaClass = 'commit-sha',
      commentFont = '',
      hideCommitSha = false,
      isGitRevision = false,
    } = this.props;
    const comment = comments.split('\n')[0];
    const bugMatches = comment.match(/-- ([0-9]+)|bug.([0-9]+)/gi);
    // Only commits that were submitted to Phabricator carry this trailer.
    const phabricatorMatch = comments.match(
      /^Differential Revision: (\S+\/(D[0-9]+))\s*$/m,
    );
    const { clipboardVisible } = this.state;
    const { name, email } = parseAuthor(author);
    const commentColor = this.isBackout(comment)
      ? 'text-danger'
      : 'text-secondary';

    return (
      <div className="revision d-flex flex-nowrap" data-testid="revision">
        {!hideCommitSha && (
          <span
            onMouseEnter={() => this.showClipboard(true)}
            onMouseLeave={() => this.showClipboard(false)}
            className="pe-1 text-nowrap"
          >
            <Clipboard
              description="full hash"
              text={revision}
              visible={clipboardVisible}
            />
            <a
              title={`Open revision ${revision} on ${repo.getRevisionBaseUrl(isGitRevision)}`}
              href={repo.getRevisionHref(revision, isGitRevision)}
              className={commitShaClass}
            >
              {revision.substring(0, 12)}
            </a>
          </span>
        )}
        <AuthorInitials title={`${name}: ${email}`} author={name} />
        {phabricatorMatch && (
          <a
            className="ms-2"
            title={`Open ${phabricatorMatch[2]} on Phabricator`}
            href={phabricatorMatch[1]}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FontAwesomeIcon icon={faPhabricator} />
          </a>
        )}
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
  // Lando pushes have no commit hash to show or link to yet.
  hideCommitSha: PropTypes.bool,
  isGitRevision: PropTypes.bool,
};
