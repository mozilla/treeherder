import React from 'react';
import { Badge } from 'reactstrap';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSort,
  faSortDown,
  faSortUp,
} from '@fortawesome/free-solid-svg-icons';

import { compareTableSort } from '../constants';

export default class CompareSortButton extends React.Component {
  sortTypes = {
    [compareTableSort.ascending]: {
      icon: faSortUp,
    },
    [compareTableSort.descending]: {
      icon: faSortDown,
    },
    [compareTableSort.default]: {
      icon: faSort,
    },
  };

  render() {
    const { column, onChangeSort } = this.props;
    const { name, currentSort } = column;
    return (
      <>
        {name === 'Test name' ? '' : `${name}`}
        <Badge
          className="mx-1 btn btn-darker-secondary"
          role="button"
          title={`Sorted in ${currentSort} order by ${name.toLowerCase()}`}
          onClick={() => onChangeSort(column)}
        >
          <FontAwesomeIcon icon={this.sortTypes[currentSort].icon} />
        </Badge>
      </>
    );
  }
}

CompareSortButton.propTypes = {
  column: PropTypes.shape({}).isRequired,
  onChangeSort: PropTypes.func.isRequired,
};
