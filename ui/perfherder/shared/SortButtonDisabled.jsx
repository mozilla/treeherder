import React from 'react';
import PropTypes from 'prop-types';
import { Badge } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSort } from '@fortawesome/free-solid-svg-icons';

export default class SortButtonDisabled extends React.PureComponent {
  render() {
    const {
      column: { name },
    } = this.props;
    return (
      <Badge
        className="mx-1 disabled-button"
        aria-disabled="true"
        title={`Sorted by ${name.toLowerCase()} disabled`}
      >
        <FontAwesomeIcon icon={faSort} />
      </Badge>
    );
  }
}

SortButtonDisabled.propTypes = { column: PropTypes.shape({}).isRequired };
