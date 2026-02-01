import React from 'react';
import { Row, Col, Breadcrumb, BreadcrumbItem } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import ReactTable from 'react-table-6';
import PropTypes from 'prop-types';
import { Helmet } from 'react-helmet';

import {
  bugDetailsEndpoint,
  getJobsUrl,
  getLogViewerUrl,
} from '../helpers/url';

import {
  calculateMetrics,
  prettyDate,
  tableRowStyling,
  removePath,
  regexpFilter,
  tooltipCell,
  textFilter,
} from './helpers';
import Layout from './Layout';
import useIntermittentFailuresData from './useIntermittentFailuresData';
import DateOptions from './DateOptions';

const defaultState = {
  endpoint: bugDetailsEndpoint,
  route: '/bugdetails',
};

const BugDetailsView = (props) => {
  const { user, setUser, notify } = props;

  // Use the custom hook for data management
  const {
    graphData,
    tableData,
    initialParamsSet,
    startday,
    endday,
    bug,
    summary,
    errorMessages,
    lastLocation,
    tableFailureStatus,
    graphFailureStatus,
    isFetchingTable,
    isFetchingGraphs,
    updateState,
  } = useIntermittentFailuresData(defaultState);

  const columns = [
    {
      Header: 'Push Time',
      accessor: 'push_time',
      maxWidth: 180,
      className: 'text-left',
      headerClassName: 'text-left',
      filterMethod: regexpFilter,
      Filter: (filterProps) =>
        textFilter({ ...filterProps, placeholder: 'Filter by push time…' }),
      Cell: (_props) => (
        <a
          href={getJobsUrl({
            repo: _props.original.tree,
            revision: _props.original.revision,
            selectedJob: _props.original.job_id,
          })}
          target="_blank"
          rel="noopener noreferrer"
          title="Open job in a new window"
        >
          {_props.value}
        </a>
      ),
    },
    {
      Header: 'Tree',
      accessor: 'tree',
      maxWidth: 130,
      className: 'text-left',
      headerClassName: 'text-left',
      filterMethod: regexpFilter,
      Filter: (filterProps) =>
        textFilter({ ...filterProps, placeholder: 'Filter by tree…' }),
      Cell: tooltipCell,
    },
    {
      Header: 'Job Name',
      accessor: 'job_name',
      maxWidth: 500,
      className: 'text-left',
      headerClassName: 'text-left',
      filterMethod: regexpFilter,
      Filter: (filterProps) =>
        textFilter({ ...filterProps, placeholder: 'Filter by job name…' }),
      Cell: tooltipCell,
    },
    {
      Header: 'Machine Name',
      accessor: 'machine_name',
      maxWidth: 125,
      className: 'text-left',
      headerClassName: 'text-left',
      filterMethod: regexpFilter,
      Filter: (filterProps) =>
        textFilter({ ...filterProps, placeholder: 'Filter by machine…' }),
      Cell: (cellProps) => {
        const { value } = cellProps;
        if (value?.startsWith('vm-') || /^\d+$/.test(value)) {
          return (
            <div title={value} className="vm-container">
              <span className="vm-text">virtual machine</span>
            </div>
          );
        }
        return tooltipCell(cellProps);
      },
    },
    {
      Header: 'Failure Lines',
      accessor: 'failure_lines_text',
      headerClassName: 'text-left',
      Filter: (filterProps) =>
        textFilter({ ...filterProps, placeholder: 'Filter by failure lines…' }),
      filterMethod: regexpFilter,
      Cell: (_props) => {
        const { original } = _props;
        return (
          <div>
            <div className="failure-header">
              <span className="failure-count">
                {`${original.lines.length} unexpected-fail${
                  original.lines.length > 1 ? 's' : ''
                }`}
              </span>
              {' | '}
              <a
                className="small-text"
                href={`${window.location.origin}${getLogViewerUrl(
                  original.job_id,
                  original.tree,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Open the log viewer in a new window"
              >
                open log viewer
              </a>
            </div>
            {original.lines.length > 0 && (
              <div className="failure-lines">
                {original.lines.map((line, index) => {
                  // Remove "TEST-UNEXPECTED-FAIL | " and everything before it
                  const TEST_FAIL_PREFIX = 'TEST-UNEXPECTED-FAIL | ';
                  const failIndex = line.indexOf(TEST_FAIL_PREFIX);
                  const trimmedLine = removePath(
                    failIndex !== -1
                      ? line.slice(failIndex + TEST_FAIL_PREFIX.length)
                      : line,
                  );

                  return (
                    <div
                      key={index} // eslint-disable-line react/no-array-index-key
                      title={trimmedLine}
                      className="failure-line"
                    >
                      {trimmedLine}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      },
      minWidth: 300,
      className: 'text-left',
    },
  ];

  let graphOneData = null;
  let graphTwoData = null;
  let _tableData = null;

  if (graphData.length > 0) {
    ({ graphOneData, graphTwoData } = calculateMetrics(graphData));

    _tableData = tableData.map((row) => ({
      ...row,
      job_name: `${row.platform}/${row.build_type}-${row.test_suite}`,
      failure_lines_text: row.lines ? row.lines.join(' ') : '',
    }));
  }

  // Build props to pass to Layout
  const layoutProps = {
    user,
    setUser,
    notify,
    errorMessages,
    tableFailureStatus,
    graphFailureStatus,
    isFetchingTable,
    isFetchingGraphs,
  };

  return (
    <Layout
      {...layoutProps}
      graphOneData={graphOneData}
      graphTwoData={graphTwoData}
      header={
        <React.Fragment>
          <Row>
            <Helmet>
              <title>{`Bug ${bug}${summary ? ` - ${summary}` : ''}`}</title>
            </Helmet>
            <Col xs="12" className="text-left">
              <Breadcrumb listClassName="bg-white">
                <BreadcrumbItem>
                  <a title="Treeherder home page" href="/">
                    Treeherder
                  </a>
                </BreadcrumbItem>
                <BreadcrumbItem>
                  <Link
                    title="Intermittent Failures View main page"
                    to={lastLocation || '/intermittent-failures/'}
                  >
                    Main view
                  </Link>
                </BreadcrumbItem>
                <BreadcrumbItem active title="Bugdetails view">
                  Bugdetails view
                </BreadcrumbItem>
              </Breadcrumb>
            </Col>
          </Row>
          {!errorMessages.length && !tableFailureStatus && !graphFailureStatus && (
            <React.Fragment>
              <Row>
                <Col xs="12" className="mx-auto">
                  <h1>
                    <span>Details for Bug </span>
                    {bug && (
                      <a
                        href={`https://bugzilla.mozilla.org/show_bug.cgi?id=${bug}`}
                      >
                        {bug}
                      </a>
                    )}
                  </h1>
                </Col>
              </Row>
              <Row>
                <Col xs="12" className="mx-auto">
                  <p className="subheader">{`${prettyDate(
                    startday,
                  )} to ${prettyDate(endday)} UTC`}</p>
                </Col>
              </Row>
              {summary && (
                <Row>
                  <Col xs="4" className="mx-auto">
                    <p className="text-secondary text-center">{summary}</p>
                  </Col>
                </Row>
              )}
              {tableData.length > 0 && (
                <Row>
                  <Col xs="12" className="mx-auto">
                    <p className="text-secondary">
                      {tableData.length} total failures
                    </p>
                  </Col>
                </Row>
              )}
            </React.Fragment>
          )}
        </React.Fragment>
      }
      table={
        bug &&
        initialParamsSet &&
        _tableData && (
          <ReactTable
            data={_tableData}
            filterable
            showPageSizeOptions={false}
            columns={columns}
            className="-striped"
            getTrProps={tableRowStyling}
            showPaginationTop
            defaultPageSize={100}
          />
        )
      }
      datePicker={<DateOptions updateState={updateState} />}
    />
  );
};

BugDetailsView.propTypes = {
  user: PropTypes.shape({}),
  setUser: PropTypes.func.isRequired,
  notify: PropTypes.func.isRequired,
};

export default BugDetailsView;
