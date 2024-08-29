import React from 'react';
import PropTypes from 'prop-types';
import Hotkeys from 'react-hot-keys';
import { connect } from 'react-redux';

import { thEvents } from '../helpers/constants';

import {
  notify,
  clearAllOnScreenNotifications,
} from './redux/stores/notifications';
import {
  changeJob,
  clearSelectedJob,
  updateJobDetails,
} from './redux/stores/selectedJob';
import { pinJob, unPinAll } from './redux/stores/pinnedJobs';

const handledKeys =
  'b,c,f,ctrl+shift+f,f,i,j,k,l,n,p,q,r,t,u,v,ctrl+shift+u,left,right,space,shift+/,escape,ctrl+enter,ctrl+backspace';

class KeyboardShortcuts extends React.Component {
  onKeyDown = (key, e) => {
    const { showOnScreenShortcuts, filterModel } = this.props;

    e.preventDefault();

    switch (key) {
      case 'b':
        return this.addRelatedBug();
      case 'c':
        return this.pinEditComment();
      case 'f':
        return this.quickFilter();
      case 'ctrl+shift+f':
        return this.clearFilter();
      case 'i':
        return filterModel.toggleInProgress();
      case 'j':
        return this.changeSelectedJob('next', true);
      case 'k':
        return this.changeSelectedJob('previous', true);
      case 'l':
        return this.openLogviewer();
      case 'n':
        return this.changeSelectedJob('next', true);
      case 'p':
        return this.changeSelectedJob('previous', true);
      case 'q':
        return filterModel.toggleClassifiedFailures(true);
      case 'r':
        return this.jobRetrigger();
      case 't':
        return this.selectNextTab();
      case 'u':
        return filterModel.toggleUnclassifiedFailures();
      case 'ctrl+shift+u':
        return this.clearPinboard();
      case 'left':
        return this.changeSelectedJob('previous', false);
      case 'right':
        return this.changeSelectedJob('next', false);
      case 'space':
        return this.pinJob();
      case 'shift+/':
        return showOnScreenShortcuts();

      // These should happen regardless of being in an input field.
      // Handled by the `filter` function.
      case 'escape':
        return this.clearScreen();
      case 'ctrl+enter':
        return this.saveClassification();
      case 'ctrl+backspace':
        return this.deleteClassification();
    }
  };

  /**
   * Job Navigation Shortcuts
   */

  // close any notifications, if they exist.  If not, then close any
  // open panels and selected job
  clearScreen = () => {
    const {
      clearSelectedJob,
      showOnScreenShortcuts,
      notifications,
      clearAllOnScreenNotifications,
      pinnedJobs,
    } = this.props;

    if (notifications.length) {
      clearAllOnScreenNotifications();
    } else {
      clearSelectedJob(Object.keys(pinnedJobs).length);
      showOnScreenShortcuts(false);
    }
  };

  /**
   * Details Panel Shortcuts
   */

  // pin selected job to pinboard
  pinJob = () => {
    const { selectedJob, pinJob } = this.props;

    if (selectedJob) {
      pinJob(selectedJob);
    }
  };

  // pin selected job to pinboard and add a related bug
  addRelatedBug = async () => {
    const { selectedJob, pinJob } = this.props;

    if (selectedJob) {
      await pinJob(selectedJob);
      document.getElementById('add-related-bug-button').click();
    }
  };

  // pin selected job to pinboard and enter classification
  pinEditComment = () => {
    const { selectedJob, pinJob } = this.props;

    if (selectedJob) {
      pinJob(selectedJob);
      document.getElementById('classification-comment').focus();
    }
  };

  // clear the PinBoard
  clearPinboard = () => {
    this.props.unPinAll();
  };

  saveClassification = () => {
    window.dispatchEvent(new CustomEvent(thEvents.saveClassification));
  };

