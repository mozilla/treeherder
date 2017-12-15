import React from "react";
import { connect } from "react-redux";
import { Container, Row, Col } from "reactstrap";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import Icon from "react-fontawesome";
import Navigation from "./Navigation";
import { fetchBugData, updateDateRange, updateTreeName, updateSelectedBugDetails } from "./../redux/actions";
import GenericTable from "./GenericTable";
import GraphsContainer from "./GraphsContainer";
import {
  calculateMetrics, jobsUrl, createApiUrl, logviewerUrl, parseQueryParams, createQueryParams,
  prettyDate, bugzillaBugsApi, updateQueryParams
} from "../helpers";
import { bugDetailsEndpoint, graphsEndpoint } from "../constants";

class BugDetailsView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    this.updateData = this.updateData.bind(this);
  }

  componentDidMount() {
    const { fetchData, from, to, tree, bugId } = this.props;
    fetchData(createApiUrl(SERVICE_DOMAIN, graphsEndpoint, {
      startday: from,
      endday: to,
      tree,
      bug: bugId
    }), "BUG_DETAILS_GRAPHS");
  }

  componentWillReceiveProps(nextProps) {
    const { history, from, to, tree, location, bugId, bugzillaData, summary, updateBugDetails } = nextProps;

    if (location.search !== this.props.location.search) {
      this.updateData(location.search);
    }

    //update query params in the address bar if dates or tree are updated via the UI
    if (from !== this.props.from || to !== this.props.to || tree !== this.props.tree) {
      const queryParams = createQueryParams({ startday: from, endday: to, tree, bug: bugId });
      updateQueryParams("/bugdetails", queryParams, history, this.props.location);
    }

    if (bugzillaData.bugs && bugzillaData.bugs[0].summary !== summary) {
      updateBugDetails(bugzillaData.bugs[0].id, bugzillaData.bugs[0].summary, "BUG_DETAILS");
    }
  }

  updateData(query) {
    const { startday, endday, tree, bug } = parseQueryParams(query);
    const { updateTree, updateDates, fetchData, updateBugDetails, bugId } = this.props;
    const params = { startday, endday, tree, bug };

    updateDates(startday, endday, "BUG_DETAILS");
    updateTree(tree, "BUG_DETAILS");
    fetchData(createApiUrl(SERVICE_DOMAIN, graphsEndpoint, params), "BUG_DETAILS_GRAPHS");
    fetchData(createApiUrl(SERVICE_DOMAIN, bugDetailsEndpoint, params), "BUG_DETAILS");

    if (bug !== bugId) {
      fetchData(bugzillaBugsApi("rest/bug", { include_fields: "summary,id", id: bug }), "BUGZILLA_BUG_DETAILS");
      updateBugDetails(bug, "", "BUG_DETAILS");
    }
  }

  render() {
    const { graphs, tableFailureMessage, graphFailureMessage, from, to, bugDetails, tree, bugId, summary } = this.props;
    const columns = [
      {
        Header: "Push Time",
        accessor: "push_time"
      },
      {
        Header: "Tree",
        accessor: "tree",
      },
      {
        Header: "Revision",
        accessor: "revision",
        Cell: props => <a href={jobsUrl(props.original.tree, props.value)} target="_blank">{props.value}</a>
      },
      {
        Header: "Platform",
        accessor: "platform",
      },
      {
        Header: "Build type",
        accessor: "build_type",
      },
      {
        Header: "Test Suite",
        accessor: "test_suite",
        minWidth: 200,
      },
      {
        Header: "Log",
        accessor: "job_id",
        Cell: props => <a href={logviewerUrl(props.original.tree, props.value)} target="_blank">view details</a>
      }
    ];
    const params = { startday: from, endday: to, tree, bug: bugId };

    let graphOneData = null;
    let graphTwoData = null;

    if (graphs && graphs.length > 0) {
      ({ graphOneData, graphTwoData } = calculateMetrics(graphs));
    }
    return (
      <Container fluid style={{ marginBottom: "5rem", marginTop: "4.5rem", maxWidth: "1200px" }}>
        <Navigation params={params} tableApi={bugDetailsEndpoint} graphApi={graphsEndpoint} bugId={bugId}
                    name="BUG_DETAILS" graphName="BUG_DETAILS_GRAPHS" tree={tree}
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

        {!graphFailureMessage && graphOneData && graphTwoData ?
          <GraphsContainer graphOneData={graphOneData} graphTwoData={graphTwoData} name="BUG_DETAILS" tree={tree}
                           graphName="BUG_DETAILS_GRAPHS" tableApi={bugDetailsEndpoint} params={params}
                           graphApi={graphsEndpoint} bugId={bugId} dateOptions
          /> : <p>{tableFailureMessage}</p>}

        {!tableFailureMessage || (bugDetails && !tableFailureMessage) ?
          <GenericTable bugs={bugDetails.results} columns={columns} name="BUG_DETAILS" tableApi={bugDetailsEndpoint}
                        totalPages={bugDetails.total_pages} params={params} bugId={bugId}
          /> : <p>{tableFailureMessage}</p>}
      </Container>);
  }
}

Container.propTypes = {
  fluid: PropTypes.bool
};

const mapStateToProps = state => ({
  bugDetails: state.bugDetailsData.data,
  graphs: state.bugDetailsGraphData.data,
  tableFailureMessage: state.bugDetailsData.message,
  graphsFailureMessage: state.bugDetailsGraphData.message,
  from: state.bugDetailsDates.from,
  to: state.bugDetailsDates.to,
  tree: state.bugDetailsTree.tree,
  bugId: state.bugDetails.bugId,
  summary: state.bugDetails.summary,
  bugzillaData: state.bugzillaBugDetails.data
});

const mapDispatchToProps = dispatch => ({
  fetchData: (url, name) => dispatch(fetchBugData(url, name)),
  updateDates: (from, to, name) => dispatch(updateDateRange(from, to, name)),
  updateTree: (tree, name) => dispatch(updateTreeName(tree, name)),
  updateBugDetails: (bugId, summary, name) => dispatch(updateSelectedBugDetails(bugId, summary, name))
});

export default connect(mapStateToProps, mapDispatchToProps)(BugDetailsView);
