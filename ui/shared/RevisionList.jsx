import React from 'react';
import PropTypes from 'prop-types';
import { Col, Row } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkSquareAlt } from '@fortawesome/free-solid-svg-icons';

import { getData } from '../helpers/http';
import { bugzillaBugsApi } from '../helpers/url';

import { Revision } from './Revision';

export class RevisionList extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      revisionComments: {},
    };
  }

  componentDidMount() {
    const { revisions } = this.props;

    revisions.forEach((revision, i) => {
      this.getRevisionComment(revision.comments, i);
    });
  }

  getRevisionComment = async (comments, i) => {
    const comment = comments.split('\n')[0];
    const bugMatches = comment.match(/-- ([0-9]+)|bug.([0-9]+)/gi);
    var bugNumbers = '';
    var bugData = {};
    bugMatches.forEach((bugMatch) => {
      bugNumbers += `${bugMatch.split(' ')[1]},`;
    });
    const { data } = await getData(bugzillaBugsApi('bug', { id: bugNumbers }));
    data.bugs.forEach((curBug) => {
      bugData[curBug.id] = curBug.summary;
    });
    // console.log(bugData);
    this.setState({ revisionComments: bugData });
  };

  render() {
    const {
      revision,
      revisions,
      revisionCount,
      repo,
      widthClass,
      children,
    } = this.props;

    return (
      <Col className={`${widthClass} mb-3`}>
        {revisions.map((revision) => (
          <Revision
            revision={revision}
            repo={repo}
            key={revision.revision}
            revisionComments={this.state.revisionComments}
          />
        ))}
        {revisionCount > revisions.length && (
          <MoreRevisionsLink key="more" href={repo.getPushLogHref(revision)} />
        )}
        {children}
      </Col>
    );
  }
}

RevisionList.propTypes = {
  revision: PropTypes.string.isRequired,
  revisions: PropTypes.arrayOf(PropTypes.object).isRequired,
  revisionCount: PropTypes.number.isRequired,
  repo: PropTypes.shape({
    pushLogUrl: PropTypes.string,
  }).isRequired,
  widthClass: PropTypes.string,
};

RevisionList.defaultProps = {
  widthClass: '',
};

export function MoreRevisionsLink(props) {
  return (
    <Row className="ml-2">
      <a href={props.href} target="_blank" rel="noopener noreferrer">
        {'\u2026and more'}
        <FontAwesomeIcon icon={faExternalLinkSquareAlt} className="ml-1" />
      </a>
    </Row>
  );
}

MoreRevisionsLink.propTypes = {
  href: PropTypes.string.isRequired,
};
