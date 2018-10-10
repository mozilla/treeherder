import React from 'react';
import { Table } from 'reactstrap';
import ReactTable from 'react-table';
import 'react-table/react-table.css';
import PropTypes from 'prop-types';

import { sortData, tableRowStyling } from './helpers';

export default class GenericTable extends React.Component {
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

  updateTable(state) {
    let { page, pageSize } = this.state;

    // table's page count starts at 0
    if (state.page + 1 !== page || state.pageSize !== pageSize) {
      page = state.page + 1;
      pageSize = state.pageSize;

      this.props.updateState({ page, pageSize }, true);
      this.setState({ page, pageSize });
    } else if (state.sorted.length > 0) {
      this.setState({ columnId: state.sorted[0].id, descending: state.sorted[0].desc });
    }
  }

  render() {
    const { data, columns, totalPages } = this.props;
    const { columnId, descending } = this.state;
    let sortedData = [];

    if (columnId) {
      sortedData = sortData([...data], columnId, descending);
    }
    return (
      <ReactTable
        manual
        data={sortedData.length > 0 ? sortedData : data}
        onFetchData={this.updateTable}
        pages={totalPages}
        showPageSizeOptions
        columns={columns}
        className="-striped"
        getTrProps={tableRowStyling}
        showPaginationTop
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
  data: PropTypes.arrayOf(PropTypes.shape({})),
  columns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  updateState: PropTypes.func.isRequired,
  totalPages: PropTypes.number,
};

GenericTable.defaultProps = {
  totalPages: null,
  data: undefined,
};
