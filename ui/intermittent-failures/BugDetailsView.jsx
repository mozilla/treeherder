import React from 'react';
import { connect } from 'react-redux';
import { Container, Row, Col } from 'reactstrap';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import Icon from 'react-fontawesome';

import Navigation from './Navigation';
import { fetchBugData, updateDateRange, updateTreeName, updateSelectedBugDetails } from './redux/actions';
import GenericTable from './GenericTable';
import GraphsContainer from './GraphsContainer';
import { updateQueryParams, calculateMetrics, prettyDate, checkQueryParams } from './helpers';
import { bugDetailsEndpoint, graphsEndpoint, parseQueryParams, createQueryParams, createApiUrl, getJobsUrl,
  bugzillaBugsApi } from '../helpers/url';
import BugLogColumn from './BugLogColumn';

class BugDetailsView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      bugNotFound: false,
    };
    this.updateData = this.updateData.bind(this);
    this.setQueryParams = this.setQueryParams.bind(this);
  }

  componentDidMount() {
    this.setQueryParams();
  }

  componentWillReceiveProps(nextProps) {
    const { history, from, to, tree, location, bugId, bugzillaData, summary, updateBugDetails } = nextProps;
    if (location.search !== this.props.location.search) {
      this.updateData(parseQueryParams(location.search));
    }

    // update query params in the address bar if dates or tree are updated via the UI
    if (from !== this.props.from || to !== this.props.to || tree !== this.props.tree) {
      const queryString = createQueryParams({ startday: from, endday: to, tree, bug: bugId });

      updateQueryParams('/bugdetails', queryString, history, this.props.location);
    }

    if (bugzillaData.bugs && !this.state.bugNotFound) {
      if (bugzillaData.bugs.length === 0) {
        this.setState({ bugNotFound: true });
      } else if (bugzillaData.bugs[0].summary !== summary) {
        updateBugDetails(bugzillaData.bugs[0].id, bugzillaData.bugs[0].summary, 'BUG_DETAILS');
      }
    }

  }

  setQueryParams() {
    const { from, to, tree, location, bugId, fetchData, history } = this.props;

    // data for bug details is provided by MainView, so if the default props are undefined
    // or query strings are missing (user pastes url into address bar), set default values,
    // update url with new query params and update all data
    if (!from || !to || !tree || !bugId) {
      const params = checkQueryParams(parseQueryParams(location.search));
      const queryString = createQueryParams(params);
      updateQueryParams('/bugdetails', queryString, history, location);
      this.updateData(params);
    } else {
      fetchData(createApiUrl(graphsEndpoint, { startday: from, endday: to, tree, bug: bugId }), 'BUG_DETAILS_GRAPHS');
    }
  }

  updateData(params) {
    const { startday, endday, tree, bug } = params;
    const { updateTree, updateDates, fetchData, updateBugDetails, bugId } = this.props;

    updateDates(startday, endday, 'BUG_DETAILS');
    updateTree(tree, 'BUG_DETAILS');
    fetchData(createApiUrl(graphsEndpoint, params), 'BUG_DETAILS_GRAPHS');
    fetchData(createApiUrl(bugDetailsEndpoint, params), 'BUG_DETAILS');

    if (bug !== bugId) {
      updateBugDetails(bug, '', 'BUG_DETAILS');
      fetchData(bugzillaBugsApi('rest/bug', { include_fields: 'summary,id', id: bug }), 'BUGZILLA_BUG_DETAILS');
    }
  }

  render() {
    const { graphs, tableFailureMessage, graphFailureMessage, from, to, bugDetails, tree, bugId, summary } = this.props;
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
        Cell: props => <a href={getJobsUrl({ repo: props.original.tree, revision: props.value, selectedJob: props.original.job_id })} target="_blank">{props.value}</a>,
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
    const params = { startday: from, endday: to, tree, bug: bugId };

    let graphOneData = null;
    let graphTwoData = null;

    if (graphs && graphs.length > 0) {
      ({ graphOneData, graphTwoData } = calculateMetrics(graphs));
    }
    return (
      <Container fluid style={{ marginBottom: '5rem', marginTop: '4.5rem', maxWidth: '1200px' }}>
        <Navigation
          params={params}
          tableApi={bugDetailsEndpoint}
          graphApi={graphsEndpoint}
          bugId={bugId}
          name="BUG_DETAILS"
          graphName="BUG_DETAILS_GRAPHS"
          tree={tree}
        />
        <Row>
          <Col xs="12"><span className="pull-left"><Link to="/"><Icon name="arrow-left" className="pr-1" />
            back</Link></span>
          </Col>
        </Row>
        <Row>
          <Col xs="12" className="mx-auto"><h1>{`Details for Bug ${bugId}`}</h1></Col>
        </Row>
        <Row>
          <Col xs="12" className="mx-auto"><p className="subheader">{`${prettyDate(from)} to ${prettyDate(to)} UTC`}</p>
          </Col>
        </Row>
        {summary &&
        <Row>
          <Col xs="4" className="mx-auto"><p className="text-secondary text-center">{summary}</p></Col>
        </Row>}
        {bugDetails &&
        <Row>
          <Col xs="12" className="mx-auto"><p className="text-secondary">{bugDetails.count} total failures</p></Col>
        </Row>}

        {this.state.bugNotFound ?
          <div className="pt-3">Can&apos;t find data for this bug.</div> :
          <React.Fragment>
            {!graphFailureMessage && graphOneData && graphTwoData ?
              <GraphsContainer
                graphOneData={graphOneData}
                graphTwoData={graphTwoData}
                name="BUG_DETAILS"
                tree={tree}
                graphName="BUG_DETAILS_GRAPHS"
                tableApi={bugDetailsEndpoint}
                params={params}
                graphApi={graphsEndpoint}
                bugId={bugId}
                dateOptions
              /> : <p>{tableFailureMessage}</p>}

            {!tableFailureMessage || (bugDetails && bugId) ?
              <GenericTable
                bugs={bugDetails.results}
                columns={columns}
                name="BUG_DETAILS"
                tableApi={bugDetailsEndpoint}
                totalPages={bugDetails.total_pages}
                params={params}
                bugId={bugId}
              /> : <p>{tableFailureMessage}</p>}
          </React.Fragment>}
      </Container>);
  }
}

