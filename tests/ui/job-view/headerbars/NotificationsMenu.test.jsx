/**
 * Unit tests for the NotificationsMenu component.
 *
 * This component displays recent notifications in a dropdown menu
 * with icons based on severity and the ability to clear all notifications.
 */

import { render, screen, fireEvent } from '@testing-library/react';

import NotificationsMenu from '../../../../ui/job-view/headerbars/NotificationsMenu';

// Mock Zustand store
let mockStoredNotifications = [];
const mockClearStoredNotifications = jest.fn();

jest.mock('../../../../ui/job-view/stores/notificationStore', () => ({
  useNotificationStore: (selector) =>
    selector({
      storedNotifications: mockStoredNotifications,
      clearStoredNotifications: mockClearStoredNotifications,
    }),
}));

describe('NotificationsMenu', () => {
  const createNotification = (overrides = {}) => ({
    message: 'Test notification',
    severity: 'info',
    created: Date.now(),
    url: 'https://example.com',
    linkText: 'View details',
    ...overrides,
  });

  const openDropdown = () => {
    // Click the dropdown toggle to open the menu
    const toggle = screen.getByTitle('Recent notifications');
    fireEvent.click(toggle);
  };

  beforeEach(() => {
    mockStoredNotifications = [];
    mockClearStoredNotifications.mockClear();
  });

  describe('dropdown toggle', () => {
    it('renders bell icon in toggle button', () => {
      render(<NotificationsMenu />);

      expect(screen.getByTitle('Recent notifications')).toBeInTheDocument();
    });

    it('renders dropdown toggle button', () => {
      render(<NotificationsMenu />);

      const toggle = screen.getByRole('button');
      expect(toggle).toHaveClass('btn-view-nav');
      expect(toggle).toHaveClass('nav-menu-btn');
    });
  });

  describe('dropdown header', () => {
    it('shows "Recent notifications" header when dropdown is opened', () => {
      render(<NotificationsMenu />);
      openDropdown();

      // The text appears in both the icon title and the dropdown header
      const elements = screen.getAllByText('Recent notifications');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('empty notifications', () => {
    it('shows "No recent notifications" when list is empty', () => {
      mockStoredNotifications = [];
      render(<NotificationsMenu />);
      openDropdown();

      expect(screen.getByText('No recent notifications')).toBeInTheDocument();
    });

    it('does not show "Clear all" button when empty', () => {
      mockStoredNotifications = [];
      render(<NotificationsMenu />);
      openDropdown();

      expect(screen.queryByText('Clear all')).not.toBeInTheDocument();
    });
  });

  describe('with notifications', () => {
    it('renders notification messages', () => {
      mockStoredNotifications = [
        createNotification({ message: 'First notification' }),
        createNotification({ message: 'Second notification' }),
      ];
      render(<NotificationsMenu />);
      openDropdown();

      expect(screen.getByText(/First notification/)).toBeInTheDocument();
      expect(screen.getByText(/Second notification/)).toBeInTheDocument();
    });

    it('renders notification link text', () => {
      mockStoredNotifications = [createNotification({ linkText: 'Click here' })];
      render(<NotificationsMenu />);
      openDropdown();

      expect(screen.getByText('Click here')).toBeInTheDocument();
    });

    it('renders link with correct URL', () => {
      mockStoredNotifications = [
        createNotification({
          url: 'https://example.com/details',
          linkText: 'View',
        }),
      ];
      render(<NotificationsMenu />);
      openDropdown();

      const link = screen.getByRole('link', { name: 'View' });
      expect(link).toHaveAttribute('href', 'https://example.com/details');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('shows "Clear all" button when notifications exist', () => {
      mockStoredNotifications = [createNotification()];
      render(<NotificationsMenu />);
      openDropdown();

      expect(screen.getByText('Clear all')).toBeInTheDocument();
    });
  });

  describe('severity icons', () => {
    it('shows correct icon for danger severity', () => {
      mockStoredNotifications = [
        createNotification({ severity: 'danger', message: 'Error message' }),
      ];
      render(<NotificationsMenu />);
      openDropdown();

      expect(screen.getByTitle('danger')).toBeInTheDocument();
    });

    it('shows correct icon for warning severity', () => {
      mockStoredNotifications = [
        createNotification({ severity: 'warning', message: 'Warning message' }),
      ];
      render(<NotificationsMenu />);
      openDropdown();

      expect(screen.getByTitle('warning')).toBeInTheDocument();
    });

    it('shows correct icon for info severity', () => {
      mockStoredNotifications = [
        createNotification({ severity: 'info', message: 'Info message' }),
      ];
      render(<NotificationsMenu />);
      openDropdown();

      expect(screen.getByTitle('info')).toBeInTheDocument();
    });

    it('shows correct icon for success severity', () => {
      mockStoredNotifications = [
        createNotification({ severity: 'success', message: 'Success message' }),
      ];
      render(<NotificationsMenu />);
      openDropdown();

      expect(screen.getByTitle('success')).toBeInTheDocument();
    });

    it('applies correct text color class based on severity', () => {
      mockStoredNotifications = [createNotification({ severity: 'danger' })];
      const { container } = render(<NotificationsMenu />);
      openDropdown();

      expect(container.querySelector('.text-danger')).toBeInTheDocument();
    });
  });

  describe('clear all functionality', () => {
    it('calls clearStoredNotifications when "Clear all" is clicked', () => {
      mockStoredNotifications = [createNotification()];
      render(<NotificationsMenu />);
      openDropdown();

      fireEvent.click(screen.getByText('Clear all'));

      expect(mockClearStoredNotifications).toHaveBeenCalled();
    });

    it('"Clear all" button has correct title when dropdown is open', () => {
      mockStoredNotifications = [createNotification()];
      render(<NotificationsMenu />);
      openDropdown();

      expect(screen.getByTitle('Clear all notifications')).toBeInTheDocument();
    });
  });

  describe('notification item structure', () => {
    it('displays formatted timestamp', () => {
      const timestamp = new Date('2024-01-15T12:30:00').getTime();
      mockStoredNotifications = [createNotification({ created: timestamp })];
      render(<NotificationsMenu />);
      openDropdown();

      // Should contain some part of the formatted time
      const timeText = screen.getByText(/1\/15\/2024|Jan 15/);
      expect(timeText).toBeInTheDocument();
    });

    it('renders each notification with message and link', () => {
      mockStoredNotifications = [
        createNotification({
          message: 'Test message',
          linkText: 'More info',
          url: 'https://example.com',
        }),
      ];
      render(<NotificationsMenu />);
      openDropdown();

      expect(screen.getByText(/Test message/)).toBeInTheDocument();
      expect(screen.getByText('More info')).toBeInTheDocument();
    });
  });
});
