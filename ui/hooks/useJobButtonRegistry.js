import { useState, useEffect, useCallback, useRef } from 'react';

import { getUrlParam } from '../helpers/location';

// Registry for JobButton component instances (functional components)
// This allows finding job buttons by their job ID without traversing React internals
const jobButtonRegistry = new Map();

// Track the currently selected job button instance directly
// This avoids race conditions with DOM queries that depend on React's render cycle
let currentlySelectedInstance = null;
let currentlySelectedJobId = null;

export const registerJobButton = (jobId, instance) => {
  jobButtonRegistry.set(String(jobId), instance);
};

export const unregisterJobButton = (jobId) => {
  jobButtonRegistry.delete(String(jobId));
  // If the unregistered job was selected, clear the selection tracking
  if (currentlySelectedJobId === String(jobId)) {
    currentlySelectedInstance = null;
    currentlySelectedJobId = null;
  }
};

export const getJobButtonInstance = (jobId) => {
  return jobButtonRegistry.get(String(jobId));
};

// Get the currently selected job button instance without relying on DOM queries
// This is more reliable than findSelectedInstance which depends on React's render cycle
export const getCurrentlySelectedInstance = () => {
  return currentlySelectedInstance;
};

// Set the currently selected job button instance
export const setCurrentlySelectedInstance = (jobId, instance) => {
  currentlySelectedInstance = instance;
  currentlySelectedJobId = jobId ? String(jobId) : null;
};

// Clear the currently selected instance
export const clearCurrentlySelectedInstance = () => {
  currentlySelectedInstance = null;
  currentlySelectedJobId = null;
};

// Clear all registry state (useful for tests)
export const clearJobButtonRegistry = () => {
  jobButtonRegistry.clear();
  currentlySelectedInstance = null;
  currentlySelectedJobId = null;
};

/**
 * Custom hook for managing JobButton registration and selection state.
 *
 * This hook:
 * - Manages isSelected and isRunnableSelected state
 * - Registers the job button instance in a global registry on mount
 * - Unregisters on unmount
 * - Provides setSelected, toggleRunnableSelected, and refilter callbacks
 *
 * @param {Object} job - The job object
 * @param {Object} filterModel - The filter model for determining job visibility
 * @param {Function} filterPlatformCb - Callback to filter platform based on selection
 * @returns {Object} - { isSelected, isRunnableSelected, setSelected, toggleRunnableSelected, refilter }
 */
export function useJobButtonRegistry(job, filterModel, filterPlatformCb) {
  const urlSelectedTaskRun = getUrlParam('selectedTaskRun');
  const [isSelected, setIsSelected] = useState(
    urlSelectedTaskRun === job.task_run,
  );
  const [isRunnableSelected, setIsRunnableSelected] = useState(false);
  const buttonRef = useRef(null);
  const hasScrolledRef = useRef(false);

  const setSelected = useCallback(
    (selected) => {
      // if a job was just classified, and we are in unclassified only mode,
      // then the job no longer meets the filter criteria. However, if it
      // is still selected, then it should stay visible so that next/previous
      // navigation still works. Then, as soon as the selection changes, it
      // will disappear. So visible must be contingent on the filters AND
      // whether it is still selected.
      job.visible = filterModel.showJob(job);
      setIsSelected(selected);
      // filterPlatformCb will keep a job and platform visible if it contains
      // the selected job, so we must pass in if this job is selected or not.
      filterPlatformCb(selected ? job.task_run : null);
    },
    [job, filterModel, filterPlatformCb],
  );

  const toggleRunnableSelected = useCallback(() => {
    setIsRunnableSelected((prev) => !prev);
  }, []);

  const refilter = useCallback(() => {
    filterPlatformCb(getUrlParam('selectedTaskRun'));
  }, [filterPlatformCb]);

  // Callback ref to attach to the button element - scrolls into view when selected
  const buttonRefCallback = useCallback(
    (element) => {
      buttonRef.current = element;
      // Scroll into view when the element mounts and is selected (only on initial load)
      if (element && isSelected && !hasScrolledRef.current) {
        hasScrolledRef.current = true;
        // Use requestAnimationFrame to ensure the DOM has fully rendered
        requestAnimationFrame(() => {
          if (element && typeof element.scrollIntoView === 'function') {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      }
    },
    [isSelected],
  );

  // Register with job button registry on mount, unregister on unmount
  useEffect(() => {
    const imperativeHandle = {
      props: { job, visible: job.visible },
      setSelected,
      toggleRunnableSelected,
      refilter,
    };

    registerJobButton(job.id, imperativeHandle);

    return () => {
      unregisterJobButton(job.id);
    };
    // We intentionally only run this on mount/unmount and when job.id changes
  }, [job.id]);

  // Update the registry when callbacks change
  useEffect(() => {
    const imperativeHandle = {
      props: { job, visible: job.visible },
      setSelected,
      toggleRunnableSelected,
      refilter,
    };
    registerJobButton(job.id, imperativeHandle);
  }, [job, setSelected, toggleRunnableSelected, refilter]);

  return {
    isSelected,
    isRunnableSelected,
    setSelected,
    toggleRunnableSelected,
    refilter,
    buttonRef: buttonRefCallback,
  };
}
