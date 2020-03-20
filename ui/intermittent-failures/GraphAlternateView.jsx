import React from 'react';
import ReactTable from 'react-table';
import PropTypes from 'prop-types';
import { zipWith } from 'lodash';

const GraphAlternateView = ({ className, graphData, colNum, title }) => {
  const columnsTwo = [
    {
      Header: 'Date',
      accessor: 'date',
      sortable: false,
    },
    {
      Header: 'Failure Count per Push',
      accessor: 'failurePerPush',
      sortable: false,
    },
  ];

  const columnsThree = [
    {
      Header: 'Date',
      accessor: 'date',
      sortable: false,
    },
    {
      Header: 'Failure Count',
      accessor: 'failureCount',
      sortable: false,
    },
    {
      Header: 'Push Count',
      accessor: 'pushCount',
      sortable: false,
    },
  ];

  const alternateGraph = {
    column: [],
    data: [],
  };

  if (colNum === 1) {
    alternateGraph.column = columnsTwo;
    alternateGraph.data = graphData[0].data;
  } else {
    alternateGraph.column = columnsThree;
    // create new array with objects with combined properties
    alternateGraph.data = zipWith(
      graphData[0].data,
      graphData[1].data,
      (a, b) => {
        const { date, failureCount } = a;
        const { pushCount } = b;
        return {
          date,
          failureCount,
          pushCount,
        };
      },
    );
  }

  return (
    <div className="alternate-table mb-3">
      <p className="subheader mb-3">{title}</p>
      <ReactTable
        data={alternateGraph.data}
        showPageSizeOptions
        columns={alternateGraph.column}
        className={`${className} -striped mb-5`}
        getTableProps={() => ({ role: 'table' })}
        showPaginationTop
        defaultPageSize={10}
      />
    </div>
  );
};

export default GraphAlternateView;

GraphAlternateView.propTypes = {
  colNum: PropTypes.number,
};

GraphAlternateView.defaultProps = {
  colNum: 2,
};
