import React from 'react';
import ReactTable from 'react-table';
import PropTypes from 'prop-types';

const GraphAlternateView = ({ className, graphData, colNum, title }) => {
  const columnsTwo = [
    {
      Header: 'Date',
      accessor: 'date',
    },
    {
      Header: 'Failure Count per Push',
      accessor: 'failurePerPush',
    },
  ];

  const columnsThree = [
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

  graphData.forEach(graphItem => {
    if (colNum === 1) {
      alternateGraph.column = columnsTwo;

      graphItem.data.forEach(item => {
        const { date, failurePerPush } = item;

        alternateGraph.data.push({
          date,
          failurePerPush,
        });
      });
    } else {
      alternateGraph.column = columnsThree;

      graphItem.data.forEach((item, index) => {
        const { date, failureCount, pushCount } = item;
        alternateGraph.data[index] = {
          date,
          ...alternateGraph.data[index],
          ...(failureCount && { failureCount }),
          ...(pushCount && { pushCount }),
        };
      });
    }
  });

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
