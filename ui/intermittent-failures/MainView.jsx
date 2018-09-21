import moment from 'moment';
import React from 'react';
import { Container, Row, Col } from 'reactstrap';
import PropTypes from 'prop-types';
import Icon from 'react-fontawesome';

import Navigation from './Navigation';
import BugColumn from './BugColumn';
import { updateQueryParams, mergeData, calculateMetrics, prettyDate, validateQueryParams, formatBugs, getData,
  ISODate } from './helpers';
import GraphsContainer from './GraphsContainer';
import { bugsEndpoint, graphsEndpoint, parseQueryParams, createQueryParams, createApiUrl,
  bugzillaBugsApi } from '../helpers/url';
import ErrorMessages from './ErrorMessages';
import { prettyErrorMessages, errorMessageClass } from './constants';
import ErrorBoundary from '../shared/ErrorBoundary';
import DateRangePicker from './DateRangePicker';
import GenericTable from './GenericTable';

export default class MainView extends React.Component {
  constructor(props) {
    super(props);
    this.updateData = this.updateData.bind(this);
    this.setQueryParams = this.setQueryParams.bind(this);
    this.checkQueryValidation = this.checkQueryValidation.bind(this);
    this.updateState = this.updateState.bind(this);
    this.getGraphData = this.getGraphData.bind(this);
    this.getFullBugData = this.getFullBugData.bind(this);

    this.state = {
                    errorMessages: [],
                    initialParamsSet: null,
                    tree: 'trunk',
                    startday: ISODate(moment().utc().subtract(7, 'days')),
                    endday: ISODate(moment().utc()),
                    tableData: {},
                    tableFailureStatus: null,
                    isFetchingTable: false,
                    graphData: [],
                    graphFailureStatus: null,
                    isFetchingGraphs: false,
                    page: 0,
                    pageSize: 20,
                  };
  }

  componentDidMount() {
    // TODO graphData should not be refetched when navigating back from bugdetails view
    this.setQueryParams();
  }

  componentWillReceiveProps(nextProps) {
    const { location } = nextProps;
    // update all data if the user edits dates or tree via the query params
    if (location.search !== this.props.location.search) {
      this.checkQueryValidation(parseQueryParams(location.search), this.state.initialParamsSet);
    }
  }

  setQueryParams() {
    const { location, history } = this.props;
    const { startday, endday, tree, graphData } = this.state;
    // if the query params are not specified, set params based on default state
    // otherwise update data based on the params
    if (location.search === '') {
      const params = { startday, endday, tree };
      const queryString = createQueryParams(params);

      this.setState({ initialParamsSet: true });
      updateQueryParams('/main', queryString, history, location);

      if (!Object.keys(graphData).length) {
        // only fetch graph data on initial page load; table component fetches
        // data when being mounted
        this.getGraphData(createApiUrl(graphsEndpoint, params));
      }
    } else {
      // show an error message if query strings are missing when url is pasted into
      // address bar, otherwise fetch data
      this.checkQueryValidation(parseQueryParams(location.search));
    }
  }

  async getGraphData(url) {
    this.setState({ graphFailureStatus: null, isFetchingGraphs: true });
    const { data, failureStatus } = await getData(url);
    this.setState({ graphData: data, graphFailureStatus: failureStatus, isFetchingGraphs: false });
  }

  async getFullBugData(url) {
    this.setState({ tableFailureStatus: null, isFetchingTable: true });
    const { data, failureStatus } = await getData(url);

    if (!failureStatus) {
      const bugs_list = formatBugs(data.results);
      const bugzillaUrl = bugzillaBugsApi('bug', {
        include_fields: 'id,status,summary,whiteboard',
        id: bugs_list,
      });
      const bugzillaData = await getData(bugzillaUrl);
      const results = mergeData(data.results, bugzillaData.data.bugs);
      data.results = results;
    }
    this.setState({ tableData: data, tableFailureStatus: failureStatus, isFetchingTable: false });
  }

  updateState(updatedObj, updateTable = false) {
    this.setState(updatedObj, () => {
      const { startday, endday, tree, page, pageSize } = this.state;
      const params = { startday, endday, tree, page, pageSize };

      if (!updateTable) {
        this.getGraphData(createApiUrl(graphsEndpoint, params));
      }
      this.getFullBugData(createApiUrl(bugsEndpoint, params));

      // update query params if dates or tree are updated
      const queryString = createQueryParams(params);
      updateQueryParams('/main', queryString, this.props.history, this.props.location);
    });
  }

  updateData(params, urlChanged) {
    this.getGraphData(createApiUrl(graphsEndpoint, params));

    // the table library fetches data directly when its component mounts and in response
    // to a user selecting pagesize or page; this condition will prevent duplicate requests
    // when this component mounts and when the table mounts.
    if (urlChanged) {
      this.getFullBugData(createApiUrl(bugsEndpoint, params));
    }
  }

  checkQueryValidation(params, urlChanged = false) {
    const messages = validateQueryParams(params);
    const { errorMessages, initialParamsSet } = this.state;
    const updates = {};

    if (messages.length) {
      this.setState({ errorMessages: messages });
    } else {
      if (errorMessages.length) {
        updates.errorMessages = [];
      }
      if (!initialParamsSet) {
        updates.initialParamsSet = true;
      }

      this.setState({ ...updates, ...params });
      this.updateData(params, urlChanged);
    }
  }

  render() {
    const { graphData, tableData, errorMessages, initialParamsSet, startday, endday,
      tree, isFetchingTable, isFetchingGraphs, tableFailureStatus, graphFailureStatus } = this.state;

    const columns = [
      {
        Header: 'Bug',
        accessor: 'id',
        headerClassName: 'bug-column-header',
        className: 'bug-column',
        maxWidth: 150,
        Cell: props => <BugColumn data={props.original} tree={tree} startday={startday} endday={endday} location={this.props.location} />,
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
      <Container fluid style={{ marginBottom: '5rem', marginTop: '5rem', maxWidth: '1200px' }}>
        <Navigation
          updateState={this.updateState}
          tree={tree}
        />
        {(isFetchingGraphs || isFetchingTable) &&
          !(tableFailureStatus || graphFailureStatus || errorMessages.length) &&
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

        <ErrorBoundary
          errorClasses={errorMessageClass}
          message={prettyErrorMessages.default}
        >
          {graphOneData && graphTwoData &&
          <GraphsContainer
            graphOneData={graphOneData}
            graphTwoData={graphTwoData}
          >
            <DateRangePicker
              updateState={this.updateState}
            />
          </GraphsContainer>}
        </ErrorBoundary>

        <ErrorBoundary
          errorClasses={errorMessageClass}
          message={prettyErrorMessages.default}
        >
          {initialParamsSet &&
          <GenericTable
            totalPages={tableData.total_pages}
            columns={columns}
            data={tableData.results}
            updateState={this.updateState}
          />}
        </ErrorBoundary>
      </Container>);
  }
}

Container.propTypes = {
  fluid: PropTypes.bool,
};

MainView.propTypes = {
  history: PropTypes.shape({}).isRequired,
  location: PropTypes.shape({
    search: PropTypes.string,
  }).isRequired,
};

