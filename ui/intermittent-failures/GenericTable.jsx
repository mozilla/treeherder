import React from 'react';
import { Table } from 'reactstrap';
import ReactTable from 'react-table';
import 'react-table/react-table.css';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { fetchBugData, fetchBugsThenBugzilla } from './redux/actions';
import { createApiUrl } from '../helpers/urlHelper';
import { sortData } from './helpers';

class GenericTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      page: 0,
      pageSize: 20,
      columnId: null,
      descending: null,
    };
    this.updateTable = this.updateTable.bind(this);
  }

  updateData(page, pageSize) {
    const { fetchData, fetchFullBugData, name, params, tableApi } = this.props;
    params.page = page;
    params.page_size = pageSize;

    if (name === 'BUGS') {
      fetchFullBugData(createApiUrl(tableApi, params), name);
    } else {
      fetchData(createApiUrl(tableApi, params), name);
    }
  }

  updateTable(state) {
    const { page, pageSize } = this.state;

    // table's page count starts at 0
    if (state.page + 1 !== page || state.pageSize !== pageSize) {
      this.updateData(state.page + 1, state.pageSize);
      this.setState({ page: state.page + 1, pageSize: state.pageSize });
    } else if (state.sorted.length > 0) {
      this.setState({ columnId: state.sorted[0].id, descending: state.sorted[0].desc });
    }
  }

  bugRowStyling(state, bug) {
    if (bug) {
      const style = { color: '#aaa' };

      if (bug.row.status === 'RESOLVED' || bug.row.status === 'VERIFIED') {
        style.textDecoration = 'line-through';
        return { style };
      }

      const disabledStrings = new RegExp('(disabled|annotated|marked)', 'i');
      if (disabledStrings.test(bug.row.whiteboard)) {
        return { style };
      }
    }
    return {};
  }
  render() {
    const { bugs, columns, trStyling, totalPages } = this.props;
    const { columnId, descending } = this.state;
    let sortedData = [];

    if (columnId) {
      sortedData = sortData([...bugs], columnId, descending);
    }
    return (
      <ReactTable
        manual
        data={sortedData.length > 0 ? sortedData : bugs}
        onFetchData={this.updateTable}
        pages={totalPages}
        showPageSizeOptions
        columns={columns}
        className="-striped"
        getTrProps={trStyling ? this.bugRowStyling : () => ({})}
      />
    );
  }
}

Table.propTypes = {
  bordered: PropTypes.bool,
  striped: PropTypes.bool,
  hover: PropTypes.bool,
  responsive: PropTypes.bool,
};

GenericTable.propTypes = {
  bugs: PropTypes.arrayOf(PropTypes.shape({})),
  columns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  params: PropTypes.shape({
    startday: PropTypes.string.isRequired,
    endday: PropTypes.string.isRequired,
    tree: PropTypes.string.isRequired,
    bug: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]),
  }).isRequired,
  fetchData: PropTypes.func,
  fetchFullBugData: PropTypes.func,
  name: PropTypes.string.isRequired,
  tableApi: PropTypes.string.isRequired,
  trStyling: PropTypes.bool,
  totalPages: PropTypes.number,
};

GenericTable.defaultProps = {
  trStyling: false,
  fetchData: null,
  fetchFullBugData: null,
  totalPages: null,
  bugs: undefined,
};

const mapDispatchToProps = dispatch => ({
  fetchData: (url, name) => dispatch(fetchBugData(url, name)),
  fetchFullBugData: (url, name) => dispatch(fetchBugsThenBugzilla(url, name)),
});

export default connect(null, mapDispatchToProps)(GenericTable);
