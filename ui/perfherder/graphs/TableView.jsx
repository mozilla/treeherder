
import ReactTable from 'react-table-6';
import { Badge } from 'react-bootstrap';
import { groupBy, forIn } from 'lodash';
import numeral from 'numeral';

import dayjs from '../../helpers/dayjs';
import RepositoryModel from '../../models/repository';
import { getJobsUrl, getPerfCompareBaseSubtestsURL } from '../../helpers/url';
import { getFrameworkName, displayNumber } from '../perf-helpers/helpers';

const TableView = ({
  testData,
  highlightAlerts,
  highlightedRevisions,
  projects,
  frameworks,
}) => {
  let tableDataPoints = [];
  let columns = [];

  const getRevisionInfo = (dataIndex, dataPoint, item) => {
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
          (repositoryName) => repositoryName.name === item.repository_name,
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

    const compareUrl = getPerfCompareBaseSubtestsURL(
      item.repository_name,
      prevRevision,
      item.repository_name,
      dataPoint.revision,
      item.framework_id,
      item.parentSignature || item.signature_id,
      item.parentSignature || item.signature_id,
    );

    return {
      deltaValue,
      deltaPercent,
      pushUrl,
      jobsUrl,
      compareUrl,
    };
  };

  const setHighlightedRow = (rowInfo) => {
    let cellProps = {};
    if (rowInfo?.original.highlighted) {
      cellProps = {
        className: 'bg-lightgray',
        'aria-label': `highlighted revision: ${rowInfo.original.revision}`,
      };
    }
    return cellProps;
  };

  const setTestColumnHeader = (item, dataKey, setHighlightedRow) => {
    return {
      sortable: false,
      Header: () => (
        <span>
          <p className="font-weight-bold mb-1">{item.name}</p>
          <p className="text-muted small">
            ({item.lowerIsBetter ? 'lower is better' : 'higher is better'})
          </p>
          <Badge>{getFrameworkName(frameworks, item.framework_id)}</Badge>
          <br />
          <p className="text-muted mt-2 mb-1">
            {item.platform} | {item.repository_name}
          </p>
        </span>
      ),
      headerClassName: `text-wrap d-flex justify-content-center align-items-center table-header ${item.color[0]}`,
      Cell: (props) => {
        let cellElem = null;
        if (props.original[dataKey]) {
          const {
            value,
            jobsUrl,
            compareUrl,
            deltaValue,
            deltaPercent,
          } = props.original[dataKey];
          cellElem = (
            <div tabIndex={-1}>
              <span>
                {value}{' '}
                <span className="text-darker-secondary">
                  &Delta; {displayNumber(deltaValue.toFixed(1))} (
                  {(100 * deltaPercent).toFixed(1)}
                  %)
                </span>
              </span>
              <br />
              <div className="job-links">
                {jobsUrl && (
                  <a href={jobsUrl} target="_blank" rel="noopener noreferrer">
                    job
                  </a>
                )}
                ,{' '}
                <a href={compareUrl} target="_blank" rel="noopener noreferrer">
                  compare
                </a>
              </div>
            </div>
          );
        }
        return cellElem;
      },
      getProps: (_state, rowInfo) => setHighlightedRow(rowInfo),
    };
  };

  const getRowDataPoint = (
    item,
    dataIndex,
    dataPoint,
    highlightAlerts,
    highlightedRevisions,
    dataKey,
  ) => {
    const {
      pushUrl,
      jobsUrl,
      compareUrl,
      deltaValue,
      deltaPercent,
    } = getRevisionInfo(dataIndex, dataPoint, item);

    return {
      date: dayjs(dataPoint.x),
      highlighted:
        highlightAlerts &&
        highlightedRevisions.some(
          (item) => item && dataPoint.revision.includes(item),
        ),
      revision: dataPoint.revision,
      pushUrl,
      [dataKey]: {
        name: item.name,
        value: numeral(dataPoint.y).format('0,0.[00]'),
        jobsUrl,
        compareUrl,
        deltaValue,
        deltaPercent,
      },
    };
  };

  const getTableDataPoints = (allDataPoints) => {
    const tableDataPoints = [];
    forIn(
      // group data points in arrays by date
      groupBy(allDataPoints, (arr) => arr.date),
      (value) => {
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
    return tableDataPoints;
  };

  const createTable = () => {
    const allDataPoints = [];
    columns = [
      {
        Header: 'Date',
        accessor: 'date',
        Cell: ({ original }) => {
          const { date, pushUrl, revision } = original;
          return (
            <div>
              <span>{dayjs(date).format('MMM DD, h:mm:ss a')}</span>
              <br />{' '}
              {pushUrl && (
                <a
                  title="Revision Link"
                  href={pushUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {revision.slice(0, 13)}
                </a>
              )}
            </div>
          );
        },
        headerClassName:
          'text-wrap d-flex justify-content-center align-items-center',
        getProps: (_state, rowInfo) => setHighlightedRow(rowInfo),
      },
    ];

    testData.forEach((item, index) => {
      if (item.visible) {
        const dataKey = `data${index}`;

        // add columns for each test
        columns.push(setTestColumnHeader(item, dataKey, setHighlightedRow));

        // populate array with only data points
        item.data.forEach((dataPoint, dataIndex) => {
          allDataPoints.push(
            getRowDataPoint(
              item,
              dataIndex,
              dataPoint,
              highlightAlerts,
              highlightedRevisions,
              dataKey,
            ),
          );
        });
      }
    });

    tableDataPoints = getTableDataPoints(allDataPoints);
  };

  createTable();

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
