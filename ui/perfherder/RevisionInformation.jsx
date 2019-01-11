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

    console.log(`selectedTimeRange: ${JSON.stringify(selectedTimeRange)}`);

    return (
      // <ul className="list-inline push-information">
      //   {originalRevision && (
      //     <li className="list-inline-item">
      //       <strong>Base</strong> -
      //       <a href="{originalRevision}">{originalRevision}</a>
      //       `(${originalProject.name}) - ${originalResultSet.author}` -
      //       <span>{originalResultSet.comments}</span>
      //     </li>
      //   )}
      //   {selectedTimeRange && (
      //     <li className="list-inline-item">
      //       <strong>Base</strong> -
      //       <a href="{originalRevision}">{originalRevision}</a>
      //       `(${originalProject.name}) - ${selectedTimeRange.text}``
      //     </li>
      //   )}
      //   <li className="list-inline-item">
      //     <strong>New</strong> -
      //     <a href="{{newRevision | getRevisionUrl:newProject.name}}">
      //       {newRevision}
      //     </a>
      //     `(${newProject.name}) - ${newResultSet.author}`
      //     <span>{newResultSet.comments}</span>
      //   </li>
      // </ul>
      <ul>
        <li>originalProject: {JSON.stringify(originalProject)}</li>
        <li>originalRevision: {JSON.stringify(originalRevision)}</li>
        <li>originalResultSet: {JSON.stringify(originalResultSet)}</li>
        <li>newProject: {JSON.stringify(newProject)}</li>
        <li>newRevision: {JSON.stringify(newRevision)}</li>
        <li>newResultSet: {JSON.stringify(newResultSet)}</li>
        <li>selectedTimeRange: {JSON.stringify(selectedTimeRange)}</li>
      </ul>
    );
  }
}

RevisionInformation.propTypes = {
  originalProject: PropTypes.object.isRequired,
  originalRevision: PropTypes.string.isRequired,
  newProject: PropTypes.object.isRequired,
  newRevision: PropTypes.string.isRequired,
  originalResultSet: PropTypes.object.isRequired,
  newResultSet: PropTypes.object.isRequired,
  selectedTimeRange: PropTypes.number,
};

RevisionInformation.defaultProps = {
  selectedTimeRange: undefined,
};

perf.component(
  'revisionInformation',
  react2angular(RevisionInformation, [
    'originalProject',
    'originalRevision',
    'newProject',
    'newRevision',
    'originalResultSet',
    'newResultSet',
    'selectedTimeRange',
  ]),
);
