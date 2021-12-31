import React from 'react';
import PropTypes from 'prop-types';
import { Container } from 'reactstrap';
import ReactTable from 'react-table';

import { noResultsMessage } from '../perf-helpers/constants';
import { Perfdocs, perfViews } from '../perf-helpers/perfdocs';

import ItemList from './ItemList';
import PlatformList from './PlatformList';
import AlertsList from './AlertsList';

export default function TestsTable(props) {
  const {
    results,
    framework,
    projectsMap,
    platformsMap,
    defaultPageSize,
  } = props;

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
      Cell: ({ row }) => {
        const perfdocs = new Perfdocs(framework, row.suite);
        const hasDocumentation = perfdocs.hasDocumentation(perfViews.testsView);
        return (
          <div>
            {hasDocumentation ? (
              <a href={perfdocs.documentationURL}>{row.suite}</a>
            ) : (
              <div>{row.suite}</div>
            )}
          </div>
        );
      },
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
      Cell: (props) => {
        if (platformsMap) {
          const platforms = props.value.map((id) => platformsMap[id]);
          return <PlatformList items={platforms} />;
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
      Cell: (props) => {
        if (projectsMap) {
          const repositories = props.value.map((id) => projectsMap[id]);
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
      Header: 'Alerts',
      accessor: 'total_alerts',
      Cell: (props) => {
        const { original } = props;
        return <AlertsList alerts={original} />;
      },
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
