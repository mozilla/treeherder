import React from 'react';
import { connect } from 'react-redux';
import { Container, Row, Col } from 'reactstrap';
import PropTypes from 'prop-types';

import Navigation from './Navigation';
import GenericTable from './GenericTable';
import { fetchBugData, updateTreeName, updateDateRange, fetchBugsThenBugzilla } from './redux/actions';
import BugColumn from './BugColumn';
import { updateQueryParams, mergeData, calculateMetrics, prettyDate } from './helpers';
import GraphsContainer from './GraphsContainer';
import { bugsEndpoint, graphsEndpoint, parseQueryParams, createQueryParams, createApiUrl } from '../helpers/urlHelper';

class MainView extends React.Component {
  constructor(props) {
    super(props);
    this.updateData = this.updateData.bind(this);
    this.setQueryParams = this.setQueryParams.bind(this);
  }

  componentDidMount() {
    this.setQueryParams();
  }

  componentWillReceiveProps(nextProps) {
    const { from, to, tree, location, history } = nextProps;

    // update all data if the user edits dates or tree via the query params
    if (location.search !== this.props.location.search) {
      this.updateData(parseQueryParams(location.search));
    }
    // update query params if dates or tree are updated via the UI
    if (from !== this.props.from || to !== this.props.to || tree !== this.props.tree) {
      const queryParams = createQueryParams({ startday: from, endday: to, tree });

      updateQueryParams('/main', queryParams, history, this.props.location);
    }
  }

  setQueryParams() {
    const { from, to, tree, location, history, graphs, fetchData } = this.props;

    // if the query params are not specified, set params based on default props
    // otherwise update data based on the params
    if (location.search === '') {
      const params = { startday: from, endday: to, tree };
      const queryParams = createQueryParams(params);

      updateQueryParams('/main', queryParams, history, location);

      if (Object.keys(graphs).length === 0) {
        // only fetch graph data on initial page load
        fetchData(createApiUrl(graphsEndpoint, params), 'BUGS_GRAPHS');
      }
    } else {
      this.updateData(parseQueryParams(location.search));
    }
  }

  updateData(params) {
    const { startday, endday, tree } = params;
    const { updateTree, updateDates, fetchData, fetchFullBugData } = this.props;

    updateDates(startday, endday, 'BUGS');
    updateTree(tree, 'BUGS');
    fetchData(createApiUrl(graphsEndpoint, params), 'BUGS_GRAPHS');
    fetchFullBugData(createApiUrl(bugsEndpoint, params), 'BUGS');
  }

  render() {
    const { bugs, tableFailureMessage, graphFailureMessage, from, to, tree, bugzillaData, graphs } = this.props;
    const columns = [
      {
        Header: 'Bug ID',
        accessor: 'id',
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
    return (
      <Container fluid style={{ marginBottom: '5rem', marginTop: '5rem', maxWidth: '1200px' }}>
        <Navigation
          name="BUGS"
          graphName="BUGS_GRAPHS"
          tableApi={bugsEndpoint}
          params={params}
          graphApi={graphsEndpoint}
          tree={tree}
        />
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

        {!graphFailureMessage && graphOneData && graphTwoData ?
          <GraphsContainer
            graphOneData={graphOneData}
            graphTwoData={graphTwoData}
            name="BUGS"
            params={params}
            graphName="BUGS_GRAPHS"
            tableApi={bugsEndpoint}
            graphApi={graphsEndpoint}
            tree={tree}
          /> : <p>{tableFailureMessage}</p>}

        {!tableFailureMessage ?
          <GenericTable
            bugs={bugsData}
            columns={columns}
            name="BUGS"
            tableApi={bugsEndpoint}
            params={params}
            totalPages={bugs.total_pages}
            trStyling
            updateTable={this.updateTable}
          /> : <p>{tableFailureMessage}</p>}
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
        status: PropTypes.string,
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
  tableFailureMessage: PropTypes.string,
  graphFailureMessage: PropTypes.string,
};

MainView.defaultProps = {
  tableFailureMessage: '',
  graphFailureMessage: '',
  fetchData: null,
  updateTree: null,
  updateDates: null,
  fetchFullBugData: null,
};

const mapStateToProps = state => ({
  bugs: state.bugsData.data,
  graphs: state.bugsGraphData.data,
  tableFailureMessage: state.bugsData.message,
  graphsFailureMessage: state.bugsGraphData.message,
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
