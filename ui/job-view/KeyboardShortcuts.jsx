import React from 'react';
import PropTypes from 'prop-types';
import { HotKeys } from 'react-hotkeys';

import { thEvents, thJobNavSelectors } from '../js/constants';

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
  clearSelectedJob: 'escape',
  saveClassification: 'ctrl+enter',
  deleteClassification: 'ctrl+backspace',
};

export default class KeyboardShortcuts extends React.Component {
  constructor(props) {
    super(props);

    const { $injector } = this.props;
    this.$rootScope = $injector.get('$rootScope');
  }

  componentDidMount() {
    this.addRelatedBug = this.addRelatedBug.bind(this);
    this.pinEditComment = this.pinEditComment.bind(this);
    this.quickFilter = this.quickFilter.bind(this);
    this.clearFilter = this.clearFilter.bind(this);
    this.nextUnclassified = this.nextUnclassified.bind(this);
    this.previousUnclassified = this.previousUnclassified.bind(this);
    this.openLogviewer = this.openLogviewer.bind(this);
    this.jobRetrigger = this.jobRetrigger.bind(this);
    this.selectNextTab = this.selectNextTab.bind(this);
    this.clearPinboard = this.clearPinboard.bind(this);
    this.previousJob = this.previousJob.bind(this);
    this.nextJob = this.nextJob.bind(this);
    this.pinJob = this.pinJob.bind(this);
    this.clearSelectedJob = this.clearSelectedJob.bind(this);
    this.saveClassification = this.saveClassification.bind(this);
    this.deleteClassification = this.deleteClassification.bind(this);
    this.toggleOnScreenShortcuts = this.toggleOnScreenShortcuts.bind(this);

    // HotKeys requires focus be a component inside itself to work
    // TODO: We may not need this if we wrap <body> with HotKeys.
    document.getElementById('keyboard-shortcuts').focus();
  }

  /**
   * Job Navigation Shortcuts
   */

  // select next unclassified failure
  nextUnclassified() {
    this.$rootScope.$emit(
      thEvents.changeSelection,
      'next',
      thJobNavSelectors.UNCLASSIFIED_FAILURES);
  }

  // select previous unclassified failure
  previousUnclassified() {
    this.$rootScope.$emit(
      thEvents.changeSelection,
      'previous',
      thJobNavSelectors.UNCLASSIFIED_FAILURES);
  }

  // select previous job
  previousJob() {
    this.$rootScope.$emit(
      thEvents.changeSelection,
      'previous',
      thJobNavSelectors.ALL_JOBS);
  }

  // select next job
  nextJob() {
    this.$rootScope.$emit(
      thEvents.changeSelection,
      'next',
      thJobNavSelectors.ALL_JOBS);
  }

  // close any open panels and clears selected job
  clearSelectedJob() {
    this.$rootScope.$emit(thEvents.clearSelectedJob);
    this.$rootScope.setOnscreenShortcutsShowing(false);
    this.$rootScope.$apply();
  }

  /**
   * Details Panel Shortcuts
   */

  // pin selected job to pinboard
  pinJob() {
    const { selectedJob } = this.props;

    if (selectedJob) {
      this.$rootScope.$emit(thEvents.jobPin, selectedJob);
    }
  }

  // pin selected job to pinboard and add a related bug
  addRelatedBug() {
    const { selectedJob } = this.$rootScope;

    if (selectedJob) {
      this.$rootScope.$emit(thEvents.addRelatedBug, selectedJob);
      document.getElementById('related-bug-input').focus();
    }
  }

  // pin selected job to pinboard and enter classification
  pinEditComment() {
    const { selectedJob } = this.$rootScope;

    if (selectedJob) {
      this.$rootScope.$emit(thEvents.jobPin, selectedJob);
      document.getElementById('classification-comment').focus();
    }
  }

  // clear the PinBoard
  clearPinboard() {
    this.$rootScope.$emit(thEvents.clearPinboard);
  }

  saveClassification() {
    this.$rootScope.$emit(thEvents.saveClassification);
  }

  // delete classification and related bugs
  deleteClassification() {
    const { selectedJob } = this.props;

    if (selectedJob) {
      this.$rootScope.$emit(thEvents.deleteClassification);
    }
  }

  // open the logviewer for the selected job
  openLogviewer() {
    this.$rootScope.$emit(thEvents.openLogviewer);
  }

  // retrigger selected job
  jobRetrigger() {
    const { selectedJob } = this.props;

    if (selectedJob) {
      this.$rootScope.$emit(thEvents.jobRetrigger, selectedJob);
    }
  }

  // select next job tab
  selectNextTab() {
    const { selectedJob } = this.props;

    if (selectedJob) {
      this.$rootScope.$emit(thEvents.selectNextTab);
    }
  }

  /**
   * Filter and Help Shortcuts
   */

  // enter a quick filter
  quickFilter() {
    document.getElementById('quick-filter').focus();
  }

  // clear the quick filter field
  clearFilter() {
    const { filterModel } = this.props;

    filterModel.removeFilter('searchStr');
  }

  toggleOnScreenShortcuts() {
    this.$rootScope.setOnscreenShortcutsShowing(!this.$rootScope.onscreenShortcutsShowing);
    this.$rootScope.$apply();
  }

  doKey(ev, callback) {
    const element = ev.target;

    // If the bug filer is opened, don't let these shortcuts work
    if (document.body.classList.contains('filer-open')) {
      return;
    }

    if ((element.tagName === 'INPUT' &&
      element.type !== 'radio' && element.type !== 'checkbox') ||
      element.tagName === 'SELECT' ||
      element.tagName === 'TEXTAREA' ||
      element.isContentEditable || ev.key === 'shift') {
      return;
    }

    // If we get here, then execute the HotKey.
    ev.preventDefault();
    callback(ev);
  }

  render() {
    const { filterModel } = this.props;
    const handlers = {
      addRelatedBug: ev => this.doKey(ev, this.addRelatedBug),
      pinEditComment: ev => this.doKey(ev, this.pinEditComment),
      quickFilter: ev => this.doKey(ev, this.quickFilter),
      clearFilter: ev => this.doKey(ev, this.clearFilter),
      toggleInProgress: ev => this.doKey(ev, filterModel.toggleInProgress),
      nextUnclassified: ev => this.doKey(ev, this.nextUnclassified),
      previousUnclassified: ev => this.doKey(ev, this.previousUnclassified),
      openLogviewer: ev => this.doKey(ev, this.openLogviewer),
      jobRetrigger: ev => this.doKey(ev, this.jobRetrigger),
      selectNextTab: ev => this.doKey(ev, this.selectNextTab),
      toggleUnclassifiedFailures: ev => this.doKey(ev, filterModel.toggleUnclassifiedFailures),
      clearPinboard: ev => this.doKey(ev, this.clearPinboard),
      previousJob: ev => this.doKey(ev, this.previousJob),
      nextJob: ev => this.doKey(ev, this.nextJob),
      pinJob: ev => this.doKey(ev, this.pinJob),
      toggleOnScreenShortcuts: ev => this.doKey(ev, this.toggleOnScreenShortcuts),
      /* these should happen regardless of being in an input field */
      clearSelectedJob: this.clearSelectedJob,
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
  $injector: PropTypes.object.isRequired,
  children: PropTypes.array.isRequired,
  selectedJob: PropTypes.object,
};

KeyboardShortcuts.defaultProps = {
  selectedJob: null,
};
