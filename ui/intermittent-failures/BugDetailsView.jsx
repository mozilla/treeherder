import React from 'react';
import { Row, Col, Breadcrumb, BreadcrumbItem } from 'reactstrap';
import { Link } from 'react-router-dom';
import ReactTable from 'react-table-6';
import PropTypes from 'prop-types';
import { Helmet } from 'react-helmet';

import {
  bugDetailsEndpoint,
  getJobsUrl,
  getLogViewerUrl,
} from '../helpers/url';
import SimpleTooltip from '../shared/SimpleTooltip';

import {
  calculateMetrics,
  prettyDate,
  tableRowStyling,
  removePath,
} from './helpers';
import Layout from './Layout';
import withView from './View';
import DateOptions from './DateOptions';

const BugDetailsView = (props) => {
  const {
    graphData,
    tableData,
    initialParamsSet,
    startday,
    endday,
    failurehash,
    updateState,
    updateHash,
    bug,
    summary,
    errorMessages,
    lastLocation,
    tableFailureStatus,
    graphFailureStatus,
    uniqueLines,
    uniqueFrequency,
  } = props;

  const customFilter = ({ filter }) => {
    if (!tableData || !uniqueLines) return;
    return (
      <select
        onChange={(event) => updateHash(event.target.value)}
        style={{ width: '100%' }}
        value={filter ? filter.value : failurehash}
      >
        <option value="all">All</option>
        {uniqueLines.map((vals) => {
          return (
            <option key={vals[1]} value={vals[1]}>
              {vals[0]}
            </option>
          );
        })}
      </select>
    );
  };

  const lineTrimmer = (failureLines) => {
    if (failureLines === undefined) {
      return '';
    }
    if (typeof failureLines === 'string') {
      failureLines = failureLines.split('\n');
    }
    const lines = failureLines.map((i) => i.split('\n'));

    const trimmedLines = lines.map((line) => {
      const parts = line.toString().split(' | ');
      if (parts.length > 2) {
        parts.shift();
      }
      return parts.join(' | ');
    });
    return trimmedLines.join('\n');
  };

  const columns = [
    {
      Header: 'Push Time',
      accessor: 'push_time',
      minWidth: 105,
      className: 'text-left',
    },
    {
      Header: 'Tree',
      accessor: 'tree',
    },
    {
      Header: 'Revision',
      accessor: 'revision',
      Cell: (_props) => (
        <a
          href={getJobsUrl({
            repo: _props.original.tree,
            revision: _props.value,
            selectedJob: _props.original.job_id,
          })}
          target="_blank"
          rel="noopener noreferrer"
        >
          {_props.value}
        </a>
      ),
    },
    {
      Header: 'Platform',
      accessor: 'platform',
      className: 'text-left',
      headerClassName: 'platform-column-header',
    },
    {
      Header: 'Build Type',
      accessor: 'build_type',
    },
    {
      Header: 'Test Suite',
      accessor: 'test_suite',
      minWidth: 150,
      className: 'text-left',
      headerClassName: 'test-suite-header',
    },
    {
      Header: 'Machine Name',
      accessor: 'machine_name',
      minWidth: 125,
    },
    {
      Header: 'Log',
      accessor: 'job_id',
      Filter: ({ filter, onChange }) => customFilter({ filter, onChange }),
      Cell: (_props) => {
        const { value, original } = _props;
        return (
          <SimpleTooltip
            text={
              <React.Fragment>
                {`${original.lines.length} unexpected-fail${
                  original.lines.length > 1 ? 's' : ''
                }`}
                <br />
                <a
                  className="small-text"
                  href={`${window.location.origin}${getLogViewerUrl(
                    value,
                    original.tree,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  view details
                </a>
              </React.Fragment>
            }
            placement="top"
            tooltipText={
              original.lines.length && (
                <ul>
                  {original.lines.map((line, index) => (
                    <li
                      key={index} // eslint-disable-line react/no-array-index-key
                      className="failure_li text-truncate"
                    >
                      {removePath(line)}
                    </li>
                  ))}
                </ul>
              )
            }
            innerClassName="custom-tooltip"
          />
        );
      },
      minWidth: 110,
    },
  ];

  let gOneData = {};
  let graphOneData = null;
  let graphTwoData = null;
  let _tableData = null;

  if (graphData.length > 0) {
    ({ graphOneData, graphTwoData } = calculateMetrics(graphData));
    if (uniqueFrequency) {
      gOneData = uniqueFrequency;
    }
    gOneData.all = graphOneData;
    gOneData.all[0].count = tableData.length;

    _tableData = tableData;
    // here we Filter() the tableData.
    // Since we use urlParams for failurehash, this synchronizes it.
    if (failurehash !== 'all') {
      const tData = [];
      tableData.forEach((row) => {
        const trimmed = lineTrimmer(row.lines);
        let filterValue = '';
        const hashIndex = 1;
        uniqueLines.forEach((uniqueLine) => {
          if (trimmed === uniqueLine[0]) {
            filterValue = uniqueLine[hashIndex];
          }
        });
        if (filterValue === failurehash) {
          tData.push(row);
        }
      });
      _tableData = tData;
    }
  }

  return (
    <Layout
      {...props}
      graphOneData={gOneData}
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
                      {failurehash in gOneData
                        ? gOneData[failurehash][0].count
                        : 0}{' '}
                      total failures
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
            showPageSizeOptions
            columns={columns}
            className="-striped"
            getTrProps={tableRowStyling}
            showPaginationTop
            defaultPageSize={50}
          />
        )
      }
      datePicker={<DateOptions updateState={updateState} />}
    />
  );
};

BugDetailsView.propTypes = {
  location: PropTypes.shape({
    pathname: PropTypes.string,
    search: PropTypes.string,
    state: PropTypes.shape({}),
    hash: PropTypes.string,
  }).isRequired,
  lastLocation: PropTypes.shape({
    pathname: PropTypes.string,
    search: PropTypes.string,
    state: PropTypes.shape({}),
    hash: PropTypes.string,
  }).isRequired,
  tree: PropTypes.string.isRequired,
  updateAppState: PropTypes.func,
  updateState: PropTypes.func.isRequired,
  updateHash: PropTypes.func.isRequired,
  startday: PropTypes.string.isRequired,
  failurehash: PropTypes.string.isRequired,
  endday: PropTypes.string.isRequired,
  tableData: PropTypes.arrayOf(
    PropTypes.shape({
      // Define the expected structure of tableData objects here
      push_time: PropTypes.string,
      tree: PropTypes.string,
      revision: PropTypes.string,
      platform: PropTypes.string,
      build_type: PropTypes.string,
      test_suite: PropTypes.string,
      machine_name: PropTypes.string,
      job_id: PropTypes.string,
      lines: PropTypes.arrayOf(PropTypes.string),
    }),
  ),
  graphData: PropTypes.arrayOf(
    PropTypes.shape({
      // Define the expected structure of graphData objects here
      // Example:
      timestamp: PropTypes.number,
      value: PropTypes.number,
    }),
  ),
  initialParamsSet: PropTypes.bool.isRequired,
  bug: PropTypes.string.isRequired,
  summary: PropTypes.string.isRequired,
  errorMessages: PropTypes.arrayOf(PropTypes.string),
  tableFailureStatus: PropTypes.string,
  graphFailureStatus: PropTypes.string,
  uniqueLines: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)),
  uniqueFrequency: PropTypes.shape({
    // Define the expected structure of uniqueFrequency object here
    all: PropTypes.arrayOf(
      PropTypes.shape({
        count: PropTypes.number,
      }),
    ),
  }),
};

BugDetailsView.defaultProps = {
  graphData: [],
  tableData: [],
  errorMessages: [],
  tableFailureStatus: null,
  graphFailureStatus: null,
  updateAppState: null,
  uniqueLines: [],
  uniqueFrequency: {},
};

const defaultState = {
  endpoint: bugDetailsEndpoint,
  route: '/bugdetails',
};

export default withView(defaultState)(BugDetailsView);
