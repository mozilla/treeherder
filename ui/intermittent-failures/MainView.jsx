import React from 'react';
import { Row, Col } from 'reactstrap';
import PropTypes from 'prop-types';
import moment from 'moment';
import ReactTable from 'react-table';
import 'react-table/react-table.css';

import BugColumn from './BugColumn';
import { calculateMetrics, prettyDate, ISODate, tableRowStyling } from './helpers';
import { bugsEndpoint } from '../helpers/url';
import withView from './View';
import Layout from './Layout';
import DateRangePicker from './DateRangePicker';

const MainView = (props) => {
  const { graphData, tableData, initialParamsSet, startday, endday, updateState,
    tree, location, updateAppState } = props;

  const columns = [
    {
      Header: 'Bug',
      accessor: 'id',
      headerClassName: 'bug-column-header',
      className: 'bug-column',
      maxWidth: 150,
      Cell: _props =>
      (<BugColumn
        data={_props.original}
        tree={tree}
        startday={startday}
        endday={endday}
        location={location}
        graphData={graphData}
        tableData={tableData}
        updateAppState={updateAppState}
      />),
    },
    {
      Header: 'Count',
      accessor: 'count',
      maxWidth: 100,
    },
    {
      Header: 'Summary',
      accessor: 'summary',
      minWidth: 250,
    },
    {
      Header: 'Whiteboard',
      accessor: 'whiteboard',
      minWidth: 150,
    },
  ];

  let graphOneData = null;
  let graphTwoData = null;
  let totalFailures = 0;
  let totalRuns = 0;

  if (graphData.length) {
    ({ graphOneData, graphTwoData, totalFailures, totalRuns } = calculateMetrics(graphData));
  }

  return (
    <Layout
      {...props}
      graphOneData={graphOneData}
      graphTwoData={graphTwoData}
      header={
        initialParamsSet &&
        <React.Fragment>
          <Row>
            <Col xs="12" className="mx-auto pt-3"><h1>Intermittent Test Failures</h1></Col>
          </Row>
          <Row>
            <Col xs="12" className="mx-auto"><p className="subheader">{`${prettyDate(startday)} to ${prettyDate(endday)} UTC`}</p>
            </Col>
          </Row>
          <Row>
            <Col xs="12" className="mx-auto"><p className="text-secondary">{totalFailures} bugs in {totalRuns} pushes</p>
            </Col>
          </Row>
        </React.Fragment>
      }
      table={
        initialParamsSet &&
        <ReactTable
          data={tableData}
          showPageSizeOptions
          columns={columns}
          className="-striped"
          getTrProps={tableRowStyling}
          showPaginationTop
          defaultPageSize={50}
        />
      }
      datePicker={
        <DateRangePicker
          updateState={updateState}
        />
      }
    />
  );
};

MainView.propTypes = {
  location: PropTypes.shape({}).isRequired,
};

const defaultState = {
  tree: 'trunk',
  startday: ISODate(moment().utc().subtract(7, 'days')),
  endday: ISODate(moment().utc()),
  route: '/main',
  endpoint: bugsEndpoint,
};

export default withView(defaultState)(MainView);
