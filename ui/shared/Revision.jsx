import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser } from '@fortawesome/free-regular-svg-icons';
import { Row, Tooltip } from 'reactstrap';
import { parseAuthor } from '../helpers/revision';

import BugLinkify from './BugLinkify';
import Clipboard from './Clipboard';

import { getData } from '../helpers/http';
import { bugzillaBugsApi } from '../helpers/url';

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
      tooltipData: false,
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

  // toggle = (comment) => {
  //   this.setState({
  //     tooltipOpen: !this.state.tooltipOpen,
  //   });
  // };

  toggle = async (comment) => {
    const bugMatches = comment.match(/-- ([0-9]+)|bug.([0-9]+)/gi);
    const bugNumber = bugMatches[0].split(' ')[1];
    const { data, failureStatus } = await getData(
      bugzillaBugsApi('bug', { id: bugNumber }),
    );
    const bugSummary = data.bugs[0].summary;
    this.setState((prevState) => {
      return {
        tooltipOpen: !prevState.tooltipOpen,
        tooltipData: prevState.tooltipData
          ? !prevState.tooltipData
          : bugSummary,
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
    } = this.props;
    const comment = comments.split('\n')[0];
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
          // title={comment}
          className={`ml-2 revision-comment overflow-hidden text-nowrap ${commentColor}`}
          id={'revision' + revision}
        >
          <em>
            <BugLinkify id={revision}>{comment}</BugLinkify>
          </em>
        </span>
        {ready && (
          <Tooltip
            isOpen={tooltipOpen}
            toggle={() => this.toggle(comment)}
            target={'revision' + revision}
          >
            {this.state.tooltipData}
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
