import React from 'react';
import PropTypes from 'prop-types';
import { HotKeys } from 'react-hotkeys';
import { connect } from 'react-redux';

import { thEvents } from '../helpers/constants';

import { withPinnedJobs } from './context/PinnedJobs';
import { withSelectedJob } from './context/SelectedJob';
import { clearAllOnScreenNotifications } from './redux/stores/notifications';

const keyMap = {
  addRelatedBug: 'b',
  pinEditComment: 'c',
  quickFilter: 'f',
  clearFilter: 'ctrl+shift+f',
  toggleInProgress: 'i',
  nextUnclassified: ['j', 'n'],
  previousUnclassified: ['k', 'p'],
  openLogviewer: 'l',
  jobRetrigger: 'r',
  selectNextTab: 't',
  toggleUnclassifiedFailures: 'u',
  clearPinboard: 'ctrl+shift+u',
  previousJob: 'left',
  nextJob: 'right',
  pinJob: 'space',
  toggleOnScreenShortcuts: '?',
  /* these should happen regardless of being in an input field */
  clearScreen: 'escape',
  saveClassification: 'ctrl+enter',
  deleteClassification: 'ctrl+backspace',
};

class KeyboardShortcuts extends React.Component {
  componentDidMount() {
    // HotKeys requires focus be a component inside itself to work
    // TODO: We may not need this if we wrap <body> with HotKeys.
    document.getElementById('keyboard-shortcuts').focus();
  }

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
    } = this.props;

    if (notifications.length) {
      clearAllOnScreenNotifications();
    } else {
      clearSelectedJob();
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
  addRelatedBug = () => {
    const { selectedJob, pinJob } = this.props;

    if (selectedJob) {
      pinJob(selectedJob);
      document.getElementById('add-related-bug-button').click();
      document.getElementById('related-bug-input').focus();
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

  doKey(ev, callback) {
    const element = ev.target;

    // If the bug filer is opened, don't let these shortcuts work
    if (document.body.classList.contains('filer-open')) {
      return;
    }

    if (
      (element.tagName === 'INPUT' &&
        element.type !== 'radio' &&
        element.type !== 'checkbox') ||
      element.tagName === 'SELECT' ||
      element.tagName === 'TEXTAREA' ||
      element.isContentEditable ||
      ev.key === 'shift'
    ) {
      return;
    }

    // If we get here, then execute the HotKey.
    ev.preventDefault();
    callback(ev);
  }

  render() {
    const {
      filterModel,
      changeSelectedJob,
      showOnScreenShortcuts,
    } = this.props;
    const handlers = {
      addRelatedBug: ev => this.doKey(ev, this.addRelatedBug),
      pinEditComment: ev => this.doKey(ev, this.pinEditComment),
      quickFilter: ev => this.doKey(ev, this.quickFilter),
      clearFilter: ev => this.doKey(ev, this.clearFilter),
      toggleInProgress: ev => this.doKey(ev, filterModel.toggleInProgress),
      nextUnclassified: ev =>
        this.doKey(ev, () => changeSelectedJob('next', true)),
      previousUnclassified: ev =>
        this.doKey(ev, () => changeSelectedJob('previous', true)),
      openLogviewer: ev => this.doKey(ev, this.openLogviewer),
      jobRetrigger: ev => this.doKey(ev, this.jobRetrigger),
      selectNextTab: ev => this.doKey(ev, this.selectNextTab),
      toggleUnclassifiedFailures: ev =>
        this.doKey(ev, filterModel.toggleUnclassifiedFailures),
      clearPinboard: ev => this.doKey(ev, this.clearPinboard),
      previousJob: ev => this.doKey(ev, () => changeSelectedJob('previous')),
      nextJob: ev => this.doKey(ev, () => changeSelectedJob('next')),
      pinJob: ev => this.doKey(ev, this.pinJob),
      toggleOnScreenShortcuts: ev => this.doKey(ev, showOnScreenShortcuts),
      /* these should happen regardless of being in an input field */
      clearScreen: this.clearScreen,
      saveClassification: this.saveClassification,
      deleteClassification: this.deleteClassification,
    };

    return (
      <HotKeys
        id="keyboard-shortcuts"
        className="d-flex flex-column h-100"
        handlers={handlers}
        keyMap={keyMap}
        focused
        tabIndex={-1}
      >
        {this.props.children}
      </HotKeys>
    );
  }
}

KeyboardShortcuts.propTypes = {
  filterModel: PropTypes.object.isRequired,
  pinJob: PropTypes.func.isRequired,
  unPinAll: PropTypes.func.isRequired,
  children: PropTypes.array.isRequired,
  clearSelectedJob: PropTypes.func.isRequired,
  changeSelectedJob: PropTypes.func.isRequired,
  showOnScreenShortcuts: PropTypes.func.isRequired,
  notifications: PropTypes.arrayOf(
    PropTypes.shape({
      created: PropTypes.number.isRequired,
      message: PropTypes.string.isRequired,
      severity: PropTypes.string.isRequired,
      sticky: PropTypes.bool,
    }),
  ).isRequired,
  clearAllOnScreenNotifications: PropTypes.func.isRequired,
  selectedJob: PropTypes.object,
};

KeyboardShortcuts.defaultProps = {
  selectedJob: null,
};

const mapStateToProps = ({ notifications: { notifications } }) => ({
  notifications,
});

export default connect(
  mapStateToProps,
  { clearAllOnScreenNotifications },
)(withPinnedJobs(withSelectedJob(KeyboardShortcuts)));