Container.propTypes = {
  fluid: PropTypes.bool,
};

BugDetailsView.propTypes = {
  bugDetails: PropTypes.oneOfType([
    PropTypes.shape({}),
    PropTypes.shape({
      count: PropTypes.number,
      total_pages: PropTypes.number,
      results: PropTypes.arrayOf(
        PropTypes.shape({
          push_time: PropTypes.string.isRequired,
          platform: PropTypes.string.isRequired,
          revision: PropTypes.string.isRequired,
          test_suite: PropTypes.string.isRequired,
          tree: PropTypes.string.isRequired,
          build_type: PropTypes.string.isRequired,
          job_id: PropTypes.number.isRequired,
          bug_id: PropTypes.number.isRequired,
        }),
      ),
    }),
  ]),
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
        summary: PropTypes.string,
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
  updateBugDetails: PropTypes.func,
  from: PropTypes.string.isRequired,
  to: PropTypes.string.isRequired,
  tree: PropTypes.string.isRequired,
  bugId: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]),
  summary: PropTypes.string,
  tableFailureMessage: PropTypes.string,
  graphFailureMessage: PropTypes.string,
};

BugDetailsView.defaultProps = {
  tableFailureMessage: '',
  graphFailureMessage: '',
  fetchData: null,
  updateTree: null,
  updateDates: null,
  updateBugDetails: null,
  bugDetails: null,
  bugId: null,
  summary: null,
};

const mapStateToProps = state => ({
  bugDetails: state.bugDetailsData.data,
  graphs: state.bugDetailsGraphData.data,
  tableFailureMessage: state.bugDetailsData.message,
  graphFailureMessage: state.bugDetailsGraphData.message,
  from: state.bugDetailsDates.from,
  to: state.bugDetailsDates.to,
  tree: state.bugDetailsTree.tree,
  bugId: state.bugDetails.bugId,
  summary: state.bugDetails.summary,
  bugzillaData: state.bugzillaBugDetails.data,
});

const mapDispatchToProps = dispatch => ({
  fetchData: (url, name) => dispatch(fetchBugData(url, name)),
  updateDates: (from, to, name) => dispatch(updateDateRange(from, to, name)),
  updateTree: (tree, name) => dispatch(updateTreeName(tree, name)),
  updateBugDetails: (bugId, summary, name) => dispatch(updateSelectedBugDetails(bugId, summary, name)),
});

export default connect(mapStateToProps, mapDispatchToProps)(BugDetailsView);
