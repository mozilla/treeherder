import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Label } from 'reactstrap';

export const PUSH_HEALTH_VISIBILITY = 'pushHealthVisibility';

class HealthMenu extends PureComponent {
  render() {
    const { pushHealthVisibility, setPushHealthVisibility } = this.props;

    return (
      <span className="dropdown">
        <span
          id="healthLabel"
          role="button"
          title="Change visibility of the Push Health badge/link"
          data-toggle="dropdown"
          className="btn btn-view-nav btn-sm nav-menu-btn dropdown-toggle"
        >
          Health
        </span>
        <ul className="dropdown-menu checkbox-dropdown-menu" role="menu">
          {['All', 'Try', 'None'].map(option => {
            return (
              <li key={option}>
                <div>
                  <Label
                    title={`Add Push Health badge to ${option} repo(s)`}
                    className="dropdown-item"
                  >
                    <input
                      id="health-checkbox"
                      type="checkbox"
                      className="mousetrap"
                      checked={pushHealthVisibility === option}
                      onChange={() => setPushHealthVisibility(option)}
                    />
                    {option}
                  </Label>
                </div>
              </li>
            );
          })}
        </ul>
      </span>
    );
  }
}

HealthMenu.propTypes = {
  pushHealthVisibility: PropTypes.string.isRequired,
  setPushHealthVisibility: PropTypes.func.isRequired,
};

export default HealthMenu;
