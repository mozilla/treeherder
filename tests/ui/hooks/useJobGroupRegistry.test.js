import { renderHook } from '@testing-library/react';

import {
  useJobGroupRegistry,
  registerJobGroup,
  unregisterJobGroup,
  getJobGroupInstance,
  clearJobGroupRegistry,
} from '../../../ui/hooks/useJobGroupRegistry';

describe('useJobGroupRegistry', () => {
  beforeEach(() => {
    clearJobGroupRegistry();
  });

  describe('registry functions', () => {
    it('registers and retrieves a group instance by map key', () => {
      const instance = { setExpanded: jest.fn() };

      registerJobGroup('group-key', instance);

      expect(getJobGroupInstance('group-key')).toBe(instance);
    });

    it('returns undefined for an unknown map key', () => {
      expect(getJobGroupInstance('missing')).toBeUndefined();
    });

    it('unregisters a group instance', () => {
      registerJobGroup('group-key', { setExpanded: jest.fn() });

      unregisterJobGroup('group-key');

      expect(getJobGroupInstance('group-key')).toBeUndefined();
    });
  });

  describe('hook', () => {
    it('registers setExpanded on mount and unregisters on unmount', () => {
      const setExpanded = jest.fn();

      const { unmount } = renderHook(() =>
        useJobGroupRegistry('group-key', setExpanded),
      );

      getJobGroupInstance('group-key').setExpanded(true);
      expect(setExpanded).toHaveBeenCalledWith(true);

      unmount();
      expect(getJobGroupInstance('group-key')).toBeUndefined();
    });
  });
});
