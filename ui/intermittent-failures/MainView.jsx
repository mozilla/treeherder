import React from 'react';
import { connect } from 'react-redux';
import { Container, Row, Col } from 'reactstrap';
import PropTypes from 'prop-types';
import Icon from 'react-fontawesome';

import Navigation from './Navigation';
import GenericTable from './GenericTable';
import { fetchBugData, updateTreeName, updateDateRange, fetchBugsThenBugzilla } from './redux/actions';
import BugColumn from './BugColumn';
import { updateQueryParams, mergeData, calculateMetrics, prettyDate, validateQueryParams } from './helpers';
import GraphsContainer from './GraphsContainer';
import { bugsEndpoint, graphsEndpoint, parseQueryParams, createQueryParams, createApiUrl } from '../helpers/url';
import ErrorMessages from './ErrorMessages';
import { stateName } from './constants';
import ErrorBoundary from './ErrorBoundary';

class MainView extends React.Component {
  constructor(props) {
    super(props);
    this.updateData = this.updateData.bind(this);
    this.setQueryParams = this.setQueryParams.bind(this);
    this.checkQueryValidation = this.checkQueryValidation.bind(this);

    this.state = {
                    errorMessages: [],
                    initialParamsSet: null,
                  };
  }

  componentDidMount() {
    this.setQueryParams();
  }

  componentWillReceiveProps(nextProps) {
    const { from, to, tree, location, history } = nextProps;

    // update all data if the user edits dates or tree via the query params
    if (location.search !== this.props.location.search) {
      this.checkQueryValidation(parseQueryParams(location.search), this.state.initialParamsSet);
    }
    // update query params if dates or tree are updated
    if (from !== this.props.from || to !== this.props.to || tree !== this.props.tree) {
      const queryString = createQueryParams({ startday: from, endday: to, tree });
      if (queryString !== location.search) {
        updateQueryParams('/main', queryString, history, this.props.location);
      }
    }
  }

  setQueryParams() {
    const { from, to, tree, location, history, graphs, fetchData } = this.props;
    // if the query params are not specified, set params based on default props
    // otherwise update data based on the params
    if (location.search === '') {
      const params = { startday: from, endday: to, tree };
      const queryString = createQueryParams(params);

      this.setState({ initialParamsSet: true });
      updateQueryParams('/main', queryString, history, location);

      if (Object.keys(graphs).length === 0) {
        // only fetch graph data on initial page load; table component fetches
        // data when being mounted
        fetchData(createApiUrl(graphsEndpoint, params), stateName.mainViewGraphs);
      }
    } else {
      // show an error message if query strings are missing when url is pasted into
      // address bar, otherwise fetch data
      this.checkQueryValidation(parseQueryParams(location.search));
    }
  }

  checkQueryValidation(params, urlChanged = false) {
    const messages = validateQueryParams(params);
    const { errorMessages, initialParamsSet } = this.state;

    if (messages.length > 0) {
      this.setState({ errorMessages: messages });
    } else {
      if (errorMessages.length > 0) {
        this.setState({ errorMessages: [] });
      }
      if (!initialParamsSet) {
        this.setState({ initialParamsSet: true });
      }

      this.updateData(params, urlChanged);
    }
  }

  updateData(params, urlChanged) {
    const { startday, endday, tree } = params;
    const { updateTree, updateDates, fetchData, fetchFullBugData } = this.props;

    updateDates(startday, endday, stateName.mainView);
    updateTree(tree, stateName.mainView);
    fetchData(createApiUrl(graphsEndpoint, params), stateName.mainViewGraphs);

    // the table library fetches data directly when its component mounts and in response
    // to a user selecting pagesize or page; this condition will prevent duplicate requests
    // when this component mounts and when the table mounts.
    if (urlChanged) {
      fetchFullBugData(createApiUrl(bugsEndpoint, params), stateName.mainView);
    }
  }

