import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser } from '@fortawesome/free-regular-svg-icons';
import { Tooltip } from 'reactstrap';

import { parseAuthor } from '../../helpers/revision';
import BugLinkify from '../../shared/BugLinkify';
import Clipboard from '../../shared/Clipboard';
import { bugzillaBugsApi } from '../../helpers/url';
import { getData } from '../../helpers/http';

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
  constructor(props) {
    super(props);
    const { revision } = this.props;

    this.state = {
      tooltipOpen: this.toggleBugTooltip(),
    };

    // eslint-disable-next-line prefer-destructuring
    this.comment = revision.comments.split('\n')[0];
    this.tags =
      this.comment.search('Backed out') >= 0 ||
      this.comment.search('Back out') >= 0
        ? 'backout'
        : '';

    this.toggleBugTooltip = this.toggleBugTooltip.bind(this);
    this.toggleTooltip = this.toggleTooltip.bind(this);
  }

  toggleBugTooltip = async () => {
    const bugComment = this.comment.split(' ');
    const bugId = bugComment[1];
    const { data, failureStatus } = await getData(
      bugzillaBugsApi('bug', { id: bugId }),
    );
    return { data, failureStatus };
  };

  toggleTooltip = () => {
    const { tooltipOpen } = this.state;
    this.setState({
      tooltipOpen: !tooltipOpen,
    });
  };

  render() {
    const { tooltipOpen } = this.state;
    const { revision, repo } = this.props;
    const { name, email } = parseAuthor(revision.author);
    const commitRevision = revision.revision;

    return (
      <li>
        <span className="revision" data-tags={this.tags}>
          <span className="pl-4 pr-1 revision-holder">
            <Clipboard description="full hash" text={commitRevision} />
            <a
              title={`Open revision ${commitRevision} on ${repo.url}`}
              href={repo.getRevisionHref(commitRevision)}
              className="text-monospace commit-sha"
            >
              {commitRevision.substring(0, 12)}
            </a>
          </span>
          <Initials title={`${name}: ${email}`} author={name} />
          <span>
            <Tooltip
              target="BugCommitMessage"
              isOpen={tooltipOpen}
              toggle={() => this.toggleTooltip()}
            >
              <span className="revision-comment">
                <em>
                  <BugLinkify>{this.comment}</BugLinkify>
                </em>
              </span>
            </Tooltip>
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
