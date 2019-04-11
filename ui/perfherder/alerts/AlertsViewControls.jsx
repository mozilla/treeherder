import React from 'react';
import PropTypes from 'prop-types';

import FilterControls from '../FilterControls';
import { convertParams } from '../helpers';

export default class AlertsViewControls extends React.Component {
  constructor(props) {
    super(props);
    this.validated = this.props.validated;
    this.state = {
      hideImprovements: convertParams(this.validated, 'hideImprovements'),
      hideDownstream: convertParams(this.validated, 'hideDwnToInv'),
      filterText: '',
    };
  }

  updateFilter = filter => {
    this.setState(
      prevState => ({ [filter]: !prevState[filter] }),
      () => this.updateFilteredResults(),
    );
  };

  render() {
    const { hideImprovements, hideDownstream } = this.state;
    const { dropdownOptions, render } = this.props;
    const alertFilters = [
      {
        text: 'Hide improvements',
        state: hideImprovements,
        stateName: 'hideImprovements',
      },
      {
        text: 'Hide downstream / reassigned to / invalid',
        state: hideDownstream,
        stateName: 'hideDownstream',
      },
    ];

    return (
      <React.Fragment>
        <FilterControls
          dropdownOptions={dropdownOptions}
          filterOptions={alertFilters}
          updateFilter={filter =>
            this.setState(prevState => ({ [filter]: !prevState[filter] }))
          }
          updateFilterText={filterText => this.setState({ filterText })}
          dropdownCol
        />
        {render(this.state)}
      </React.Fragment>
    );
  }
}

AlertsViewControls.propTypes = {
  validated: PropTypes.shape({}).isRequired,
  dropdownOptions: PropTypes.arrayOf(PropTypes.shape({})),
  render: PropTypes.func.isRequired,
};

AlertsViewControls.defaultProps = {
  dropdownOptions: null,
};
