/**
 * Unit tests for the taskcluster helper module.
 *
 * This test suite covers:
 * - getAction function for action array lookup
 * - tcCredentialsMessage constant
 */

import {
  getAction,
  tcCredentialsMessage,
} from '../../../ui/helpers/taskcluster';

describe('Taskcluster Helpers', () => {
  describe('tcCredentialsMessage', () => {
    it('exports the correct message constant', () => {
      expect(tcCredentialsMessage).toBe(
        'Need to retrieve or renew Taskcluster credentials before action can be performed.',
      );
    });

    it('message is a non-empty string', () => {
      expect(typeof tcCredentialsMessage).toBe('string');
      expect(tcCredentialsMessage.length).toBeGreaterThan(0);
    });
  });

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

    it('returns correct action for cancel', () => {
      const action = getAction(mockActionArray, 'cancel');

      expect(action.name).toBe('cancel');
      expect(action.title).toBe('Cancel');
    });

    it('throws error when action not found', () => {
      expect(() => getAction(mockActionArray, 'nonexistent')).toThrow(
        "'nonexistent' action is not available for this task.",
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

    it('handles single action array', () => {
      const singleAction = [{ name: 'only-action', title: 'Only Action' }];

      const action = getAction(singleAction, 'only-action');

      expect(action.name).toBe('only-action');
    });
  });
});
