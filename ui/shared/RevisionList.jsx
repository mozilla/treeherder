import React from 'react';
import PropTypes from 'prop-types';
import { Col, Row } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkSquareAlt } from '@fortawesome/free-solid-svg-icons';

import { Revision } from './Revision';

export class RevisionList extends React.PureComponent {
  render() {
    const {
      revision,
      revisions,
      revisionCount,
      repo,
      widthClass,
      children,
      bugSummaryMap,
      commitShaClass,
      commentFont,
    } = this.props;

    return (
      <Col className={widthClass}>
        {revisions.map((revision) => (
          <Revision
            revision={revision}
            repo={repo}
            key={revision.revision}
            bugSummaryMap={bugSummaryMap}
            commitShaClass={commitShaClass}
            commentFont={commentFont}
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
  revisions: PropTypes.arrayOf(
    PropTypes.shape({
      author: PropTypes.string.isRequired,
      comments: PropTypes.string.isRequired,
      repository_id: PropTypes.number.isRequired,
      result_set_id: PropTypes.number.isRequired,
      revision: PropTypes.string.isRequired,
    }),
  ).isRequired,
  revisionCount: PropTypes.number.isRequired,
  repo: PropTypes.shape({
    pushLogUrl: PropTypes.string,
  }).isRequired,
  widthClass: PropTypes.string,
  commitShaClass: PropTypes.string,
  commentFont: PropTypes.string,
};

RevisionList.defaultProps = {
  widthClass: '',
  commitShaClass: '',
  commentFont: '',
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
