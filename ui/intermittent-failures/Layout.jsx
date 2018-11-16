import React from 'react';
import { Container } from 'reactstrap';
import PropTypes from 'prop-types';
import Icon from 'react-fontawesome';

import ErrorBoundary from '../shared/ErrorBoundary';

import Navigation from './Navigation';
import GraphsContainer from './GraphsContainer';
import ErrorMessages from './ErrorMessages';
import { prettyErrorMessages, errorMessageClass } from './constants';

const Layout = (props) => {

  const { graphData, tableData, errorMessages, tree, isFetchingTable,
    isFetchingGraphs, tableFailureStatus, graphFailureStatus, updateState,
    graphOneData, graphTwoData, table, datePicker, header } = props;

    let failureMessage = null;
    if (tableFailureStatus) {
      failureMessage = tableData;
    } else if (graphFailureStatus) {
      failureMessage = graphData;
    }
  return (
    <Container fluid style={{ marginBottom: '5rem', marginTop: '5rem', maxWidth: '1200px' }}>
      <Navigation
        updateState={updateState}
        tree={tree}
      />
      {(isFetchingGraphs || isFetchingTable) &&
        !(tableFailureStatus || graphFailureStatus || errorMessages.length > 0) &&
        <div className="loading">
          <Icon spin name="cog" size="4x" />
        </div>}
      {(tableFailureStatus || graphFailureStatus || errorMessages.length > 0) &&
        <ErrorMessages
          failureMessage={failureMessage}
          failureStatus={tableFailureStatus || graphFailureStatus}
          errorMessages={errorMessages}
        />}
      {header}
      <ErrorBoundary
        errorClasses={errorMessageClass}
        message={prettyErrorMessages.default}
      >
        {graphOneData && graphTwoData &&
        <GraphsContainer
          graphOneData={graphOneData}
          graphTwoData={graphTwoData}
        >
          {datePicker}
        </GraphsContainer>}
      </ErrorBoundary>

      <ErrorBoundary
        errorClasses={errorMessageClass}
        message={prettyErrorMessages.default}
      >
        {table}
      </ErrorBoundary>
    </Container>);
};

Container.propTypes = {
  fluid: PropTypes.bool,
};

Layout.propTypes = {
  history: PropTypes.shape({}).isRequired,
  location: PropTypes.shape({
    search: PropTypes.string,
  }).isRequired,
  datePicker: PropTypes.oneOfType([
    PropTypes.shape({}), PropTypes.bool,
  ]),
  header: PropTypes.oneOfType([
    PropTypes.shape({}), PropTypes.bool,
  ]),
  table: PropTypes.oneOfType([
    PropTypes.shape({}), PropTypes.bool,
  ]),
  graphOneData: PropTypes.arrayOf(
    PropTypes.shape({}),
  ),
  graphTwoData: PropTypes.arrayOf(
    PropTypes.arrayOf(
      PropTypes.shape({}),
    ), PropTypes.arrayOf(
      PropTypes.shape({}),
    ),
  ),
  tableData: PropTypes.arrayOf(
    PropTypes.shape({}),
  ),
  graphData: PropTypes.oneOfType([
    PropTypes.arrayOf(
      PropTypes.shape({}),
    ),
    PropTypes.shape({}),
  ]),
  tree: PropTypes.string,
  errorMessages: PropTypes.arrayOf(PropTypes.string).isRequired,
  updateState: PropTypes.func.isRequired,
  tableFailureStatus: PropTypes.number,
  graphFailureStatus: PropTypes.number,
  isFetchingTable: PropTypes.bool,
  isFetchingGraphs: PropTypes.bool,
};

Layout.defaultProps = {
  graphOneData: null,
  graphTwoData: null,
  dateOptions: null,
  tableFailureStatus: null,
  graphFailureStatus: null,
  isFetchingTable: null,
  isFetchingGraphs: null,
  tableData: null,
  graphData: null,
  tree: null,
  table: null,
  header: null,
  datePicker: null,
};

export default Layout;
