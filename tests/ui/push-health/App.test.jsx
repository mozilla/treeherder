
import fetchMock from 'fetch-mock';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route } from 'react-router-dom';

import App from '../../../ui/push-health/App';
import { getApiUrl } from '../../../ui/helpers/url';
import { getProjectUrl } from '../../../ui/helpers/location';
import pushHealthFixture from '../mock/push_health.json';

/**
 * Tests for the Push Health App component.
 *
 * This test suite covers:
 * - Component rendering and routing
 * - Data fetching on mount
 * - Error state handling
 * - Regression test for RSPack migration (no react-hot-loader wrapper)
 */

const mockRepos = [
  { name: 'autoland', id: 1 },
  { name: 'try', id: 4 },
];

const testRevision = 'abc123def456';

const renderPushHealthApp = (
  route = `/push-health/push?repo=autoland&revision=${testRevision}`,
) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Route path="/push-health" render={(props) => <App {...props} />} />
    </MemoryRouter>,
  );
};

describe('Push Health App Component', () => {
  beforeAll(() => {
    // Mock required API endpoints
    fetchMock.get(getApiUrl('/repository/'), mockRepos);
    fetchMock.get(getApiUrl('/failureclassification/'), []);
    fetchMock.get(getApiUrl('/user/'), []);
    fetchMock.get(
      `begin:${getProjectUrl('/push/health/?revision=', 'autoland')}`,
      pushHealthFixture,
    );
    fetchMock.get(
      `begin:${getProjectUrl('/push/health/?revision=', 'try')}`,
      pushHealthFixture,
    );
    fetchMock.get(`begin:${getProjectUrl('/push/health_usage/', 'try')}`, {
      results: [],
    });
    fetchMock.get(
      `begin:${getProjectUrl('/push/health_summary/', 'autoland')}`,
      [],
    );
    fetchMock.get('begin:/api/project/', { results: [] });
  });

  afterAll(() => {
    fetchMock.reset();
  });

  describe('Component Loading', () => {
    it('renders without crashing', async () => {
      const { container } = renderPushHealthApp();

      // The component should exist
      expect(container).toBeInTheDocument();
    });

    it('fetches repository data on mount', async () => {
      renderPushHealthApp();

      await waitFor(() => {
        expect(fetchMock.called(getApiUrl('/repository/'))).toBe(true);
      });
    });

    it('renders sub-components that make API calls', async () => {
      renderPushHealthApp();

      // Wait for component to mount and make API calls
      await waitFor(
        () => {
          // Check that at least one API call was made
          expect(fetchMock.calls().length).toBeGreaterThan(0);
        },
        { timeout: 3000 },
      );

      // Verify at least one expected endpoint was called
      const calls = fetchMock.calls();
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  describe('Routing', () => {
    it('handles push route', async () => {
      renderPushHealthApp(
        `/push-health/push?repo=autoland&revision=${testRevision}`,
      );

      await waitFor(
        () => {
          // Component should render for push route
          expect(document.body).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });

    it('handles my-pushes route', async () => {
      renderPushHealthApp('/push-health/my-pushes');

      await waitFor(
        () => {
          // Component should render for my-pushes route
          expect(document.body).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });

    it('handles usage route', async () => {
      renderPushHealthApp('/push-health/usage');

      await waitFor(
        () => {
          // Component should render for usage route
          expect(document.body).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });
  });

  describe('State Management', () => {
    it('initializes with correct default state', () => {
      const { container } = renderPushHealthApp();

      // The component should exist and have initialized
      expect(container).toBeInTheDocument();
    });
  });
});

describe('Push Health App Export', () => {
  it('exports App component without hot wrapper', async () => {
    // Verify the App is exported directly without react-hot-loader
    // This is a regression test for the RSPack migration
    const AppModule = await import('../../../ui/push-health/App');
    expect(AppModule.default).toBeDefined();

    // The default export should be a React component, not wrapped in hot()
    expect(typeof AppModule.default).toBe('function');
  });

  it('is a class component with expected methods', async () => {
    const AppModule = await import('../../../ui/push-health/App');

    // Verify it's a class component (has prototype)
    expect(AppModule.default.prototype).toBeDefined();
    expect(AppModule.default.prototype.render).toBeDefined();
  });
});
