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
    } = this.props;

    return (
      <Col className={`${widthClass} mb-3`}>
        {revisions.map(revision => (
          <Revision revision={revision} repo={repo} key={revision.revision} />
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
  revisions: PropTypes.array.isRequired,
  revisionCount: PropTypes.number.isRequired,
  repo: PropTypes.object.isRequired,
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
