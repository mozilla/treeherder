import React from 'react';
import PropTypes from 'prop-types';
import {
  UncontrolledDropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';

export default function TiersMenu(props) {
  const { filterModel } = props;
  const shownTiers = filterModel.urlParams.tier || [];
  const TIERS = ['1', '2', '3'];

  return (
    <UncontrolledDropdown>
      <DropdownToggle
        id="tierLabel"
        title="Show/hide job tiers"
        className="btn-view-nav nav-menu-btn"
        caret
      >
        Tiers
      </DropdownToggle>
      <DropdownMenu>
        {TIERS.map(tier => {
          const isOnlyTier = shownTiers.length === 1 && tier === shownTiers[0];
          return (
            <DropdownItem
              tag="a"
              key={tier}
              onClick={() => filterModel.toggleFilter('tier', tier)}
              className={`dropdown-item ${isOnlyTier ? 'disabled' : ''}`}
            >
              <FontAwesomeIcon
                icon={faCheck}
                className={`mr-1 ${shownTiers.includes(tier) ? '' : 'hide'}`}
                title={
                  isOnlyTier
                    ? 'Must have at least one tier selected at all times'
                    : ''
                }
              />
              tier {tier}
            </DropdownItem>
          );
        })}
      </DropdownMenu>
    </UncontrolledDropdown>
  );
}

TiersMenu.propTypes = {
  filterModel: PropTypes.object.isRequired,
};
