import React from 'react';
import { Row, Col, Breadcrumb, BreadcrumbItem } from 'reactstrap';
import PropTypes from 'prop-types';
import moment from 'moment';
import ReactTable from 'react-table';

import { bugsEndpoint } from '../helpers/url';

import BugColumn from './BugColumn';
import {
  calculateMetrics,
  prettyDate,
  ISODate,
  tableRowStyling,
} from './helpers';
import withView from './View';
import Layout from './Layout';
import DateRangePicker from './DateRangePicker';

const MainView = (props) => {
  const {
    graphData,
    tableData,
    initialParamsSet,
    startday,
    endday,
    updateState,
    tree,
    location,
    updateAppState,
  } = props;

  const textFilter = (filter, row) => {
    const text = row[filter.id];
    const regex = RegExp(filter.value, 'i');
    if (regex.test(text)) {
      return row;
    }
  };

  const columns = [
    {
      Header: 'Bug',
      accessor: 'id',
      headerClassName: 'bug-column-header text-left',
      className: 'bug-column text-left',
      maxWidth: 150,
      width: 115,
      Cell: (_props) => (
        <BugColumn
          data={_props.original}
          tree={tree}
          startday={startday}
          endday={endday}
          location={location}
          graphData={graphData}
          tableData={tableData}
          updateAppState={updateAppState}
        />
      ),
    },
    {
      Header: 'Count',
      accessor: 'count',
      maxWidth: 100,
      filterable: false,
    },
    {
      Header: 'Product',
      accessor: 'product',
      maxWidth: 100,
      filterMethod: (filter, row) => textFilter(filter, row),
    },
    {
      Header: 'Component',
      accessor: 'component',
      maxWidth: 100,
      filterMethod: (filter, row) => textFilter(filter, row),
    },
    {
      Header: 'Summary',
      accessor: 'summary',
      minWidth: 250,
      filterMethod: (filter, row) => textFilter(filter, row),
    },
    {
      Header: 'Whiteboard',
      accessor: 'whiteboard',
      minWidth: 150,
      filterMethod: (filter, row) => textFilter(filter, row),
    },
  ];

  let graphOneData = null;
  let graphTwoData = null;
  let totalFailures = 0;
  let totalRuns = 0;

  if (graphData.length) {
    ({
      graphOneData,
      graphTwoData,
      totalFailures,
      totalRuns,
    } = calculateMetrics(graphData));
  }

  const getHeaderAriaLabel = (state, bug, data) => {
    const ariaLabelValue =
      data.Header === 'Count'
        ? 'Filter not available for count'
        : `Type to filter ${data.Header}`;
    return {
      'aria-label': ariaLabelValue,
    };
  };

  return (
    <Layout
      {...props}
      graphOneData={graphOneData}
      graphTwoData={graphTwoData}
      header={
        initialParamsSet && (
          <React.Fragment>
            <Row>
              <Col xs="12" className="text-left">
                <Breadcrumb listClassName="bg-white">
                  <BreadcrumbItem>
                    <a title="Treeherder home page" href="/#/">
                      Treeherder
                    </a>
                  </BreadcrumbItem>
                  <BreadcrumbItem
                    active
                    title="Intermittent Failures View main page"
                  >
                    Main view
                  </BreadcrumbItem>
                </Breadcrumb>
              </Col>
            </Row>
            <Row>
              <Col xs="12" className="mx-auto pt-3">
                <h1>Intermittent Test Failures</h1>
              </Col>
            </Row>
            <Row>
              <Col xs="12" className="mx-auto">
                <p className="subheader">{`${prettyDate(
                  startday,
                )} to ${prettyDate(endday)} UTC`}</p>
              </Col>
            </Row>
            <Row>
              <Col xs="12" className="mx-auto">
                <p className="text-secondary">
                  {totalFailures} bugs in {totalRuns} pushes
                </p>
              </Col>
            </Row>
          </React.Fragment>
        )
      }
      table={
        initialParamsSet && (
          <ReactTable
            data={tableData}
            showPageSizeOptions
            columns={columns}
            className="-striped"
            getTableProps={() => ({ role: 'table' })}
            getTheadFilterThProps={getHeaderAriaLabel}
            getTrProps={tableRowStyling}
            showPaginationTop
            defaultPageSize={50}
            filterable
          />
        )
      }
      datePicker={<DateRangePicker updateState={updateState} />}
    />
  );
};

MainView.propTypes = {
  location: PropTypes.shape({}).isRequired,
  tree: PropTypes.string.isRequired,
  updateAppState: PropTypes.func,
  updateState: PropTypes.func.isRequired,
  startday: PropTypes.string.isRequired,
  endday: PropTypes.string.isRequired,
  tableData: PropTypes.arrayOf(PropTypes.shape({})),
  graphData: PropTypes.arrayOf(PropTypes.shape({})),
  initialParamsSet: PropTypes.bool.isRequired,
  notify: PropTypes.func.isRequired,
};

MainView.defaultProps = {
  graphData: [],
  tableData: [],
  updateAppState: null,
};

const defaultState = {
  tree: 'trunk',
  startday: ISODate(moment().utc().subtract(7, 'days')),
  endday: ISODate(moment().utc()),
  endpoint: bugsEndpoint,
  route: '/main',
};

export default withView(defaultState)(MainView);
