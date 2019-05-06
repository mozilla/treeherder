import React from 'react';
import PropTypes from 'prop-types';
import { Navbar, Tooltip } from 'reactstrap';

import LogoMenu from '../shared/LogoMenu';
import Login from '../shared/auth/Login';

export default class Navigation extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      explainerOpen: false,
    };
  }

  toggleExplainer = () => {
    const { explainerOpen } = this.state;

    this.setState({ explainerOpen: !explainerOpen });
  };

  render() {
    const { explainerOpen } = this.state;
    const { user, setUser } = this.props;

    return (
      <Navbar dark color="dark">
        <LogoMenu menuText="Push Health" />
        <span id="prototype" className="text-white">
          [---PROTOTYPE---]
        </span>
        <Tooltip
          placement="bottom"
          isOpen={explainerOpen}
          target="prototype"
          toggle={this.toggleExplainer}
        >
          This prototype is still in-progress. The section on `Tests` has been
          implemented, but Linting, Coverage, Builds, etc are not. You will
          notice in Treeherder that the status may say `OK` for a push that has
          failed Builds or linting. These features will be updated in the weeks
          to come.
        </Tooltip>
        <Login user={user} setUser={setUser} />
      </Navbar>
    );
  }
}

Navigation.propTypes = {
  user: PropTypes.object.isRequired,
  setUser: PropTypes.func.isRequired,
};
