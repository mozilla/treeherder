import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const choices = [
  { url: '/jobs', text: 'Treeherder' },
  { url: '/perfherder', text: 'Perfherder' },
  { url: '/intermittent-failures', text: 'Intermittent Failures View' },
  { url: '/push-health', text: 'Push Health' },
];

export default class LogoMenu extends React.PureComponent {
  render() {
    const {
      menuText,
      menuImage = null,
      colorClass = 'text-white',
    } = this.props;

    const menuChoices = choices.filter((choice) => choice.text !== menuText);
    return (
      <Dropdown>
        <Dropdown.Toggle
          className="btn-view-nav menu-items"
          id="th-logo"
          title="Treeherder services"
        >
          {menuImage ? (
            <img src={menuImage} alt={menuText} />
          ) : (
            <span className={colorClass}>{menuText}</span>
          )}
        </Dropdown.Toggle>
        <Dropdown.Menu>
          {menuChoices.map((choice) => (
            <Dropdown.Item key={choice.text} as={Link} to={choice.url}>
              {choice.text}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    );
  }
}

LogoMenu.propTypes = {
  menuText: PropTypes.string.isRequired,
  menuImage: PropTypes.string,
  colorClass: PropTypes.string,
};
