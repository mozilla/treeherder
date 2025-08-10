import React from 'react';
import { Badge } from 'react-bootstrap';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSort,
  faSortDown,
  faSortUp,
} from '@fortawesome/free-solid-svg-icons';

import { tableSort } from '../perf-helpers/sort';

export default class SortButton extends React.Component {
  sortTypes = {
    [tableSort.ascending]: {
      icon: faSortUp,
    },
    [tableSort.descending]: {
      icon: faSortDown,
    },
    [tableSort.default]: {
      icon: faSort,
    },
  };

  render() {
    const { column, onChangeSort } = this.props;
    const { name, currentSort } = column;
    return (
      <Badge
        className="mx-1 btn btn-darker-secondary"
        role="button"
        title={`Sorted in ${currentSort} order by ${name.toLowerCase()}`}
        onClick={() => onChangeSort(column)}
      >
        <FontAwesomeIcon icon={this.sortTypes[currentSort].icon} />
      </Badge>
    );
  }
}

SortButton.propTypes = {
  column: PropTypes.shape({}).isRequired,
  onChangeSort: PropTypes.func.isRequired,
};
