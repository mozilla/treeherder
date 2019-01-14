import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';

import perf from '../js/perf';

import { getRevisionUrl } from './helpers';

function specificRevisionDetails(
  revision,
  project,
  isBaseline,
  resultSet,
  selectedTimeRange = null,
) {
  let baselineOrNew = isBaseline ? 'Base' : 'New';
  if (selectedTimeRange) baselineOrNew = 'Base';

  return (
    <React.Fragment>
      <strong>{baselineOrNew}</strong> -&nbsp;
      <a href={getRevisionUrl(revision, project.name)}>
        {revision.substring(0, 12)}
      </a>
      &nbsp;({project.name}) - {resultSet ? resultSet.author : selectedTimeRange.text} -&nbsp;
      {resultSet ? <span>{resultSet.comments}</span> : ''}
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
    <ul className="list-inline push-information">
      {originalRevision && (
        <li className="list-inline-item">
          {specificRevisionDetails(
            originalRevision,
            originalProject,
            true,
            originalResultSet,
          )}
        </li>
      )}
      {selectedTimeRange && (
        <li className="list-inline-item">
          {specificRevisionDetails(
            originalRevision,
            originalProject,
            true,
            null,
            selectedTimeRange,
          )}
        </li>
      )}
      <li className="list-inline-item">
        {specificRevisionDetails(newRevision, newProject, false, newResultSet)}
      </li>
    </ul>
  );
}

RevisionInformation.propTypes = {
  originalProject: PropTypes.object,
  originalRevision: PropTypes.string.isRequired,
  newProject: PropTypes.object,
  newRevision: PropTypes.string.isRequired,
  originalResultSet: PropTypes.object,
  newResultSet: PropTypes.object,
  selectedTimeRange: PropTypes.number,
};

RevisionInformation.defaultProps = {
  originalProject: {},
  newProject: {},
  originalResultSet: {},
  newResultSet: {},
  selectedTimeRange: undefined,
};

perf.component('revisionInformation', react2angular(RevisionInformation));
