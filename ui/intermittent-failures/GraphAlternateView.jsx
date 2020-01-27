import React from 'react';
import ReactTable from 'react-table';
import PropTypes from 'prop-types';

const GraphAlternateView = ({ className, graphData, colNum, title }) => {
  const columnsOne = [
    {
      Header: 'Date',
      accessor: 'date',
    },
    {
      Header: 'Failure Count per Push',
      accessor: 'failurePerPush',
    },
  ];

  const columnsTwo = [
    {
      Header: 'Date',
      accessor: 'date',
    },
    {
      Header: 'Failure Count',
      accessor: 'failureCount',
    },
    {
      Header: 'Push Count',
      accessor: 'pushCount',
    },
  ];

  const alternateGraph = {
    column: [],
    data: [],
  };

  graphData.forEach(item => {
    if (colNum === 1) {
      alternateGraph.column = columnsOne;

      item.data.forEach(itemOne => {
        const { date, failurePerPush } = itemOne;

        alternateGraph.data.push({
          date,
          failurePerPush,
        });
      });
    } else {
      alternateGraph.column = columnsTwo;

      item.data.forEach((itemTwo, indexTwo) => {
        const { date, failureCount, pushCount } = itemTwo;

        alternateGraph.data[indexTwo] = {
          date,
          ...alternateGraph.data[indexTwo],
          ...(failureCount && { failureCount }),
          ...(pushCount && { pushCount }),
        };
      });
    }
  });

  return (
    <div className="alternate-table mb-3">
      <h3>{title}</h3>
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
  colNum: 1,
};
