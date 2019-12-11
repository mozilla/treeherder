import React from 'react';
import PropTypes from 'prop-types';
import {
  Label,
  UncontrolledDropdown,
  DropdownToggle,
  DropdownMenu,
} from 'reactstrap';

const TIERS = ['1', '2', '3'];

export default function TiersMenu(props) {
  const { filterModel } = props;
  const shownTiers = filterModel.urlParams.tier || [];

  return (
    <UncontrolledDropdown>
      <DropdownToggle
        id="tierLabel"
        title="Show/hide job tiers"
        className="btn btn-view-nav btn-sm nav-menu-btn dropdown-toggle"
      >
        Tiers
      </DropdownToggle>
      <DropdownMenu className="checkbox-dropdown-menu">
        {TIERS.map(tier => {
          const isOnlyTier = shownTiers.length === 1 && tier === shownTiers[0];
          return (
            <li key={tier}>
              <div>
                <Label
                  title={
                    isOnlyTier
                      ? 'Must have at least one tier selected at all times'
                      : ''
                  }
                  className={`dropdown-item ${isOnlyTier ? 'disabled' : ''}`}
                >
                  <input
                    style={{ pointerEvents: 'none' }}
                    id="tier-checkbox"
                    type="checkbox"
                    className="mousetrap"
                    disabled={isOnlyTier}
                    checked={shownTiers.includes(tier)}
                    onChange={() => filterModel.toggleFilter('tier', tier)}
                  />
                  tier {tier}
                </Label>
              </div>
            </li>
          );
        })}
      </DropdownMenu>
    </UncontrolledDropdown>
  );
}

TiersMenu.propTypes = {
  filterModel: PropTypes.object.isRequired,
};
