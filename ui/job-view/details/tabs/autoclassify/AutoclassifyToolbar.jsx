import React from 'react';
import PropTypes from 'prop-types';

export default class AutoclassifyToolbar extends React.Component {

  getButtonTitle(condition, activeTitle, inactiveTitle) {
    const { user } = this.props;

    if (!user || !user.isLoggedIn) {
      return 'Must be logged in';
    }
    if (!user.isStaff) {
      return 'Insufficeint permissions';
    }
    if (condition) {
      return activeTitle;
    }
    return inactiveTitle;
  }

  render() {
    const {
      hasSelection, canSave, canSaveAll, canClassify, onPin, onIgnore, onSave,
      onSaveAll, onEdit, autoclassifyStatus
    } = this.props;

    return (
      <div className="autoclassify-toolbar th-context-navbar navbar-right">
        {status === 'ready' && <div>
          {autoclassifyStatus === 'cross_referenced' && <span>Autoclassification pending</span>}
          {autoclassifyStatus === 'failed' && <span>Autoclassification failed</span>}
        </div>}

        <button
          className="btn btn-view-nav btn-sm nav-menu-btn"
          title="Pin job for bustage"
          onClick={onPin}
        >Bustage
        </button>

        <button
          className="btn btn-view-nav btn-sm nav-menu-btn"
          title={this.getButtonTitle(hasSelection, 'Edit selected lines', 'Nothing selected')}
          onClick={onEdit}
          disabled={hasSelection && !canClassify}
        >Edit</button>

        <button
          className="btn btn-view-nav btn-sm nav-menu-btn"
          title={this.getButtonTitle(hasSelection, 'Ignore selected lines', 'Nothing selected')}
          onClick={onIgnore}
          disabled={hasSelection && !canClassify}
        >Ignore</button>

        <button
          className="btn btn-view-nav btn-sm nav-menu-btn"
          title={this.getButtonTitle(canSave, 'Save', 'Nothing selected')}
          onClick={onSave}
          disabled={!canSave}
        >Save</button>

        <button
          className="btn btn-view-nav btn-sm nav-menu-btn"
          title={this.getButtonTitle(canSaveAll, 'Save All', 'Lines not classified')}
          onClick={onSaveAll}
          disabled={!canSaveAll}
        >Save All</button>
      </div>
    );
  }
}

AutoclassifyToolbar.propTypes = {
  autoclassifyStatus: PropTypes.string.isRequired,
  user: PropTypes.object.isRequired,
  canSave: PropTypes.bool.isRequired,
  canSaveAll: PropTypes.bool.isRequired,
  canClassify: PropTypes.bool.isRequired,
  hasSelection: PropTypes.bool.isRequired,
  onIgnore: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onSaveAll: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onPin: PropTypes.func.isRequired,
};

