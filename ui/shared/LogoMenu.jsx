import React from 'react';
import PropTypes from 'prop-types';
import {
  UncontrolledDropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
} from 'reactstrap';

const choices = [
  { url: '/', text: 'Treeherder' },
  { url: '/perf.html', text: 'Perfherder' },
  { url: '/intermittent-failures.html', text: 'Intermittent Failures View' },
  { url: '/pushhealth.html', text: 'Push Health Usage' },
];

export default class LogoMenu extends React.PureComponent {
  render() {
    const { menuText, menuImage, colorClass } = this.props;

    const menuChoices = choices.filter(choice => choice.text !== menuText);
    return (
      <UncontrolledDropdown>
        <DropdownToggle
          className="btn-view-nav"
          id="th-logo"
          caret
          title="Treeherder services"
        >
          {menuImage ? (
            <img src={menuImage} alt={menuText} />
          ) : (
            <span className={colorClass}>{menuText}</span>
          )}
        </DropdownToggle>
        <DropdownMenu>
          {menuChoices.map(choice => (
            <DropdownItem key={choice.text} tag="a" href={choice.url}>
              {choice.text}
            </DropdownItem>
          ))}
        </DropdownMenu>
      </UncontrolledDropdown>
    );
  }
}

LogoMenu.propTypes = {
  menuText: PropTypes.string.isRequired,
  menuImage: PropTypes.string,
  colorClass: PropTypes.string,
};

LogoMenu.defaultProps = {
  menuImage: null,
  colorClass: 'text-white',
};