  // delete classification and related bugs
  deleteClassification = () => {
    const { selectedJob } = this.props;

    if (selectedJob) {
      window.dispatchEvent(new CustomEvent(thEvents.deleteClassification));
    }
  };

  // open the logviewer for the selected job
  openLogviewer = () => {
    window.dispatchEvent(new CustomEvent(thEvents.openLogviewer));
  };

  // retrigger selected job
  jobRetrigger = () => {
    const { selectedJob } = this.props;

    if (selectedJob) {
      window.dispatchEvent(
        new CustomEvent(thEvents.jobRetrigger, {
          detail: { job: selectedJob },
        }),
      );
    }
  };

  // select next job tab
  selectNextTab = () => {
    const { selectedJob } = this.props;

    if (selectedJob) {
      window.dispatchEvent(new CustomEvent(thEvents.selectNextTab));
    }
  };

  /**
   * Filter and Help Shortcuts
   */

  // enter a quick filter
  quickFilter = () => {
    document.getElementById('quick-filter').focus();
  };

  // clear the quick filter field
  clearFilter = () => {
    const { filterModel } = this.props;

    filterModel.removeFilter('searchStr');
  };

  changeSelectedJob = (direction, unclassifiedOnly) => {
    // Select the next job without updating the details panel.  That is debounced so
    // it doesn't do too much updating while quickly switching between jobs.
    const { updateJobDetails, notify, pinnedJobs } = this.props;
    const { selectedJob } = changeJob(
      direction,
      unclassifiedOnly,
      Object.keys(pinnedJobs).length,
      notify,
    );

    if (selectedJob) {
      updateJobDetails(selectedJob);
    }
  };

  /*
   * If we are in an input or select field, then only handle the keys of
   * escape, ctrl+enter, ctrl+backspace.
   * Otherwise, handle as normal.
   */
  filter = (e) => {
    // If a modal dialog is opened, don't let these shortcuts work
    if (document.getElementsByClassName('modal show').length) {
      return false;
    }
    if (['INPUT', 'SELECT'].some((n) => n === e.target.nodeName)) {
      return (
        (e.ctrlKey && ['Enter', 'Backspace'].some((key) => key === e.key)) ||
        e.key === 'Escape'
      );
    }
    return true;
  };

  render() {
    return (
      <Hotkeys
        keyName={handledKeys}
        onKeyDown={this.onKeyDown}
        onKeyUp={this.onKeyUp}
        filter={this.filter}
      >
        {this.props.children}
      </Hotkeys>
    );
  }
}

KeyboardShortcuts.propTypes = {
  filterModel: PropTypes.shape({}).isRequired,
  pinJob: PropTypes.func.isRequired,
  unPinAll: PropTypes.func.isRequired,
  children: PropTypes.arrayOf(PropTypes.element).isRequired,
  clearSelectedJob: PropTypes.func.isRequired,
  updateJobDetails: PropTypes.func.isRequired,
  showOnScreenShortcuts: PropTypes.func.isRequired,
  notifications: PropTypes.arrayOf(
    PropTypes.shape({
      created: PropTypes.number.isRequired,
      message: PropTypes.string.isRequired,
      severity: PropTypes.string.isRequired,
      sticky: PropTypes.bool,
    }),
  ).isRequired,
  notify: PropTypes.func.isRequired,
  pinnedJobs: PropTypes.shape({}).isRequired,
  clearAllOnScreenNotifications: PropTypes.func.isRequired,
  selectedJob: PropTypes.shape({}),
};

KeyboardShortcuts.defaultProps = {
  selectedJob: null,
};

const mapStateToProps = ({
  notifications: { notifications },
  selectedJob: { selectedJob },
  pinnedJobs: { pinnedJobs },
}) => ({
  notifications,
  selectedJob,
  pinnedJobs,
});

export default connect(mapStateToProps, {
  clearAllOnScreenNotifications,
  notify,
  updateJobDetails,
  clearSelectedJob,
  pinJob,
  unPinAll,
})(KeyboardShortcuts);
