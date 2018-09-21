import 'react-table/react-table.css';

import React from 'react';
import { Container, Row, Col } from 'reactstrap';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import Icon from 'react-fontawesome';
import ReactTable from 'react-table';

import Navigation from './Navigation';
import GraphsContainer from './GraphsContainer';
import { updateQueryParams, calculateMetrics, prettyDate, validateQueryParams, getData, tableRowStyling, sortData } from './helpers';
import { bugDetailsEndpoint, graphsEndpoint, parseQueryParams, createQueryParams, createApiUrl,
  getJobsUrl, bugzillaBugsApi } from '../helpers/url';
import BugLogColumn from './BugLogColumn';
import ErrorMessages from './ErrorMessages';
import { prettyErrorMessages, errorMessageClass } from './constants';
import ErrorBoundary from '../shared/ErrorBoundary';
import DateOptions from './DateOptions';

export default class BugDetailsView extends React.Component {
  constructor(props) {
    super(props);

    this.updateData = this.updateData.bind(this);
    this.setQueryParams = this.setQueryParams.bind(this);
    this.checkQueryValidation = this.checkQueryValidation.bind(this);
    this.getTableData = this.getTableData.bind(this);
    this.getGraphData = this.getGraphData.bind(this);
    this.updateTable = this.updateTable.bind(this);
    this.updateState = this.updateState.bind(this);
    this.getBugDetails = this.getBugDetails.bind(this);

    this.inheritedState = this.props.location.state;
    this.state = {
                  errorMessages: [],
                  initialParamsSet: this.inheritedState ? true : null,
                  tree: this.inheritedState ? this.inheritedState.tree : null,
                  startday: this.inheritedState ? this.inheritedState.startday : null,
                  endday: this.inheritedState ? this.inheritedState.endday : null,
                  bug: this.inheritedState ? this.inheritedState.id : null,
                  summary: this.inheritedState ? this.inheritedState.summary : null,
                  tableData: {},
                  tableFailureStatus: null,
                  isFetchingTable: false,
                  graphData: [],
                  graphFailureStatus: null,
                  isFetchingGraphs: false,
                  page: 0,
                  pageSize: 20,
                  columnId: null,
                  descending: null,
                  location: this.inheritedState ? this.inheritedState.location : null,
                };
  }

  componentDidMount() {
    this.setQueryParams();
  }

  componentWillReceiveProps(nextProps) {
    const { location } = nextProps;
    // update all data if the user edits dates, tree or bug via the query params
    if (location.search !== this.props.location.search) {
      this.checkQueryValidation(parseQueryParams(location.search), this.state.initialParamsSet);
    }
  }

  setQueryParams() {
    const { location } = this.props;

    // props for bug details is provided by MainView, so if they are missing
    // (user pastes url into address bar) we need to check query strings
    if (!location.state) {
      this.checkQueryValidation(parseQueryParams(location.search));
    } else {
      const { startday, endday, tree, bug } = this.state;

      // table will fetch data during its own componentDidMount lifecycle
      this.getGraphData(createApiUrl(graphsEndpoint, { startday, endday, tree, bug }));
    }
  }

  async getGraphData(url) {
    this.setState({ graphFailureStatus: null, isFetchingGraphs: true });
    const { data, failureStatus } = await getData(url);
    this.setState({ graphData: data, graphFailureStatus: failureStatus, isFetchingGraphs: false });
  }

  async getTableData(url) {
    this.setState({ tableFailureStatus: null, isFetchingTable: true });
    const { data, failureStatus } = await getData(url);
    this.setState({ tableData: data, tableFailureStatus: failureStatus, isFetchingTable: false });
  }

  async getBugDetails(url) {
    const { data } = await getData(url);
    if (data.bugs.length === 1) {
      this.setState({ summary: data.bugs[0].summary });
    }
  }

  updateState(updatedObj) {
    this.setState(updatedObj, () => {
      const { startday, endday, tree, bug } = this.state;

      this.getGraphData(createApiUrl(graphsEndpoint, { startday, endday, tree, bug }));
      this.getTableData(createApiUrl(bugDetailsEndpoint, { startday, endday, tree, bug }));

      // update query params if dates or tree are updated
      const queryString = createQueryParams({ startday, endday, tree, bug });
      updateQueryParams('/bugdetails', queryString, this.props.history, this.props.location);
    });
  }

  updateTable(table) {
    // table's page count starts at 0
    if (table.page + 1 !== this.state.page || table.pageSize !== this.state.pageSize) {
      this.setState({ page: table.page + 1, pageSize: table.pageSize }, () => {
        const { startday, endday, tree, page, pageSize, bug } = this.state;
        this.getTableData(createApiUrl(bugDetailsEndpoint, { startday, endday, tree, page, pageSize, bug }));
      });
    } else if (table.sorted.length > 0) {
      this.setState({ columnId: table.sorted[0].id, descending: table.sorted[0].desc });
    }
  }

