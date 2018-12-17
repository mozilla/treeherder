import React from 'react';
import PropTypes from 'prop-types';
import {
  ButtonDropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
} from 'reactstrap';

const choices = [
  { url: '/', text: 'Treeherder' },
  { url: '/perf.html', text: 'Perfherder' },
  { url: '/intermittent-failures.html', text: 'Intermittent Failures View' },
];

export default class LogoMenu extends React.Component {
  constructor(props) {
    super(props);

    this.toggle = this.toggle.bind(this);
    this.state = {
      dropdownOpen: false,
    };
  }

  toggle() {
    this.setState({
      dropdownOpen: !this.state.dropdownOpen,
    });
  }

  render() {
    const { menuText, menuImage } = this.props;

    const menuChoices = choices.filter(choice => choice.text !== menuText);
    return (
      <ButtonDropdown isOpen={this.state.dropdownOpen} toggle={this.toggle}>
        <DropdownToggle
          className="btn-view-nav"
          id="th-logo"
          caret
          title="Treeherder services"
        >
          {menuImage ? (
            <img src={menuImage} alt={menuText} />
          ) : (
            <span className="lightorange">{menuText}</span>
          )}
        </DropdownToggle>
        <DropdownMenu>
          {menuChoices.map(choice => (
            <DropdownItem key={choice.text}>
              <a href={choice.url} className="dropdown-item">
                {choice.text}
              </a>
            </DropdownItem>
          ))}
        </DropdownMenu>
      </ButtonDropdown>
    );
  }
}

LogoMenu.propTypes = {
  menuText: PropTypes.string.isRequired,
  menuImage: PropTypes.string,
};

LogoMenu.defaultProps = {
  menuImage: null,
};
