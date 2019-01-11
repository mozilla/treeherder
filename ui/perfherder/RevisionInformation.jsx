import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';

import perf from '../js/perf';

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
      <div>
        <ul className="list-inline push-information">
          {originalRevision && (
            <li className="list-inline-item">
              <strong>Base</strong> -&nbsp;
              <a href="{originalRevision}">{originalRevision}</a>
              &nbsp;({originalProject.name}) - {originalResultSet.author} -
              <span>{originalResultSet.comments}</span>
            </li>
          )}
          {selectedTimeRange && (
            <li className="list-inline-item">
              <strong>Base</strong> -
              <a href="{originalRevision}">{originalRevision}</a>
              &nbsp;({originalProject.name}) - {selectedTimeRange.text}
            </li>
          )}
          <li className="list-inline-item">
            <strong>New</strong> -&nbsp;
            <a href="{{newRevision | getRevisionUrl:newProject.name}}">
              {newRevision}
            </a>
            &nbsp;({newProject.name}) - {newResultSet.author}
            <span>{newResultSet.comments}</span>
          </li>
        </ul>
        <ul>
          <li>originalProject: {JSON.stringify(originalProject)}</li>
          <li>originalRevision: {JSON.stringify(originalRevision)}</li>
          <li>originalResultSet: {JSON.stringify(originalResultSet)}</li>
          <li>newProject: {JSON.stringify(newProject)}</li>
          <li>newRevision: {JSON.stringify(newRevision)}</li>
          <li>newResultSet: {JSON.stringify(newResultSet)}</li>
          <li>selectedTimeRange: {JSON.stringify(selectedTimeRange)}</li>
        </ul>
      </div>
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
