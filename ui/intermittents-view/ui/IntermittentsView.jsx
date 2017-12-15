import React from "react";
import { connect } from "react-redux";
import { Container, Row, Col } from "reactstrap";
import PropTypes from "prop-types";
import Navigation from "./Navigation";
import GenericTable from "./GenericTable";
import { fetchBugData, updateTreeName, updateDateRange, fetchBugsThenBugzilla } from "./../redux/actions";
import BugColumn from "./BugColumn";
import {
  createApiUrl, calculateMetrics, mergeBugsData, parseQueryParams, createQueryParams,
  prettyDate, updateQueryParams
} from "../helpers";
import GraphsContainer from "./GraphsContainer";
import { bugsEndpoint, graphsEndpoint } from "../constants";

class IntermittentsView extends React.Component {
  constructor(props) {
    super(props);
    this.updateData = this.updateData.bind(this);
  }

  componentDidMount() {
    const { graphs, from, to, tree, fetchData } = this.props;
    if (!graphs.results) {
      fetchData(createApiUrl(SERVICE_DOMAIN, graphsEndpoint, { startday: from, endday: to, tree }), "BUGS_GRAPHS");
    }
  }

  componentWillReceiveProps(nextProps) {
    const { from, to, tree, location, history } = nextProps;

    //update all data if the user edits dates or tree via the query params
    if (location.search !== this.props.location.search) {
      this.updateData(location.search);
    }
    //update query params if dates or tree are updated via the UI
    if (from !== this.props.from || to !== this.props.to || tree !== this.props.tree) {
      const queryParams = createQueryParams({ startday: from, endday: to, tree });
      updateQueryParams("/main", queryParams, history, this.props.location);
    }
  }

  updateData(params) {
    const { startday, endday, tree } = parseQueryParams(params);
    const { updateTree, updateDates, fetchData, fetchFullBugData } = this.props;
    updateDates(startday, endday, "BUGS");
    updateTree(tree, "BUGS");
    fetchData(createApiUrl(SERVICE_DOMAIN, graphsEndpoint, { startday, endday, tree }), "BUGS_GRAPHS");
    fetchFullBugData(createApiUrl(SERVICE_DOMAIN, bugsEndpoint, { startday, endday, tree }), "BUGS");
  }

  render() {
    const { bugs, tableFailureMessage, graphFailureMessage, from, to, tree, bugzillaData, graphs } = this.props;
    const columns = [
      {
        Header: "Bug ID",
        accessor: "id",
        Cell: props => <BugColumn data={props.original} />
      },
      {
        Header: "Count",
        accessor: "count",
        maxWidth: 100,
      },
      {
        Header: "Summary",
        accessor: "summary",
        minWidth: 250,
      },
      {
        Header: "Whiteboard",
        accessor: "whiteboard",
        minWidth: 150
      }
    ];

    let bugsData = [];
    let graphOneData = null;
    let graphTwoData = null;
    let totalFailures = 0;
    let totalRuns = 0;

    if (bugs.results && bugzillaData.bugs && bugzillaData.bugs.length > 0) {
      bugsData = mergeBugsData(bugs.results, bugzillaData.bugs);
    }

    if (graphs && graphs.length > 0) {
      ({ graphOneData, graphTwoData, totalFailures, totalRuns } = calculateMetrics(graphs));
    }

    const params = { startday: from, endday: to, tree };

    return (
      <Container fluid style={{ marginBottom: "5rem", marginTop: "5rem", maxWidth: "1200px" }}>
        <Navigation
          name="BUGS" graphName="BUGS_GRAPHS" tableApi={bugsEndpoint} params={params}
          graphApi={graphsEndpoint} tree={tree}
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
            graphOneData={graphOneData} graphTwoData={graphTwoData} name="BUGS" params={params}
            graphName="BUGS_GRAPHS" tableApi={bugsEndpoint} graphApi={graphsEndpoint} tree={tree}
          /> : <p>{tableFailureMessage}</p>}

        {!tableFailureMessage ?
          <GenericTable bugs={bugsData} columns={columns} name="BUGS" tableApi={bugsEndpoint} params={params}
                        totalPages={bugs.total_pages} trStyling updateTable={this.updateTable}
          /> : <p>{tableFailureMessage}</p>}
      </Container>);
  }
}

Container.propTypes = {
  fluid: PropTypes.bool
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
  updateTree: (tree, name) => dispatch(updateTreeName(tree, name))
});

export default connect(mapStateToProps, mapDispatchToProps)(IntermittentsView);
