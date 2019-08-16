import React from 'react';
import PropTypes from 'prop-types';

import FilterControls from '../FilterControls';
import { convertParams } from '../helpers';

import AlertTable from './AlertTable';

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

  componentDidUpdate(prevProps) {
    const { hideDownstream, hideImprovements } = this.state;
    const { location, validated } = this.props;

    if (
      location.search !== prevProps.location.search &&
      location.search === ''
    ) {
      validated.updateParams({
        hideImprovements: +hideImprovements,
        hideDwnToInv: +hideDownstream,
      });
    }
  }

  updateFilter = filter => {
    this.setState(
      prevState => ({ [filter]: !prevState[filter] }),
      () =>
        this.props.validated.updateParams({
          [filter === 'hideDownstream' ? 'hideDwnToInv' : filter]: +this.state[
            filter
          ],
        }),
    );
  };

  render() {
    const { hideImprovements, hideDownstream } = this.state;
    const { dropdownOptions, alertSummaries } = this.props;
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
          updateFilter={this.updateFilter}
          updateFilterText={filterText => this.setState({ filterText })}
          dropdownCol
        />
        {alertSummaries.length > 0 &&
          alertSummaries.map(alertSummary => (
            <AlertTable
              filters={this.state}
              key={alertSummary.id}
              alertSummary={alertSummary}
              {...this.props}
            />
          ))}
      </React.Fragment>
    );
  }
}

AlertsViewControls.propTypes = {
  validated: PropTypes.shape({
    updateParams: PropTypes.func,
  }).isRequired,
  dropdownOptions: PropTypes.arrayOf(PropTypes.shape({})),
  alertSummaries: PropTypes.arrayOf(PropTypes.shape({})),
};

AlertsViewControls.defaultProps = {
  dropdownOptions: null,
  alertSummaries: [],
};
