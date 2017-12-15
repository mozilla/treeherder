import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Collapse, Navbar, Nav, UncontrolledDropdown, DropdownToggle } from "reactstrap";
import { updateTreeName, fetchBugData, fetchBugsThenBugzilla } from "./../redux/actions";
import { createApiUrl } from "../helpers";
import DropdownMenuItems from "./DropdownMenuItems";

class Navigation extends React.Component {
  constructor(props) {
    super(props);
    this.state = { isOpen: false };

    this.toggle = this.toggle.bind(this);
    this.updateData = this.updateData.bind(this);
  }

  toggle() {
    this.setState({ isOpen: !this.state.isOpen });
  }

  updateData(tree) {
    const { updateTree, fetchData, fetchFullBugData, name, graphName, params, bugId, tableApi, graphApi } = this.props;
    params.tree = tree;
    if (bugId) {
      fetchData(createApiUrl(SERVICE_DOMAIN, tableApi, params), name);
    } else {
      fetchFullBugData(createApiUrl(SERVICE_DOMAIN, tableApi, params), name);
    }
    fetchData(createApiUrl(SERVICE_DOMAIN, graphApi, params), graphName);
    updateTree(tree, name);
  }

  render() {
    const treeOptions = ["trunk", "autoland"];
    return (
      <Navbar expand fixed="top" className="top-navbar">
        <span className="lightorange">Intermittents View </span>
        <Collapse isOpen={this.state.isOpen} navbar>
          <Nav navbar />
          <UncontrolledDropdown>
            <DropdownToggle className="btn-navbar navbar-link" nav caret>
              Tree
            </DropdownToggle>
            <DropdownMenuItems options={treeOptions} updateData={this.updateData} default={this.props.tree} />
          </UncontrolledDropdown>
        </Collapse>
      </Navbar>
    );
  }
}

Nav.propTypes = {
  caret: PropTypes.bool,
};

const mapDispatchToProps = dispatch => ({
  updateTree: (tree, name) => dispatch(updateTreeName(tree, name)),
  fetchData: (url, name) => dispatch(fetchBugData(url, name)),
  fetchFullBugData: (url, name) => dispatch(fetchBugsThenBugzilla(url, name))
});

export default connect(null, mapDispatchToProps)(Navigation);
