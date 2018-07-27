import React from 'react';
import PropTypes from 'prop-types';

export default class TiersMenu extends React.Component {
  static getShownTiers(jobFilters) {
    return jobFilters.getFieldFiltersObj().tier || [];
  }

  constructor(props) {
    super(props);
    const { jobFilters } = props;

    this.state = {
      shownTiers: TiersMenu.getShownTiers(jobFilters),
    };
  }

  componentDidMount() {
    const { history, jobFilters } = this.props;

    this.unlistenHistory = history.listen(() => {
      this.setState({ shownTiers: TiersMenu.getShownTiers(jobFilters) });
    });
  }

  componentWillUnmount() {
    this.unlistenHistory();
  }

  toggleTier(tier) {
    const { jobFilters } = this.props;
    const { shownTiers } = this.state;

    jobFilters.toggleFilters('tier', [tier], !shownTiers.includes(tier));
    this.setState({ shownTiers: TiersMenu.getShownTiers(jobFilters) });
  }

  render() {
    const { jobFilters } = this.props;
    const { shownTiers } = this.state;

    return (
      <span className="dropdown">
        <span
          id="tierLabel"
          role="button"
          title="Show/hide job tiers"
          data-toggle="dropdown"
          className="btn btn-view-nav btn-sm nav-menu-btn dropdown-toggle"
        >Tiers</span>
        <ul
          className="dropdown-menu checkbox-dropdown-menu"
          role="menu"
        >
          {jobFilters.tiers.map((tier) => {
            const isOnlyTier = shownTiers.length === 1 && tier === shownTiers[0];
            return (<li key={tier}>
              <div>
                <label
                  title={isOnlyTier ? 'Must have at least one tier selected at all times' : ''}
                  className={`dropdown-item ${isOnlyTier ? 'disabled' : ''}`}
                >
                  <input
                    id="tier-checkbox"
                    type="checkbox"
                    className="mousetrap"
                    disabled={isOnlyTier}
                    checked={shownTiers.includes(tier)}
                    onChange={() => this.toggleTier(tier)}
                  />tier {tier}
                </label>
              </div>
            </li>);
          })}
        </ul>
      </span>

    );
  }
}

TiersMenu.propTypes = {
  jobFilters: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired,
};