  render() {
    const { bugs, tableFailureMessage, graphFailureMessage, from, to, tree, bugzillaData, graphs,
      tableFailureStatus, graphFailureStatus, isFetchingBugs, isFetchingGraphs } = this.props;
    const columns = [
      {
        Header: 'Bug',
        accessor: 'id',
        headerClassName: 'bug-column-header',
        className: 'bug-column',
        maxWidth: 150,
        Cell: props => <BugColumn data={props.original} />,
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

    let bugsData = [];
    let graphOneData = null;
    let graphTwoData = null;
    let totalFailures = 0;
    let totalRuns = 0;

    if (bugs.results && bugzillaData.bugs && bugzillaData.bugs.length > 0) {
      bugsData = mergeData(bugs.results, bugzillaData.bugs);
    }

    if (graphs && graphs.length > 0) {
      ({ graphOneData, graphTwoData, totalFailures, totalRuns } = calculateMetrics(graphs));
    }
    const params = { startday: from, endday: to, tree };
    const { errorMessages, initialParamsSet } = this.state;

    return (
      <Container fluid style={{ marginBottom: '5rem', marginTop: '5rem', maxWidth: '1200px' }}>
        <Navigation
          name={stateName.mainView}
          graphName={stateName.mainViewGraphs}
          tableApi={bugsEndpoint}
          params={params}
          graphApi={graphsEndpoint}
          tree={tree}
        />
        {(isFetchingGraphs || isFetchingBugs) &&
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
            failureMessage={tableFailureStatus ? tableFailureMessage : graphFailureMessage}
            failureStatus={tableFailureStatus || graphFailureStatus}
            errorMessages={errorMessages}
          />}
        <Row>
          <Col xs="12" className="mx-auto pt-3"><h1>Intermittent Test Failures</h1></Col>
        </Row>
        <Row>
          <Col xs="12" className="mx-auto"><p className="subheader">{`${prettyDate(from)} to ${prettyDate(to)} UTC`}</p>
          </Col>
        </Row>
        <Row>
          <Col xs="12" className="mx-auto"><p className="text-secondary">{totalFailures} bugs in {totalRuns} pushes</p>
          </Col>
        </Row>

        <ErrorBoundary
          stateName={stateName.mainViewGraphs}
        >
          {graphOneData && graphTwoData &&
          <GraphsContainer
            graphOneData={graphOneData}
            graphTwoData={graphTwoData}
            name={stateName.mainView}
            params={params}
            graphName={stateName.mainViewGraphs}
            tableApi={bugsEndpoint}
            graphApi={graphsEndpoint}
            tree={tree}
          />}
        </ErrorBoundary>

        <ErrorBoundary
          stateName={stateName.mainView}
        >
          {initialParamsSet &&
            <GenericTable
              bugs={bugsData}
              columns={columns}
              name={stateName.mainView}
              tableApi={bugsEndpoint}
              params={params}
              totalPages={bugs.total_pages}
              trStyling
            />}
        </ErrorBoundary>
      </Container>);
  }
}

Container.propTypes = {
  fluid: PropTypes.bool,
};

MainView.propTypes = {
  bugs: PropTypes.oneOfType([
    PropTypes.shape({}),
    PropTypes.shape({
      count: PropTypes.number,
      total_pages: PropTypes.number,
      results: PropTypes.arrayOf(
        PropTypes.shape({
          bug_id: PropTypes.number,
          bug_count: PropTypes.number,
        }),
      ),
    }),
  ]).isRequired,
  graphs: PropTypes.oneOfType([
    PropTypes.shape({}),
    PropTypes.arrayOf(
      PropTypes.shape({
        failure_count: PropTypes.number,
        test_runs: PropTypes.number,
        date: PropTypes.string,
      }),
    ),
  ]).isRequired,
  bugzillaData: PropTypes.shape({
    bugs: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.number,
        failureStatus: PropTypes.string,
        summary: PropTypes.string,
        whiteboard: PropTypes.string,
      }),
    ),
  }).isRequired,
  history: PropTypes.shape({}).isRequired,
  location: PropTypes.shape({
    search: PropTypes.string,
  }).isRequired,
  fetchData: PropTypes.func,
  updateDates: PropTypes.func,
  updateTree: PropTypes.func,
  fetchFullBugData: PropTypes.func,
  from: PropTypes.string.isRequired,
  to: PropTypes.string.isRequired,
  tree: PropTypes.string.isRequired,
  tableFailureMessage: PropTypes.object,
  graphFailureMessage: PropTypes.object,
  tableFailureStatus: PropTypes.number,
  graphFailureStatus: PropTypes.number,
  isFetchingBugs: PropTypes.bool,
  isFetchingGraphs: PropTypes.bool,
};

MainView.defaultProps = {
  tableFailureMessage: null,
  graphFailureMessage: null,
  tableFailureStatus: null,
  graphFailureStatus: null,
  fetchData: null,
  updateTree: null,
  updateDates: null,
  fetchFullBugData: null,
  isFetchingBugs: null,
  isFetchingGraphs: null,
};

const mapStateToProps = state => ({
  bugs: state.bugsData.data,
  graphs: state.bugsGraphData.data,
  isFetchingBugs: state.bugsData.isFetching,
  isFetchingGraphs: state.bugsGraphData.isFetching,
  tableFailureMessage: state.bugsData.message,
  tableFailureStatus: state.bugsData.failureStatus,
  graphFailureMessage: state.bugsGraphData.message,
  graphFailureStatus: state.bugsGraphData.failureStatus,
  from: state.dates.from,
  to: state.dates.to,
  tree: state.mainTree.tree,
  bugzillaData: state.bugzilla.data,
});

const mapDispatchToProps = dispatch => ({
  fetchData: (url, name) => dispatch(fetchBugData(url, name)),
  fetchFullBugData: (url, name) => dispatch(fetchBugsThenBugzilla(url, name)),
  updateDates: (from, to, name) => dispatch(updateDateRange(from, to, name)),
  updateTree: (tree, name) => dispatch(updateTreeName(tree, name)),
});

export default connect(mapStateToProps, mapDispatchToProps)(MainView);
