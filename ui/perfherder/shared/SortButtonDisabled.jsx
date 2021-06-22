import React from 'react';
import { Badge } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSort } from '@fortawesome/free-solid-svg-icons';

export default class SortButtonDisabled extends React.PureComponent {
  render() {
    return (
      <Badge className="mx-1 disabled-button" aria-disabled="true">
        <FontAwesomeIcon icon={faSort} />
      </Badge>
    );
  }
}

SortButtonDisabled.propTypes = {};
