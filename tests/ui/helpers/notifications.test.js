/**
 * Unit tests for the notifications helper module.
 *
 * This test suite covers:
 * - clearExpiredTransientNotifications: Removes expired non-sticky notifications
 * - clearNotificationAtIndex: Removes a notification at a specific index
 */

import {
  MAX_TRANSIENT_AGE,
  clearExpiredTransientNotifications,
  clearNotificationAtIndex,
} from '../../../ui/helpers/notifications';

describe('clearExpiredTransientNotifications', () => {
  it('keeps sticky notifications regardless of age', () => {
    const oldTime = Date.now() - MAX_TRANSIENT_AGE - 1000;
    const notifications = [
      { message: 'sticky', sticky: true, created: oldTime },
      { message: 'also sticky', sticky: true, created: oldTime },
    ];

    const result = clearExpiredTransientNotifications(notifications);

    expect(result.notifications).toHaveLength(2);
    expect(result.notifications[0].message).toBe('sticky');
    expect(result.notifications[1].message).toBe('also sticky');
  });

  it('keeps recent non-sticky notifications', () => {
    const recentTime = Date.now() - 1000; // 1 second ago
    const notifications = [
      { message: 'recent', sticky: false, created: recentTime },
    ];

    const result = clearExpiredTransientNotifications(notifications);

    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0].message).toBe('recent');
  });

  it('removes expired non-sticky notifications', () => {
    const oldTime = Date.now() - MAX_TRANSIENT_AGE - 1000;
    const notifications = [
      { message: 'expired', sticky: false, created: oldTime },
    ];

    const result = clearExpiredTransientNotifications(notifications);

    expect(result.notifications).toHaveLength(0);
  });

  it('keeps only non-expired and sticky notifications', () => {
    const oldTime = Date.now() - MAX_TRANSIENT_AGE - 1000;
    const recentTime = Date.now() - 1000;
    const notifications = [
      { message: 'expired1', sticky: false, created: oldTime },
      { message: 'sticky', sticky: true, created: oldTime },
      { message: 'recent', sticky: false, created: recentTime },
      { message: 'expired2', sticky: false, created: oldTime },
    ];

    const result = clearExpiredTransientNotifications(notifications);

    expect(result.notifications).toHaveLength(2);
    expect(result.notifications.map((n) => n.message)).toEqual([
      'sticky',
      'recent',
    ]);
  });

  it('handles empty array', () => {
    const result = clearExpiredTransientNotifications([]);

    expect(result.notifications).toEqual([]);
  });

  it('returns same reference when no notifications removed', () => {
    const recentTime = Date.now() - 1000;
    const notifications = [
      { message: 'recent', sticky: false, created: recentTime },
    ];

    const result = clearExpiredTransientNotifications(notifications);

    // When no changes, should return same array reference
    expect(result.notifications).toBe(notifications);
  });

  it('returns new array when notifications are removed', () => {
    const oldTime = Date.now() - MAX_TRANSIENT_AGE - 1000;
    const notifications = [
      { message: 'expired', sticky: false, created: oldTime },
    ];

    const result = clearExpiredTransientNotifications(notifications);

    // When changes occur, should return new array
    expect(result.notifications).not.toBe(notifications);
  });

  it('treats undefined sticky as falsy (non-sticky)', () => {
    const oldTime = Date.now() - MAX_TRANSIENT_AGE - 1000;
    const notifications = [{ message: 'no sticky prop', created: oldTime }];

    const result = clearExpiredTransientNotifications(notifications);

    expect(result.notifications).toHaveLength(0);
  });
});

describe('clearNotificationAtIndex', () => {
  it('removes notification at the specified index', () => {
    const notifications = [
      { message: 'first' },
      { message: 'second' },
      { message: 'third' },
    ];

    const result = clearNotificationAtIndex(notifications, 1);

    expect(result.notifications).toHaveLength(2);
    expect(result.notifications[0].message).toBe('first');
    expect(result.notifications[1].message).toBe('third');
  });

  it('removes first notification when index is 0', () => {
    const notifications = [
      { message: 'first' },
      { message: 'second' },
      { message: 'third' },
    ];

    const result = clearNotificationAtIndex(notifications, 0);

    expect(result.notifications).toHaveLength(2);
    expect(result.notifications[0].message).toBe('second');
    expect(result.notifications[1].message).toBe('third');
  });

  it('removes last notification when index is last', () => {
    const notifications = [
      { message: 'first' },
      { message: 'second' },
      { message: 'third' },
    ];

    const result = clearNotificationAtIndex(notifications, 2);

    expect(result.notifications).toHaveLength(2);
    expect(result.notifications[0].message).toBe('first');
    expect(result.notifications[1].message).toBe('second');
  });

  it('returns new array reference', () => {
    const notifications = [{ message: 'only' }];

    const result = clearNotificationAtIndex(notifications, 0);

    expect(result.notifications).not.toBe(notifications);
  });

  it('handles single notification array', () => {
    const notifications = [{ message: 'only' }];

    const result = clearNotificationAtIndex(notifications, 0);

    expect(result.notifications).toHaveLength(0);
  });
});

describe('MAX_TRANSIENT_AGE constant', () => {
  it('is defined and is a positive number', () => {
    expect(typeof MAX_TRANSIENT_AGE).toBe('number');
    expect(MAX_TRANSIENT_AGE).toBeGreaterThan(0);
  });

  it('is 4000ms (4 seconds)', () => {
    expect(MAX_TRANSIENT_AGE).toBe(4000);
  });
});
