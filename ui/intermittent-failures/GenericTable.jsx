import React from 'react';
import { Table } from 'reactstrap';
import ReactTable from 'react-table';
import 'react-table/react-table.css';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { fetchBugData, fetchBugsThenBugzilla } from './redux/actions';
import { createApiUrl } from '../helpers/urlHelper';

function GenericTable({ fetchData, fetchFullBugData, name, params, tableApi, bugs, columns, trStyling, totalPages }) {
  const updateData = (page) => {
    params.page = page;
    if (name === 'BUGS') {
      fetchFullBugData(createApiUrl(tableApi, params), name);
    } else {
      fetchData(createApiUrl(tableApi, params), name);
    }
  };

  const updateTable = (state) => {
    // table's page count starts at 0
    const page = state.page + 1;
    updateData(page);
  };

  const bugRowStyling = (state, bug) => {
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
  };
  return (
    <ReactTable
      manual
      data={bugs}
      onFetchData={updateTable}
      pages={totalPages}
      showPageSizeOptions={false}
      columns={columns}
      className="-striped"
      getTrProps={trStyling ? bugRowStyling : () => ({})}
    />
  );
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
