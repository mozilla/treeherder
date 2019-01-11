import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';

import perf from '../js/perf';

import { getRevisionUrl } from './helpers';

export default class RevisionInformation extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    const {
      originalProject,
      originalRevision,
      newProject,
      newRevision,
      originalResultSet,
      newResultSet,
      selectedTimeRange,
    } = this.props;

    return (
      <ul className="list-inline push-information">
        {originalRevision && (
          <li className="list-inline-item">
            <strong>Base</strong> -&nbsp;
            <a href={getRevisionUrl(originalRevision, originalProject.name)}>
              {originalRevision.substring(0, 12)}
            </a>
            &nbsp;({originalProject.name}) - {originalResultSet.author} -
            <span>{originalResultSet.comments}</span>
          </li>
        )}
        {selectedTimeRange && (
          <li className="list-inline-item">
            <strong>Base</strong> -
            <a href={getRevisionUrl(originalRevision, originalProject.name)}>
              {originalRevision.substring(0, 12)}
            </a>
            &nbsp;({originalProject.name}) - {selectedTimeRange.text}
          </li>
        )}
        <li className="list-inline-item">
          <strong>New</strong> -&nbsp;
          <a href={getRevisionUrl(newRevision, newProject.name)}>
            {newRevision.substring(0, 12)}
          </a>
          &nbsp;({newProject.name}) - {newResultSet.author}
          <span>{newResultSet.comments}</span>
        </li>
      </ul>
    );
  }
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
