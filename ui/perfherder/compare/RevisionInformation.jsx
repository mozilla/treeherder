import React from 'react';
import PropTypes from 'prop-types';
import { ListGroup, ListGroupItem } from 'reactstrap';

import { getJobsUrl } from '../../helpers/url';

function getRevisionComments(resultSet) {
  const [firstRevisionComment, ...restRevisionsComments] =
    resultSet && Array.isArray(resultSet.revisions)
      ? resultSet.revisions.map(r => r.comments)
      : [];
  const revisionCommentsTitle = restRevisionsComments.join('\n');

  return firstRevisionComment ? (
    <ul className="push-information-revisions">
      <li>{firstRevisionComment}</li>
      {revisionCommentsTitle && <li title={revisionCommentsTitle}>…</li>}
    </ul>
  ) : null;
}

function getRevisionSpecificDetails(
  revision,
  project,
  isBaseline,
  resultSet,
  selectedTimeRange = undefined,
) {
  const truncatedRevision = revision ? revision.substring(0, 12) : '';
  const baselineOrNew = isBaseline || selectedTimeRange ? 'Base' : 'New';

  return (
    <React.Fragment>
      <strong>{baselineOrNew}</strong> -&nbsp;
      {revision ? (
        <a href={getJobsUrl({ repo: project, revision })}>
          {truncatedRevision}
        </a>
      ) : (
        truncatedRevision
      )}
      &nbsp;({project}) -&nbsp;
      {resultSet && resultSet.author}
      {!resultSet && selectedTimeRange && selectedTimeRange.text}
      {getRevisionComments(resultSet)}
    </React.Fragment>
  );
}

export default function RevisionInformation(props) {
  const {
    originalProject,
    originalRevision,
    newProject,
    newRevision,
    originalResultSet,
    newResultSet,
    selectedTimeRange,
  } = props;

  return (
    <ListGroup className="push-information m-0 list-group">
      {originalRevision && (
        <ListGroupItem className="d-inline border-0 p-0">
          {getRevisionSpecificDetails(
            originalRevision,
            originalProject,
            true,
            originalResultSet,
          )}
        </ListGroupItem>
      )}
      {selectedTimeRange && (
        <ListGroupItem className="d-inline border-0 p-0">
          {getRevisionSpecificDetails(
            originalRevision,
            originalProject,
            true,
            null,
            selectedTimeRange,
          )}
        </ListGroupItem>
      )}
      —
      {newRevision && (
        <ListGroupItem className="d-inline border-0 p-0">
          {getRevisionSpecificDetails(
            newRevision,
            newProject,
            false,
            newResultSet,
          )}
        </ListGroupItem>
      )}
    </ListGroup>
  );
}

RevisionInformation.propTypes = {
  originalProject: PropTypes.string,
  originalRevision: PropTypes.string,
  newProject: PropTypes.string,
  newRevision: PropTypes.string,
  originalResultSet: PropTypes.shape({}),
  newResultSet: PropTypes.shape({}),
  selectedTimeRange: PropTypes.shape({}),
};

RevisionInformation.defaultProps = {
  originalProject: '',
  originalRevision: '',
  originalResultSet: {},
  newProject: '',
  newRevision: '',
  newResultSet: {},
  selectedTimeRange: undefined,
};
