import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser } from '@fortawesome/free-regular-svg-icons';
import { Row, Tooltip } from 'reactstrap';

import { parseAuthor } from '../helpers/revision';

import BugLinkify from './BugLinkify';
import Clipboard from './Clipboard';

export function AuthorInitials(props) {
  const str = props.author || '';
  const words = str.split(' ');
  const firstLetters = words
    .map((word) => word.replace(/[^A-Z]/gi, '')[0])
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
      <span className="ml-1 icon-superscript font-italic font-weight-bold text-secondary user-push-initials">
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
      ready: false,
      tooltipOpen: false,
    };
    this.spanRef = React.createRef();
  }

  componentDidMount() {
    this.setReady();
  }

  componentDidUpdate() {
    this.setReady();
  }

  setReady() {
    if (this.spanRef.current) {
      this.setState({
        ready: true,
      });
    }
  }

  handleTooltip = async () => {
    this.handleTooltipOpen();
  };

  handleTooltipOpen = () => {
    this.setState((prevState) => {
      return {
        tooltipOpen: !prevState.tooltipOpen,
      };
    });
  };

  showClipboard = (show) => {
    this.setState({ clipboardVisible: show });
  };

  isBackout = (comment) => {
    return comment.search('Backed out') >= 0 || comment.search('Back out') >= 0;
  };

  render() {
    const {
      revision: { comments, author, revision },
      repo,
      revisionComments,
    } = this.props;
    const comment = comments.split('\n')[0];
    const bugMatches = comment.match(/-- ([0-9]+)|bug.([0-9]+)/gi);
    const { clipboardVisible, ready, tooltipOpen } = this.state;
    const { name, email } = parseAuthor(author);
    const commitRevision = revision;
    const commentColor = this.isBackout(comment)
      ? 'text-danger'
      : 'text-secondary';
    return (
      <Row
        className="revision flex-nowrap"
        onMouseEnter={() => this.showClipboard(true)}
        onMouseLeave={() => this.showClipboard(false)}
        data-testid="revision"
      >
        <span className="pr-1 text-nowrap">
          <Clipboard
            description="full hash"
            text={commitRevision}
            visible={clipboardVisible}
          />
          <a
            title={`Open revision ${commitRevision} on ${repo.url}`}
            href={repo.getRevisionHref(commitRevision)}
            className="text-monospace commit-sha"
          >
            {commitRevision.substring(0, 12)}
          </a>
        </span>
        <AuthorInitials title={`${name}: ${email}`} author={name} />
        <span
          ref={this.spanRef}
          className={`ml-2 revision-comment overflow-hidden text-nowrap ${commentColor}`}
          id={`revision${revision}`}
        >
          <em>
            <BugLinkify id={revision}>{comment}</BugLinkify>
          </em>
        </span>
        {ready && (
          <Tooltip
            isOpen={tooltipOpen}
            toggle={() => this.handleTooltip(comment)}
            target={`revision${revision}`}
            innerClassName="tooltip-content"
          >
            {bugMatches.map((bug) => {
              const bugId = bug.split(' ')[1];
              return (
                <div key={bugId}>
                  Bug {bugId} - {revisionComments[bugId]}
                </div>
              );
            })}
            <br />
          </Tooltip>
        )}
      </Row>
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
};
