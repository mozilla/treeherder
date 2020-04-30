import React from 'react';
import { Row, Col, Breadcrumb, BreadcrumbItem } from 'reactstrap';
import { Link } from 'react-router-dom';
import ReactTable from 'react-table';
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
    updateState,
    bug,
    summary,
    errorMessages,
    lastLocation,
    tableFailureStatus,
    graphFailureStatus,
  } = props;

  const columns = [
    {
      Header: 'Push Time',
      accessor: 'push_time',
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
                  href={getLogViewerUrl(value, original.tree)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  view details
                </a>
              </React.Fragment>
            }
            placement="left"
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
          />
        );
      },
      minWidth: 110,
    },
  ];

  let graphOneData = null;
  let graphTwoData = null;

  if (graphData.length > 0) {
    ({ graphOneData, graphTwoData } = calculateMetrics(graphData));
  }

  return (
    <Layout
      {...props}
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
                  <a title="Treeherder home page" href="/#/">
                    Treeherder
                  </a>
                </BreadcrumbItem>
                <BreadcrumbItem>
                  <Link
                    title="Intermittent Failures View main page"
                    to={lastLocation || '/'}
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
                  <h1>Details for Bug {!bug ? '' : bug}</h1>
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
        initialParamsSet && (
          <ReactTable
            data={tableData}
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
  location: PropTypes.shape({}).isRequired,
  tree: PropTypes.string.isRequired,
  updateAppState: PropTypes.func,
  updateState: PropTypes.func.isRequired,
  startday: PropTypes.string.isRequired,
  endday: PropTypes.string.isRequired,
  tableData: PropTypes.arrayOf(PropTypes.shape({})),
  graphData: PropTypes.arrayOf(PropTypes.shape({})),
  initialParamsSet: PropTypes.bool.isRequired,
  bug: PropTypes.number.isRequired,
  summary: PropTypes.string.isRequired,
  errorMessages: PropTypes.arrayOf(PropTypes.string),
  lastLocation: PropTypes.shape({}).isRequired,
  tableFailureStatus: PropTypes.string,
  graphFailureStatus: PropTypes.string,
};

BugDetailsView.defaultProps = {
  graphData: [],
  tableData: [],
  errorMessages: [],
  tableFailureStatus: null,
  graphFailureStatus: null,
  updateAppState: null,
};

const defaultState = {
  endpoint: bugDetailsEndpoint,
  route: '/bugdetails',
};

export default withView(defaultState)(BugDetailsView);
