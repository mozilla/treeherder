import React from 'react';
import PropTypes from 'prop-types';
import { Container } from 'reactstrap';
import ReactTable from 'react-table';

import { noResultsMessage } from '../constants';

import ItemList from './ItemList';

export default function TestsTable(props) {
  const { results, projectsMap, platformsMap, defaultPageSize } = props;

  const showPagination = results.length > defaultPageSize;
  const headerStyle = {
    background: 'lightgray',
    fontWeight: 'bold',
    paddingTop: 10,
    paddingBottom: 10,
  };

  const columns = [
    {
      headerStyle,
      Header: 'Suite',
      accessor: 'suite',
    },
    {
      headerStyle,
      Header: 'Test Name',
      accessor: 'test',
    },
    {
      headerStyle,
      Header: 'Platforms',
      accessor: 'platforms',
      Cell: props => {
        if (platformsMap) {
          const platforms = props.value.map(id => platformsMap[id]);
          return <ItemList items={platforms} color="info" />;
        }
        return null;
      },
      width: 300,
      style: { textAlign: 'center' },
      sortable: false,
    },
    {
      headerStyle,
      Header: 'Projects',
      accessor: 'repositories',
      Cell: props => {
        if (projectsMap) {
          const repositories = props.value.map(id => projectsMap[id]);
          return <ItemList items={repositories} />;
        }
        return null;
      },
      width: 300,
      style: { textAlign: 'center' },
      sortable: false,
    },
    {
      headerStyle,
      Header: 'Total Alerts',
      accessor: 'total_alerts',
      width: 100,
      style: { textAlign: 'center' },
    },
  ];

  return (
    <Container fluid className="my-3 px-0">
      <ReactTable
        data={results}
        columns={columns}
        className="-striped -highlight mb-5"
        noDataText={noResultsMessage}
        defaultPageSize={defaultPageSize}
        showPagination={showPagination}
        showPaginationTop={showPagination}
      />
    </Container>
  );
}

TestsTable.propTypes = {
  results: PropTypes.arrayOf(PropTypes.shape({})),
  defaultPageSize: PropTypes.number,
  projectsMap: PropTypes.oneOfType([PropTypes.bool, PropTypes.shape({})])
    .isRequired,
  platformsMap: PropTypes.oneOfType([PropTypes.bool, PropTypes.shape({})])
    .isRequired,
};

TestsTable.defaultProps = {
  results: [],
  defaultPageSize: 20,
};
