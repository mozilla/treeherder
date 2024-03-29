import React from 'react';
import { Container } from 'reactstrap';
import PropTypes from 'prop-types';

import ErrorBoundary from '../shared/ErrorBoundary';
import ErrorMessages from '../shared/ErrorMessages';
import { genericErrorMessage, errorMessageClass } from '../helpers/constants';
import LoadingSpinner from '../shared/LoadingSpinner';

import Navigation from './Navigation';
import GraphsContainer from './GraphsContainer';

const Layout = (props) => {
  const {
    graphData,
    tableData,
    errorMessages,
    tree,
    isFetchingTable,
    isFetchingGraphs,
    tableFailureStatus,
    graphFailureStatus,
    updateState,
    updateHash,
    graphOneData,
    graphTwoData,
    failurehash,
    table,
    datePicker,
    header,
  } = props;

  let failureMessage = null;
  if (tableFailureStatus) {
    failureMessage = tableData;
  } else if (graphFailureStatus) {
    failureMessage = graphData;
  }
  return (
    <Container fluid className="my-5 max-width-default">
      <Navigation
        updateState={updateState}
        updateHash={updateHash}
        tree={tree}
        {...props}
      />
      {(isFetchingGraphs || isFetchingTable) &&
        !(
          tableFailureStatus ||
          graphFailureStatus ||
          errorMessages.length > 0
        ) && <LoadingSpinner />}
      {(tableFailureStatus ||
        graphFailureStatus ||
        errorMessages.length > 0) && (
        <ErrorMessages
          failureMessage={failureMessage}
          errorMessages={errorMessages}
        />
      )}
      {header}
      <ErrorBoundary
        errorClasses={errorMessageClass}
        message={genericErrorMessage}
      >
        {graphOneData && graphTwoData && (
          <GraphsContainer
            graphOneData={graphOneData}
            graphTwoData={graphTwoData}
            failurehash={failurehash}
          >
            {datePicker}
          </GraphsContainer>
        )}
      </ErrorBoundary>

      <ErrorBoundary
        errorClasses={errorMessageClass}
        message={genericErrorMessage}
      >
        {table}
      </ErrorBoundary>
    </Container>
  );
};

Container.propTypes = {
  fluid: PropTypes.bool,
};

Layout.propTypes = {
  history: PropTypes.shape({}).isRequired,
  location: PropTypes.shape({
    search: PropTypes.string,
  }).isRequired,
  datePicker: PropTypes.element.isRequired,
  header: PropTypes.oneOfType([PropTypes.shape({}), PropTypes.bool]),
  table: PropTypes.oneOfType([PropTypes.shape({}), PropTypes.bool]),
  graphTwoData: PropTypes.arrayOf(PropTypes.shape({})),
  failurehash: PropTypes.string,
  tableData: PropTypes.arrayOf(PropTypes.shape({})),
  graphData: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.shape({})),
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
  graphTwoData: null,
  tableFailureStatus: null,
  graphFailureStatus: null,
  isFetchingTable: null,
  isFetchingGraphs: null,
  tableData: null,
  graphData: null,
  failurehash: 'all',
  tree: null,
  table: null,
  header: null,
};

export default Layout;
