import React from 'react';
import ReactTable from 'react-table';
import moment from 'moment';
import { groupBy, forIn } from 'lodash';

const TableView = ({ testData, highlightAlerts, highlightedRevisions }) => {
  const allDataPoints = [];
  const tableDataPoints = [];

  const columns = [
    {
      Header: 'Date',
      accessor: 'date',
      headerClassName: 'table-header',
    },
  ];

  testData.forEach((item, index) => {
    if (item.visible) {
      // unique key object name
      const id = `name${index}`;
      const value = `value${index}`;

      // add columns for each test
      columns.push({
        Header: (
          <span>
            <p className="font-weight-bold mb-1">{item.name}</p> <br />
            {item.platform} | {item.repository_name}{' '}
          </span>
        ),
        Cell: ({ original }) => {
          return <div>{original[value]}</div>;
        },
        headerClassName: `table-header ${item.color[0]}`,
        getProps: (state, rowInfo) => ({
          style: {
            background: rowInfo && rowInfo.original.highlighted && '#ffde2f',
          },
          'aria-label': 'highlighted revision',
        }),
      });

      // populate array with only data points
      item.data.forEach(dataPoint => {
        allDataPoints.push({
          [id]: item.name,
          date: moment(dataPoint.x).format('MMM DD, h:mm:ss a'),
          [value]: dataPoint.y.toFixed(2),
          highlighted:
            highlightAlerts &&
            highlightedRevisions.some(
              item => item && dataPoint.revision.includes(item),
            ),
        });
      });
    }
  });

  forIn(
    // group data points in arrays by date
    groupBy(allDataPoints, arr => arr.date),
    value => {
      const dataRow = value.reduce((acc, curr) => {
        // group all items in the array into one object
        return {
          ...acc,
          ...curr,
        };
      });
      tableDataPoints.push(dataRow);
    },
  );

  return (
    <ReactTable
      data={tableDataPoints}
      showPageSizeOptions
      columns={columns}
      className="-striped mb-5 w-100"
      getTableProps={() => ({ role: 'table' })}
      showPaginationTop
      defaultPageSize={10}
    />
  );
};

export default TableView;
