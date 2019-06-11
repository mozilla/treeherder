import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';
import { Container } from 'reactstrap';

import perf from '../../js/perf';

import TestCard from './TestCard';

const SelectedTestsContainer = props => {
  // TODO seriesList is the same as testsDisplayed in TestDataModel - change
  // name to keep it consistent
  const { seriesList } = props;
  return (
    <Container className="graph-legend pl-0 pb-4">
      {seriesList.length > 0 &&
        seriesList.map(series => (
          <div key={series.id}>
            <TestCard series={series} {...props} />
          </div>
        ))}
    </Container>
  );
};

SelectedTestsContainer.propTypes = {
  seriesList: PropTypes.arrayOf(PropTypes.shape({})),
};

SelectedTestsContainer.defaultProps = {
  seriesList: undefined,
};

perf.component(
  'selectedTestsContainer',
  react2angular(
    SelectedTestsContainer,
    ['seriesList', 'addTestData', 'removeSeries', 'showHideSeries'],
    ['$stateParams', '$state'],
  ),
);

export default SelectedTestsContainer;
