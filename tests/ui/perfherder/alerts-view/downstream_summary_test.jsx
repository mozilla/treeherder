import fetchMock from 'fetch-mock';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import DownstreamSummary from '../../../../ui/perfherder/alerts/DownstreamSummary';
import { getApiUrl } from '../../../../ui/helpers/url';

describe('DownstreamSummary', () => {
  const alertSummary = {
    id: 12345,
    repository: 'autoland',
    framework: 1,
    alerts: [{ id: 1, series_signature: { suite: 'test-suite' } }],
  };

  beforeEach(() => {
    fetchMock.reset();
    fetchMock.get(
      getApiUrl('/performance/alertsummary/12345/'),
      alertSummary,
    );
  });

  afterEach(() => {
    fetchMock.reset();
  });

  const renderComponent = (props = {}) => {
    const defaultProps = {
      id: 12345,
      alertSummaries: [],
      position: 0,
      updateViewState: jest.fn(),
      ...props,
    };

    return render(
      <MemoryRouter initialEntries={['/perfherder/alerts?id=99999']}>
        <DownstreamSummary {...defaultProps} />
      </MemoryRouter>,
    );
  };

  describe('Link paths (v7_relativeSplatPath fix)', () => {
    test('downstream alert link uses absolute path', async () => {
      renderComponent();

      // Wait for the tooltip text to load (component fetches alert summary)
      await waitFor(() => {
        const link = screen.getByRole('link', { name: '#12345' });
        expect(link).toBeInTheDocument();
      });

      const link = screen.getByRole('link', { name: '#12345' });
      // Should be absolute path, not relative ./alerts?id=12345
      expect(link).toHaveAttribute('href', '/perfherder/alerts?id=12345');
    });

    test('link opens in new tab', async () => {
      renderComponent();

      await waitFor(() => {
        const link = screen.getByRole('link', { name: '#12345' });
        expect(link).toBeInTheDocument();
      });

      const link = screen.getByRole('link', { name: '#12345' });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('Alert summary lookup', () => {
    test('uses cached alert summary if available', async () => {
      const cachedSummary = {
        ...alertSummary,
        alerts: [{ id: 1, series_signature: { suite: 'cached-suite' } }],
      };

      renderComponent({ alertSummaries: [cachedSummary] });

      await waitFor(() => {
        const link = screen.getByRole('link', { name: '#12345' });
        expect(link).toBeInTheDocument();
      });

      // Should not have made a fetch request since summary was cached
      expect(fetchMock.calls().length).toBe(0);
    });

    test('fetches alert summary if not in cache', async () => {
      renderComponent({ alertSummaries: [] });

      await waitFor(() => {
        const link = screen.getByRole('link', { name: '#12345' });
        expect(link).toBeInTheDocument();
      });

      // Should have fetched the summary
      expect(fetchMock.called(getApiUrl('/performance/alertsummary/12345/'))).toBe(true);
    });
  });
});
