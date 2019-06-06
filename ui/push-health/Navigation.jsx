import React from 'react';
import PropTypes from 'prop-types';
import { Navbar } from 'reactstrap';

import LogoMenu from '../shared/LogoMenu';
import Login from '../shared/auth/Login';
import SimpleTooltip from '../shared/SimpleTooltip';

export default class Navigation extends React.PureComponent {
  render() {
    const { user, setUser, notify } = this.props;

    return (
      <Navbar dark color="dark">
        <LogoMenu menuText="Push Health" />
        <SimpleTooltip
          text="[---PROTOTYPE---]"
          textClass="text-white"
          placement="bottom"
          tooltipText={
            <div>
              This prototype is still in-progress. The section on `Tests` has
              been implemented, but Linting, Coverage, Builds, etc are not. You
              will notice in Treeherder that the status may say `OK` for a push
              that has failed Builds or linting. These features will be updated
              in the weeks to come.
            </div>
          }
        />
        <Login user={user} setUser={setUser} notify={notify} />
      </Navbar>
    );
  }
}

Navigation.propTypes = {
  user: PropTypes.object.isRequired,
  setUser: PropTypes.func.isRequired,
  notify: PropTypes.func.isRequired,
};
