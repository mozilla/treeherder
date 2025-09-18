import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSort } from '@fortawesome/free-solid-svg-icons';

export default class SortButtonDisabled extends React.PureComponent {
  render() {
    const {
      column: { name },
    } = this.props;
    return (
      <Button
        size="sm"
        variant="secondary"
        className="mx-1 py-0 px-1"
        disabled
        title={`Sorted by ${name.toLowerCase()} disabled`}
      >
        <FontAwesomeIcon icon={faSort} className="text-white" />
      </Button>
    );
  }
}

SortButtonDisabled.propTypes = { column: PropTypes.shape({}).isRequired };
