
import PropTypes from 'prop-types';
import { Dropdown } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';

export default function TiersMenu(props) {
  const { filterModel } = props;
  const shownTiers = filterModel.urlParams.tier || [];
  const TIERS = ['1', '2', '3'];

  return (
    <Dropdown>
      <Dropdown.Toggle
        id="tierLabel"
        title="Show/hide job tiers"
        className="btn-view-nav nav-menu-btn"
      >
        Tiers
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {TIERS.map((tier) => {
          const isOnlyTier = shownTiers.length === 1 && tier === shownTiers[0];
          return (
            <Dropdown.Item
              tag="a"
              key={tier}
              onClick={() => filterModel.toggleFilter('tier', tier)}
              className={`dropdown-item ${isOnlyTier ? 'disabled' : ''}`}
            >
              <FontAwesomeIcon
                icon={faCheck}
                className={`me-1 ${shownTiers.includes(tier) ? '' : 'hide'}`}
                title={
                  isOnlyTier
                    ? 'Must have at least one tier selected at all times'
                    : ''
                }
              />
              tier {tier}
            </Dropdown.Item>
          );
        })}
      </Dropdown.Menu>
    </Dropdown>
  );
}

TiersMenu.propTypes = {
  filterModel: PropTypes.shape({}).isRequired,
};
