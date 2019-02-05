import React from 'react';
import PropTypes from 'prop-types';
import { Navbar, Nav, Badge } from 'reactstrap';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckSquare,
  faIdCard,
  faSquare,
} from '@fortawesome/free-regular-svg-icons';
import { faCode } from '@fortawesome/free-solid-svg-icons';

import { store, actions } from '../redux/store';

const mapStateToProps = ({ groups }) => {
  const { revision, author } = groups.push;

  return {
    counts: groups.counts,
    options: groups.options,
    groups: groups.groups,
    filter: groups.filter,
    hideClassified: groups.hideClassified,
    push: {
      revision: revision && revision.substring(0, 12),
      author,
    },
  };
};

class StatusNavbar extends React.Component {
  toggleHideClassified(classification) {
    const { hideClassified, filter, groups, options } = this.props;

    store.dispatch(
      actions.groups.toggleHideClassified(filter, groups, options, {
        ...hideClassified,
        [classification]: !hideClassified[classification],
      }),
    );
  }

  render() {
    const { push, counts, hideClassified } = this.props;

    return (
      <Navbar expand>
        <Nav className="mr-auto">
          <span className="navbar-text">
            <FontAwesomeIcon icon={faCode} size="sm" /> Revision{' '}
            <code className="push-revision">{push.revision}</code>
          </span>

          <span className="navbar-text">
            <span className="hidden-sm-down">&mdash;&nbsp;&nbsp;&nbsp;</span>
            <FontAwesomeIcon icon={faIdCard} /> Author{' '}
            <code>{push.author}</code>
          </span>
        </Nav>

        <span className="navbar-text">
          <Badge color="danger">{counts.failed} Other Failed Tests</Badge>
        </span>

        <span
          className="navbar-text toggle-count"
          onClick={() => this.toggleHideClassified('infra')}
        >
          <Badge color="infra">
            <FontAwesomeIcon
              icon={hideClassified.infra ? faSquare : faCheckSquare}
              pull="left"
            />
            {counts.infra} Infra Tests
          </Badge>
        </span>

        <span
          className="navbar-text toggle-count"
          onClick={() => this.toggleHideClassified('intermittent')}
        >
          <Badge color="intermittent">
            <FontAwesomeIcon
              icon={hideClassified.intermittent ? faSquare : faCheckSquare}
              pull="left"
            />
            {counts.intermittent} Intermittent Tests
          </Badge>
        </span>

        <span className="navbar-text">
          <Badge color="success">{counts.success} Successful Jobs</Badge>
        </span>

        <span className="navbar-text">
          <Badge color="info">{counts.running} Running Jobs</Badge>
        </span>

        <span className="navbar-text">
          <Badge color="secondary">{counts.pending} Pending Jobs</Badge>
        </span>
      </Navbar>
    );
  }
}

StatusNavbar.propTypes = {
  hideClassified: PropTypes.object.isRequired,
  push: PropTypes.object.isRequired,
  counts: PropTypes.object.isRequired,
  filter: PropTypes.string.isRequired,
  groups: PropTypes.object.isRequired,
  options: PropTypes.object.isRequired,
};

export default connect(mapStateToProps)(StatusNavbar);