  updateData(params, urlChanged = false) {
    this.getGraphData(createApiUrl(graphsEndpoint, params));

    // TODO should we display this only if we actually have data?
    if (params.bug) {
      this.getBugDetails(bugzillaBugsApi('bug', { include_fields: 'summary', id: params.bug }));
    }
    // the table library fetches data directly when its component mounts and in response
    // to a user selecting pagesize or page; this condition will prevent duplicate requests
    // when this component mounts and when the table mounts.
    if (urlChanged) {
      this.getTableData(createApiUrl(bugDetailsEndpoint, params));
    }
  }

  checkQueryValidation(params, urlChanged = false) {
    const messages = validateQueryParams(params, true);
    const { errorMessages, initialParamsSet, summary } = this.state;
    const updates = {};

    if (messages.length > 0) {
      this.setState({ errorMessages: messages });
    } else {
      if (errorMessages.length) {
        updates.errorMessages = [];
      }
      if (!initialParamsSet) {
        updates.initialParamsSet = true;
      }
      if (summary) {
        // reset summary
        updates.summary = null;
      }

      this.setState({ ...updates, ...params });
      this.updateData(params, urlChanged);
    }
  }

  render() {
    const { graphData, columnId, descending, tableData, errorMessages, initialParamsSet, startday, endday,
      tree, isFetchingTable, isFetchingGraphs, tableFailureStatus, graphFailureStatus, bug, summary } = this.state;
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
        Cell: props => <a href={getJobsUrl({ repo: props.original.tree, revision: props.value, selectedJob: props.original.job_id })} target="_blank" rel="noopener noreferrer">{props.value}</a>,
      },
      {
        Header: 'Platform',
        accessor: 'platform',
      },
      {
        Header: 'Build Type',
        accessor: 'build_type',
      },
      {
        Header: 'Test Suite',
        accessor: 'test_suite',
        minWidth: 200,
      },
      {
        Header: 'Machine Name',
        accessor: 'machine_name',
        minWidth: 125,
      },
      {
        Header: 'Log',
        accessor: 'job_id',
        Cell: props => <BugLogColumn {...props} />,
        minWidth: 110,
      },
    ];

    let graphOneData = null;
    let graphTwoData = null;
    let sortedData = [];

    if (graphData.length > 0) {
      ({ graphOneData, graphTwoData } = calculateMetrics(graphData));
    }

    if (columnId) {
      sortedData = sortData([...tableData.results], columnId, descending);
    }

    return (
      <Container fluid style={{ marginBottom: '5rem', marginTop: '4.5rem', maxWidth: '1200px' }}>
        <Navigation
          updateState={this.updateState}
          tree={tree}
        />
        {(isFetchingGraphs || isFetchingTable) &&
          !(tableFailureStatus || graphFailureStatus || errorMessages.length > 0) &&
          <div className="loading">
            <Icon
              spin
              name="cog"
              size="4x"
            />
          </div>}
        {(tableFailureStatus || graphFailureStatus || errorMessages.length > 0) &&
          <ErrorMessages
            failureMessage={tableFailureStatus ? tableData : graphData}
            failureStatus={tableFailureStatus || graphFailureStatus}
            errorMessages={errorMessages}
          />}
        <Row>
          <Col xs="12"><span className="pull-left"><Link to={this.state.location ? this.state.location : '/'}><Icon name="arrow-left" className="pr-1" />
            back</Link></span>
          </Col>
        </Row>
        {errorMessages.length === 0 &&
        <React.Fragment>
          <Row>
            <Col xs="12" className="mx-auto"><h1>Details for Bug {!bug ? '' : bug}</h1></Col>
          </Row>
          <Row>
            <Col xs="12" className="mx-auto"><p className="subheader">{`${prettyDate(startday)} to ${prettyDate(endday)} UTC`}</p>
            </Col>
          </Row>
          {summary &&
          <Row>
            <Col xs="4" className="mx-auto"><p className="text-secondary text-center">{summary}</p></Col>
          </Row>}
          {tableData && tableData.count &&
          <Row>
            <Col xs="12" className="mx-auto"><p className="text-secondary">{tableData.count} total failures</p></Col>
          </Row>}
        </React.Fragment>}

        <ErrorBoundary
          errorClasses={errorMessageClass}
          message={prettyErrorMessages.default}
        >
          {graphOneData && graphTwoData &&
            <GraphsContainer
              graphOneData={graphOneData}
              graphTwoData={graphTwoData}
            >
              <DateOptions
                updateState={this.updateState}
              />
            </GraphsContainer>}
        </ErrorBoundary>

        <ErrorBoundary
          errorClasses={errorMessageClass}
          message={prettyErrorMessages.default}
        >
          {bug && initialParamsSet &&
          <ReactTable
            manual
            data={sortedData.length > 0 ? sortedData : tableData.results}
            onFetchData={this.updateTable}
            pages={tableData.total_pages}
            showPageSizeOptions
            columns={columns}
            className="-striped"
            getTrProps={tableRowStyling}
            showPaginationTop
          />}
        </ErrorBoundary>
      </Container>);
  }
}

Container.propTypes = {
  fluid: PropTypes.bool,
};

BugDetailsView.propTypes = {
  history: PropTypes.shape({}).isRequired,
  location: PropTypes.shape({
    search: PropTypes.string,
  }).isRequired,
};
