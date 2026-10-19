import { useEffect } from 'react';

// Registry for JobGroup component instances, keyed by the group's mapKey.
// Lets the selection code expand a collapsed group (whose job buttons are
// rolled up into a count and therefore not rendered) without traversing
// React internals.
const jobGroupRegistry = new Map();

export const registerJobGroup = (mapKey, instance) => {
  jobGroupRegistry.set(mapKey, instance);
};

export const unregisterJobGroup = (mapKey) => {
  jobGroupRegistry.delete(mapKey);
};

export const getJobGroupInstance = (mapKey) => jobGroupRegistry.get(mapKey);

// Clear all registry state (useful for tests)
export const clearJobGroupRegistry = () => {
  jobGroupRegistry.clear();
};

/**
 * Register a JobGroup's ``setExpanded`` under its map key while mounted.
 *
 * @param {string} mapKey - The group's mapKey (see getGroupMapKey)
 * @param {Function} setExpanded - Setter for the group's expanded state
 */
export function useJobGroupRegistry(mapKey, setExpanded) {
  useEffect(() => {
    registerJobGroup(mapKey, { setExpanded });

    return () => {
      unregisterJobGroup(mapKey);
    };
  }, [mapKey, setExpanded]);
}
