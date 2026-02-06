/**
 * Unit tests for the NotificationsMenu component.
 *
 * This component displays recent notifications in a dropdown menu
 * with icons based on severity and the ability to clear all notifications.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';

import NotificationsMenu from '../../../../ui/job-view/headerbars/NotificationsMenu';

const mockStore = configureStore([]);

describe('NotificationsMenu', () => {
  const createNotification = (overrides = {}) => ({
    message: 'Test notification',
    severity: 'info',
    created: Date.now(),
    url: 'https://example.com',
    linkText: 'View details',
    ...overrides,
  });

  const renderWithStore = (initialState = {}) => {
    const store = mockStore({
      notifications: {
        storedNotifications: [],
        ...initialState.notifications,
      },
      ...initialState,
    });
    return {
      ...render(
        <Provider store={store}>
          <NotificationsMenu />
        </Provider>,
      ),
      store,
    };
  };

  const openDropdown = () => {
    // Click the dropdown toggle to open the menu
    const toggle = screen.getByTitle('Recent notifications');
    fireEvent.click(toggle);
  };

  describe('dropdown toggle', () => {
    it('renders bell icon in toggle button', () => {
      renderWithStore();

      expect(screen.getByTitle('Recent notifications')).toBeInTheDocument();
    });

    it('renders dropdown toggle button', () => {
      renderWithStore();

      const toggle = screen.getByRole('button');
      expect(toggle).toHaveClass('btn-view-nav');
      expect(toggle).toHaveClass('nav-menu-btn');
    });
  });

  describe('dropdown header', () => {
    it('shows "Recent notifications" header when dropdown is opened', () => {
      renderWithStore();
      openDropdown();

      // The text appears in both the icon title and the dropdown header
      const elements = screen.getAllByText('Recent notifications');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('empty notifications', () => {
    it('shows "No recent notifications" when list is empty', () => {
      renderWithStore({ notifications: { storedNotifications: [] } });
      openDropdown();

      expect(screen.getByText('No recent notifications')).toBeInTheDocument();
    });

    it('does not show "Clear all" button when empty', () => {
      renderWithStore({ notifications: { storedNotifications: [] } });
      openDropdown();

      expect(screen.queryByText('Clear all')).not.toBeInTheDocument();
    });
  });

  describe('with notifications', () => {
    it('renders notification messages', () => {
      const notifications = [
        createNotification({ message: 'First notification' }),
        createNotification({ message: 'Second notification' }),
      ];
      renderWithStore({
        notifications: { storedNotifications: notifications },
      });
      openDropdown();

      expect(screen.getByText(/First notification/)).toBeInTheDocument();
      expect(screen.getByText(/Second notification/)).toBeInTheDocument();
    });

    it('renders notification link text', () => {
      const notifications = [createNotification({ linkText: 'Click here' })];
      renderWithStore({
        notifications: { storedNotifications: notifications },
      });
      openDropdown();

      expect(screen.getByText('Click here')).toBeInTheDocument();
    });

    it('renders link with correct URL', () => {
      const notifications = [
        createNotification({
          url: 'https://example.com/details',
          linkText: 'View',
        }),
      ];
      renderWithStore({
        notifications: { storedNotifications: notifications },
      });
      openDropdown();

      const link = screen.getByRole('link', { name: 'View' });
      expect(link).toHaveAttribute('href', 'https://example.com/details');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('shows "Clear all" button when notifications exist', () => {
      const notifications = [createNotification()];
      renderWithStore({
        notifications: { storedNotifications: notifications },
      });
      openDropdown();

      expect(screen.getByText('Clear all')).toBeInTheDocument();
    });
  });

  describe('severity icons', () => {
    it('shows correct icon for danger severity', () => {
      const notifications = [
        createNotification({ severity: 'danger', message: 'Error message' }),
      ];
      renderWithStore({
        notifications: { storedNotifications: notifications },
      });
      openDropdown();

      expect(screen.getByTitle('danger')).toBeInTheDocument();
    });

    it('shows correct icon for warning severity', () => {
      const notifications = [
        createNotification({ severity: 'warning', message: 'Warning message' }),
      ];
      renderWithStore({
        notifications: { storedNotifications: notifications },
      });
      openDropdown();

      expect(screen.getByTitle('warning')).toBeInTheDocument();
    });

    it('shows correct icon for info severity', () => {
      const notifications = [
        createNotification({ severity: 'info', message: 'Info message' }),
      ];
      renderWithStore({
        notifications: { storedNotifications: notifications },
      });
      openDropdown();

      expect(screen.getByTitle('info')).toBeInTheDocument();
    });

    it('shows correct icon for success severity', () => {
      const notifications = [
        createNotification({ severity: 'success', message: 'Success message' }),
      ];
      renderWithStore({
        notifications: { storedNotifications: notifications },
      });
      openDropdown();

      expect(screen.getByTitle('success')).toBeInTheDocument();
    });

    it('applies correct text color class based on severity', () => {
      const notifications = [createNotification({ severity: 'danger' })];
      const { container } = renderWithStore({
        notifications: { storedNotifications: notifications },
      });
      openDropdown();

      expect(container.querySelector('.text-danger')).toBeInTheDocument();
    });
  });

  describe('clear all functionality', () => {
    it('dispatches clearStoredNotifications when "Clear all" is clicked', () => {
      const notifications = [createNotification()];
      const { store } = renderWithStore({
        notifications: { storedNotifications: notifications },
      });
      openDropdown();

      fireEvent.click(screen.getByText('Clear all'));

      const actions = store.getActions();
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toContain('CLEAR');
    });

    it('"Clear all" button has correct title when dropdown is open', () => {
      const notifications = [createNotification()];
      renderWithStore({
        notifications: { storedNotifications: notifications },
      });
      openDropdown();

      expect(screen.getByTitle('Clear all notifications')).toBeInTheDocument();
    });
  });

  describe('notification item structure', () => {
    it('displays formatted timestamp', () => {
      const timestamp = new Date('2024-01-15T12:30:00').getTime();
      const notifications = [createNotification({ created: timestamp })];
      renderWithStore({
        notifications: { storedNotifications: notifications },
      });
      openDropdown();

      // Should contain some part of the formatted time
      const timeText = screen.getByText(/1\/15\/2024|Jan 15/);
      expect(timeText).toBeInTheDocument();
    });

    it('renders each notification with message and link', () => {
      const notifications = [
        createNotification({
          message: 'Test message',
          linkText: 'More info',
          url: 'https://example.com',
        }),
      ];
      renderWithStore({
        notifications: { storedNotifications: notifications },
      });
      openDropdown();

      expect(screen.getByText(/Test message/)).toBeInTheDocument();
      expect(screen.getByText('More info')).toBeInTheDocument();
    });
  });
});
