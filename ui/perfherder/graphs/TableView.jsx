import React from 'react';
import ReactTable from 'react-table';
import moment from 'moment';
import { groupBy, forIn } from 'lodash';
import numeral from 'numeral';

import RepositoryModel from '../../models/repository';
import { getJobsUrl, createQueryParams } from '../../helpers/url';
import { displayNumber } from '../helpers';

const TableView = ({
  testData,
  highlightAlerts,
  highlightedRevisions,
  projects,
}) => {
  const allDataPoints = [];
  const tableDataPoints = [];

  const setHighlightedRow = rowInfo => {
    let cellProps = {};
    if (rowInfo && rowInfo.original.highlighted) {
      cellProps = {
        className: 'bg-lightgray',
        'aria-label': `highlighted revision: ${rowInfo.original.revision}`,
      };
    }
    return cellProps;
  };

  const columns = [
    {
      Header: 'Date',
      accessor: 'date',
      Cell: ({ original }) => {
        const { date, pushUrl, revision } = original;
        return (
          <div>
            <span>{date}</span>
            <br />{' '}
            {pushUrl && (
              <a href={pushUrl} target="_blank" rel="noopener noreferrer">
                {revision.slice(0, 13)}
              </a>
            )}
          </div>
        );
      },
      headerClassName:
        'text-wrap d-flex justify-content-center align-items-center',
      getProps: (state, rowInfo) => setHighlightedRow(rowInfo),
    },
  ];

  testData.forEach((item, index) => {
    if (item.visible) {
      // unique key object name
      const id = `name${index}`;
      const value = `value${index}`;
      const jobUrlKey = `jobUrl${index}`;
      const compareUrlKey = `compareUrl${index}`;
      const deltaValueKey = `deltaValue${index}`;
      const deltaPercentKey = `deltaPercent${index}`;

      // add columns for each test
      columns.push({
        sortable: false,
        Header: (
          <span>
            <p className="font-weight-bold mb-1">{item.name}</p>
            <p className="text-muted">
              ({item.lowerIsBetter ? 'lower is better' : 'higher is better'})
            </p>
            {item.platform} | {item.repository_name}
          </span>
        ),
        headerClassName: `text-wrap d-flex justify-content-center align-items-center table-header ${item.color[0]}`,
        Cell: ({ original }) => {
          return (
            <div>
              <span>
                {original[value]}{' '}
                <span className="text-muted small">
                  &Delta; {displayNumber(original[deltaValueKey].toFixed(1))} (
                  {(100 * original[deltaPercentKey]).toFixed(1)}%)
                </span>
              </span>
              <br />
              <div className="job-links">
                {original[jobUrlKey] && (
                  <a
                    href={original[jobUrlKey]}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    job
                  </a>
                )}
                ,{' '}
                <a
                  href={original[compareUrlKey]}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  compare
                </a>
              </div>
            </div>
          );
        },
        getProps: (state, rowInfo) => setHighlightedRow(rowInfo),
      });

      // populate array with only data points
      item.data.forEach((dataPoint, dataIndex) => {
        const prevFlotDataPointIndex = dataIndex - 1;

        // calculate delta values
        const valueY = dataPoint.y;
        const v0 =
          prevFlotDataPointIndex !== -1
            ? item.data[prevFlotDataPointIndex].y
            : valueY;
        const deltaValue = valueY - v0;
        const deltaPercent = valueY / v0 - 1;

        // get push link
        let prevRevision;
        let pushUrl;
        if (prevFlotDataPointIndex !== -1) {
          prevRevision = item.data[prevFlotDataPointIndex].revision;
          const repoModel = new RepositoryModel(
            projects.find(
              repositoryName => repositoryName.name === item.repository_name,
            ),
          );
          pushUrl = repoModel.getPushLogRangeHref({
            fromchange: prevRevision,
            tochange: dataPoint.revision,
          });
        }

        const jobsUrl = getJobsUrl({
          repo: item.repository_name,
          revision: dataPoint.revision,
          selectedJob: dataPoint.jobId,
          group_state: 'expanded',
        });

        const compareUrl = `#/comparesubtest${createQueryParams({
          originalProject: item.repository_name,
          newProject: item.repository_name,
          originalRevision: prevRevision,
          newRevision: dataPoint.revision,
          originalSignature: item.parentSignature || item.signature_id,
          newSignature: item.parentSignature || item.signature_id,
          framework: item.framework_id,
        })}`;

        allDataPoints.push({
          [id]: item.name,
          date: moment(dataPoint.x).format('MMM DD, h:mm:ss a'),
          [value]: numeral(dataPoint.y).format('0,0.[00]'),
          highlighted:
            highlightAlerts &&
            highlightedRevisions.some(
              item => item && dataPoint.revision.includes(item),
            ),
          revision: dataPoint.revision,
          pushUrl,
          [jobUrlKey]: jobsUrl,
          [compareUrlKey]: compareUrl,
          [deltaValueKey]: deltaValue,
          [deltaPercentKey]: deltaPercent,
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
      className="-striped mb-5 w-100 max-width-default table-graphs-view mx-auto"
      getTableProps={() => ({ role: 'table' })}
      showPaginationTop
      defaultPageSize={10}
    />
  );
};

export default TableView;
