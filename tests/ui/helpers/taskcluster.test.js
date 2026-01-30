/**
 * Unit tests for the taskcluster helper module.
 *
 * This test suite covers:
 * - getAction function for action array lookup
 * - tcCredentialsMessage constant
 */

import { getAction } from '../../../ui/helpers/taskcluster';

describe('Taskcluster Helpers', () => {
  describe('getAction', () => {
    const mockActionArray = [
      { name: 'retrigger', title: 'Retrigger' },
      { name: 'cancel', title: 'Cancel' },
      { name: 'schedule', title: 'Schedule' },
    ];

    it('finds action by name', () => {
      const action = getAction(mockActionArray, 'retrigger');

      expect(action).toEqual({ name: 'retrigger', title: 'Retrigger' });
    });

    it('throws error when action not found', () => {
      expect(() => getAction(mockActionArray, 'nonexistent')).toThrow(
        "'nonexistent' action is not available for this task.  Available: retrigger, cancel, schedule",
      );
    });

    it('error message includes available actions', () => {
      expect(() => getAction(mockActionArray, 'missing')).toThrow(
        'Available: retrigger, cancel, schedule',
      );
    });

    it('handles empty action array', () => {
      expect(() => getAction([], 'retrigger')).toThrow(
        "'retrigger' action is not available for this task.",
      );
    });
  });
});
