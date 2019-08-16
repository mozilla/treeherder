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
    const { validated } = this.props;

    if (
      validated.hideImprovements !== prevProps.validated.hideImprovements ||
      validated.hideDwnToInv !== prevProps.validated.hideDwnToInv
    ) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({
        hideImprovements: convertParams(
          this.props.validated,
          'hideImprovements',
        ),
        hideDownstream: convertParams(this.props.validated, 'hideDwnToInv'),
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
    const { dropdownOptions, alertSummaries, user } = this.props;
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
              user={user}
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
  user: PropTypes.shape({}).isRequired,
};

AlertsViewControls.defaultProps = {
  dropdownOptions: null,
  alertSummaries: [],
};
