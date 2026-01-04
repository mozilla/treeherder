/**
 * Unit tests for the taskcluster helper module.
 *
 * This test suite covers:
 * - Credential expiration checking (dayjs migration from moment)
 * - getAction function for action array lookup
 * - tcCredentialsMessage constant
 *
 * Note: The getCredentials function was migrated from moment.js to dayjs
 * for date comparison (isAfter).
 */

import dayjs from '../../../ui/helpers/dayjs';
import {
  getAction,
  tcCredentialsMessage,
} from '../../../ui/helpers/taskcluster';

// We can't easily test the IIFE module's internal getCredentials function directly,
// but we can test that dayjs comparison works as expected in the credential check

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
      try {
        getAction(mockActionArray, 'missing');
      } catch (error) {
        expect(error.message).toContain(
          'Available: retrigger, cancel, schedule',
        );
      }
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

  describe('Credential Expiration Logic (dayjs migration)', () => {
    // These tests verify the dayjs isAfter comparison logic used in getCredentials
    // Even though we can't test getCredentials directly, we verify the date comparison

    describe('dayjs isAfter for credential expiration', () => {
      it('identifies expired credentials correctly', () => {
        const expiredTime = dayjs().subtract(1, 'hour');
        const now = dayjs();

        // Credential is expired when expires is NOT after now
        expect(expiredTime.isAfter(now)).toBe(false);
      });

      it('identifies valid credentials correctly', () => {
        const futureTime = dayjs().add(1, 'hour');
        const now = dayjs();

        // Credential is valid when expires is after now
        expect(futureTime.isAfter(now)).toBe(true);
      });

      it('handles edge case of exact same time', () => {
        const now = dayjs('2024-01-15T12:00:00Z');
        const sameTime = dayjs('2024-01-15T12:00:00Z');

        // Same time is NOT after
        expect(now.isAfter(sameTime)).toBe(false);
      });

      it('parses ISO date strings from credentials', () => {
        // Credentials typically store expires as ISO string
        const expiresString = '2024-12-31T23:59:59Z';
        const expires = dayjs(expiresString);

        expect(expires.isValid()).toBe(true);
        expect(expires.year()).toBe(2024);
      });

      it('compares credentials expiry with current time', () => {
        const credentials = {
          expires: '2099-12-31T23:59:59Z', // Far future
        };

        const isValid = dayjs(credentials.expires).isAfter(dayjs());

        expect(isValid).toBe(true);
      });

      it('handles past expiration dates', () => {
        const credentials = {
          expires: '2020-01-01T00:00:00Z', // Past date
        };

        const isValid = dayjs(credentials.expires).isAfter(dayjs());

        expect(isValid).toBe(false);
      });
    });
  });
});
