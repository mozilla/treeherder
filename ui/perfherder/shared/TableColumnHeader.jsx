import React from 'react';
import PropTypes from 'prop-types';

import SortButton from './SortButton';

// eslint-disable-next-line react/prefer-stateless-function
export default class TableColumnHeader extends React.Component {
  render() {
    const { column, onChangeSort } = this.props;
    const { name } = column;
    return (
      <div className="d-flex flex-nowrap align-items-center">
        <div>{name === 'Test name' ? '' : `${name}`}</div>
        <SortButton column={column} onChangeSort={onChangeSort} />
      </div>
    );
  }
}

TableColumnHeader.propTypes = {
  column: PropTypes.shape({}).isRequired,
  onChangeSort: PropTypes.func.isRequired,
};
