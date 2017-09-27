import React from 'react';
import { Navbar, Nav, Badge } from 'reactstrap';
import Icon from 'react-fontawesome';
import { connect } from 'react-redux';
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
      author: author,
    },
  };
};

class StatusNavbar extends React.Component {
  toggleHideClassified(classification) {
    const { hideClassified, filter, groups, options } = this.props;

    store.dispatch(actions.groups.toggleHideClassified(
      filter,
      groups,
      options,
      {
        ...hideClassified,
        [classification]: !hideClassified[classification]
      }
    ));
  }

  render() {
    return (
      <Navbar toggleable>
        <Nav className="mr-auto" navbar>
          <span className="navbar-text">
            <Icon name="code"/> Revision <code className="push-revision">{this.props.push.revision}</code>
          </span>

          <span className="navbar-text">
            <Icon name="id-card-o"/> Author <code>{this.props.push.author}</code>
          </span>
        </Nav>

        <span className="navbar-text">
          <Badge color="danger">{this.props.counts.failed} Other Failed Tests</Badge>
        </span>

        <span className="navbar-text toggle-count" onClick={() => this.toggleHideClassified('infra')}>
          <Badge color="infra">
            <Icon name={this.props.hideClassified.infra ? 'square-o' : 'check-square-o'}/>
            {this.props.counts.infra} Infra Tests
          </Badge>
        </span>

        <span className="navbar-text toggle-count" onClick={() => this.toggleHideClassified('intermittent')}>
          <Badge color="intermittent">
            <Icon name={this.props.hideClassified.intermittent ? 'square-o' : 'check-square-o'}/>
            {this.props.counts.intermittent} Intermittent Tests
          </Badge>
        </span>

        <span className="navbar-text">
          <Badge color="success">{this.props.counts.success} Successful Jobs</Badge>
        </span>

        <span className="navbar-text">
          <Badge color="info">{this.props.counts.running} Running Jobs</Badge>
        </span>

        <span className="navbar-text">
          <Badge>{this.props.counts.pending} Pending Jobs</Badge>
        </span>
      </Navbar>
    );
  }
}

export default connect(mapStateToProps)(StatusNavbar);
