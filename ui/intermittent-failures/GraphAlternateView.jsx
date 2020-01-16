/* eslint-disable array-callback-return */

import React from 'react';
import ReactTable from 'react-table';

const GraphAlternateView = ({ graphData, colNum }) => {
  const columnsOne = [
    {
      Header: 'Date',
      accessor: 'x',
    },
    {
      Header: 'Failure Count per Push',
      accessor: 'y',
    },
  ];

  const columnsTwo = [
    {
      Header: 'Date',
      accessor: 'x',
    },
    {
      Header: 'Failure Count',
      accessor: 'y',
    },
    {
      Header: 'Push Count',
      accessor: 'z',
    },
  ];

  const alternateGraph = {
    column: [],
    data: [],
  };

  const convertDateToString = date =>
    date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
    });

  graphData.map((item, index) => {
    if (colNum === 1) {
      item.data.map(itemOne => {
        alternateGraph.column = columnsOne;

        const dataPoint = {};

        dataPoint.x = convertDateToString(itemOne.x);
        dataPoint.y = itemOne.y.toFixed(2);

        alternateGraph.data.push(dataPoint);
      });
    } else {
      alternateGraph.column = columnsTwo;

      item.data.map((itemTwo, indexTwo) => {
        const dataPoint = {};

        if (index > 0) {
          alternateGraph.data[indexTwo].z = itemTwo.y;
        } else {
          dataPoint.x = convertDateToString(itemTwo.x);
          dataPoint.y = itemTwo.y;

          alternateGraph.data.push(dataPoint);
        }
      });
    }
  });

  return (
    <ReactTable
      data={alternateGraph.data}
      showPageSizeOptions
      columns={alternateGraph.column}
      className="-striped mb-5 alternate-table"
      getTableProps={() => ({ role: 'table' })}
      showPaginationTop
      defaultPageSize={10}
    />
  );
};

export default GraphAlternateView;
