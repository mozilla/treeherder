import fetchMock from 'fetch-mock';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import Navigation from '../../../ui/perfherder/Navigation';
import { getApiUrl } from '../../../ui/helpers/url';

describe('Perfherder Navigation', () => {
  const defaultProps = {
    user: {},
    setUser: jest.fn(),
    notify: jest.fn(),
  };

  beforeEach(() => {
    // Mock the user API call made by Login component
    fetchMock.get(getApiUrl('/user/'), []);
  });

  afterEach(() => {
    fetchMock.reset();
  });

  const renderNavigation = (initialPath = '/perfherder/alerts') => {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Navigation {...defaultProps} />
      </MemoryRouter>,
    );
  };

  describe('Navigation links use absolute paths (v7_relativeSplatPath fix)', () => {
    // These tests ensure that navigation links work correctly after the
    // React Router v7 upgrade. The v7_relativeSplatPath behavior change
    // requires absolute paths instead of relative paths in splat routes.

    test('Graphs link has correct absolute path', () => {
      renderNavigation('/perfherder/alerts');
      const graphsLink = screen.getByRole('link', { name: 'Graphs' });
      expect(graphsLink).toHaveAttribute('href', '/perfherder/graphs');
    });

    test('Alerts link has correct absolute path with query params', () => {
      renderNavigation('/perfherder/graphs');
      const alertsLink = screen.getByRole('link', { name: 'Alerts' });
      expect(alertsLink).toHaveAttribute(
        'href',
        '/perfherder/alerts?hideDwnToInv=1&page=1',
      );
    });

    test('Monitoring link has correct absolute path with query params', () => {
      renderNavigation('/perfherder/tests');
      const monitoringLink = screen.getByRole('link', { name: 'Monitoring' });
      expect(monitoringLink).toHaveAttribute(
        'href',
        '/perfherder/alerts?monitoredAlerts=1&page=1',
      );
    });

    test('Tests link has correct absolute path', () => {
      renderNavigation('/perfherder/alerts');
      const testsLink = screen.getByRole('link', { name: 'Tests' });
      expect(testsLink).toHaveAttribute('href', '/perfherder/tests');
    });

    test('Links work correctly when rendered from nested alert route', () => {
      // This specifically tests the scenario that was broken before the fix:
      // When at /perfherder/alerts, relative links like ./graphs would
      // incorrectly resolve to /perfherder/alerts/graphs in React Router v7
      renderNavigation('/perfherder/alerts?id=12345');

      const graphsLink = screen.getByRole('link', { name: 'Graphs' });
      const testsLink = screen.getByRole('link', { name: 'Tests' });

      // These should NOT include 'alerts' in the path
      expect(graphsLink).toHaveAttribute('href', '/perfherder/graphs');
      expect(testsLink).toHaveAttribute('href', '/perfherder/tests');
    });
  });

  describe('External links', () => {
    test('Compare link points to external perf.compare site', () => {
      renderNavigation();
      const compareLink = screen.getByRole('link', { name: 'Compare' });
      expect(compareLink).toHaveAttribute('href', 'https://perf.compare');
      expect(compareLink).toHaveAttribute('target', '_blank');
      expect(compareLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });
});
