import { useCallback } from 'react';
import PropTypes from 'prop-types';
import Hotkeys from 'react-hot-keys';

import { thEvents } from '../helpers/constants';

import { notify, useNotificationStore } from './stores/notificationStore';
import {
  useSelectedJobStore,
  changeJob,
  clearSelectedJob,
  updateJobDetails,
} from './stores/selectedJobStore';
import { pinJob, unPinAll, usePinnedJobsStore } from './stores/pinnedJobsStore';

const handledKeys =
  'b,c,f,ctrl+shift+f,f,g,i,j,k,l,shift+l,n,p,q,r,s,t,u,v,ctrl+shift+u,left,right,space,shift+/,escape,ctrl+enter,ctrl+backspace';

function KeyboardShortcuts({ filterModel, showOnScreenShortcuts, children }) {
  const clearScreen = useCallback(() => {
    const { pinnedJobs } = usePinnedJobsStore.getState();
    const {
      notifications,
      clearAllOnScreenNotifications,
    } = useNotificationStore.getState();

    if (notifications.length) {
      clearAllOnScreenNotifications();
    } else {
      clearSelectedJob(Object.keys(pinnedJobs).length);
      showOnScreenShortcuts(false);
    }
  }, [showOnScreenShortcuts]);

  const doPinJob = useCallback(() => {
    const { selectedJob } = useSelectedJobStore.getState();
    if (selectedJob) {
      pinJob(selectedJob);
    }
  }, []);

  const addRelatedBug = useCallback(async () => {
    const { selectedJob } = useSelectedJobStore.getState();
    if (selectedJob) {
      pinJob(selectedJob);
      document.getElementById('add-related-bug-button').click();
    }
  }, []);

  const pinEditComment = useCallback(() => {
    const { selectedJob } = useSelectedJobStore.getState();
    if (selectedJob) {
      pinJob(selectedJob);
      document.getElementById('classification-comment').focus();
    }
  }, []);

  const clearPinboard = useCallback(() => {
    unPinAll();
  }, []);

  const saveClassification = useCallback(() => {
    window.dispatchEvent(new CustomEvent(thEvents.saveClassification));
  }, []);

  const deleteClassification = useCallback(() => {
    const { selectedJob } = useSelectedJobStore.getState();
    if (selectedJob) {
      window.dispatchEvent(new CustomEvent(thEvents.deleteClassification));
    }
  }, []);

  const openLogviewer = useCallback(() => {
    window.dispatchEvent(new CustomEvent(thEvents.openLogviewer));
  }, []);

  const openRawLog = useCallback(() => {
    window.dispatchEvent(new CustomEvent(thEvents.openRawLog));
  }, []);

  const openGeckoProfile = useCallback(() => {
    window.dispatchEvent(new CustomEvent(thEvents.openGeckoProfile));
  }, []);

  const jobRetrigger = useCallback(() => {
    const { selectedJob } = useSelectedJobStore.getState();
    if (selectedJob) {
      window.dispatchEvent(
        new CustomEvent(thEvents.jobRetrigger, {
          detail: { job: selectedJob },
        }),
      );
    }
  }, []);

  const selectNextTab = useCallback(() => {
    const { selectedJob } = useSelectedJobStore.getState();
    if (selectedJob) {
      window.dispatchEvent(new CustomEvent(thEvents.selectNextTab));
    }
  }, []);

  const quickFilter = useCallback(() => {
    document.getElementById('quick-filter').focus();
  }, []);

  const clearFilter = useCallback(() => {
    filterModel.removeFilter('searchStr');
  }, [filterModel]);

  const changeSelectedJob = useCallback((direction, unclassifiedOnly) => {
    const { pinnedJobs } = usePinnedJobsStore.getState();
    const { selectedJob } = changeJob(
      direction,
      unclassifiedOnly,
      Object.keys(pinnedJobs).length,
      notify,
    );

    if (selectedJob) {
      updateJobDetails(selectedJob);
    }
  }, []);

  const filter = useCallback((e) => {
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
  }, []);

  const onKeyDown = useCallback((key, e) => {
    e.preventDefault();

    switch (key) {
      case 'b':
        return addRelatedBug();
      case 'c':
        return pinEditComment();
      case 'f':
        return quickFilter();
      case 'ctrl+shift+f':
        return clearFilter();
      case 'g':
        return openGeckoProfile();
      case 'i':
        return filterModel.toggleInProgress();
      case 'j':
        return changeSelectedJob('next', true);
      case 'k':
        return changeSelectedJob('previous', true);
      case 'l':
        return openLogviewer();
      case 'shift+l':
        return openRawLog();
      case 'n':
        return changeSelectedJob('next', true);
      case 'p':
        return changeSelectedJob('previous', true);
      case 'q':
        return filterModel.toggleClassifiedFailures(true);
      case 'r':
        return jobRetrigger();
      case 's':
        return filterModel.toggleUnscheduledResultStatus();
      case 't':
        return selectNextTab();
      case 'u':
        return filterModel.toggleUnclassifiedFailures();
      case 'ctrl+shift+u':
        return clearPinboard();
      case 'left':
        return changeSelectedJob('previous', false);
      case 'right':
        return changeSelectedJob('next', false);
      case 'space':
        return doPinJob();
      case 'shift+/':
        return showOnScreenShortcuts();
      case 'escape':
        return clearScreen();
      case 'ctrl+enter':
        return saveClassification();
      case 'ctrl+backspace':
        return deleteClassification();
    }
  }, [
    addRelatedBug, pinEditComment, quickFilter, clearFilter, openGeckoProfile,
    filterModel, changeSelectedJob, openLogviewer, openRawLog, jobRetrigger,
    selectNextTab, clearPinboard, doPinJob, showOnScreenShortcuts, clearScreen,
    saveClassification, deleteClassification,
  ]);

  return (
    <Hotkeys
      keyName={handledKeys}
      onKeyDown={onKeyDown}
      filter={filter}
    >
      {children}
    </Hotkeys>
  );
}

KeyboardShortcuts.propTypes = {
  filterModel: PropTypes.shape({}).isRequired,
  children: PropTypes.arrayOf(PropTypes.element).isRequired,
  showOnScreenShortcuts: PropTypes.func.isRequired,
};

export default KeyboardShortcuts;
