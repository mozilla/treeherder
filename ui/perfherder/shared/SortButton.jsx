import React from 'react';
import { Button } from 'react-bootstrap';
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
      <Button
        size="sm"
        variant="secondary"
        className="mx-1 py-0 px-1"
        title={`Sorted in ${currentSort} order by ${name.toLowerCase()}`}
        onClick={() => onChangeSort(column)}
      >
        <FontAwesomeIcon
          icon={this.sortTypes[currentSort].icon}
          className="text-white"
        />
      </Button>
    );
  }
}

SortButton.propTypes = {
  column: PropTypes.shape({}).isRequired,
  onChangeSort: PropTypes.func.isRequired,
};
