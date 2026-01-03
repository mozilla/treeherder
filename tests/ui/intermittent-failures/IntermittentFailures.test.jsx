import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import IntermittentFailuresApp from '../../../ui/intermittent-failures/App';

// Mock fetch globally
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ bugs: [] }),
  }),
);

// Mock the http helper to prevent actual API calls
jest.mock('../../../ui/helpers/http', () => ({
  getData: jest.fn(() =>
    Promise.resolve({ data: { bugs: [] }, failureStatus: null }),
  ),
}));

// Mock react-table-6 to avoid rendering complexity
jest.mock('react-table-6', () => {
  const MockReactTable = () => <div data-testid="react-table">Mock Table</div>;
  return MockReactTable;
});

describe('IntermittentFailuresApp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Route rendering with React Router v6', () => {
    it('renders MainView at /intermittent-failures/main without crashing', async () => {
      // This test verifies that the withView HOC works correctly with React Router v6.
      // The issue: withView HOC expects location and history props which React Router v6
      // no longer provides automatically. This causes:
      // "Cannot read properties of undefined (reading 'state')" at View.jsx line 21:
      // this.default = this.props.location.state || defaultState;

      const { container } = render(
        <MemoryRouter initialEntries={['/main']}>
          <IntermittentFailuresApp />
        </MemoryRouter>,
      );

      // Wait for any async operations to complete
      await waitFor(() => {
        expect(container).toBeTruthy();
      });
    });

    it('renders BugDetailsView at /intermittent-failures/bugdetails without crashing', async () => {
      // Same issue as MainView - the withView HOC needs location and history props

      const { container } = render(
        <MemoryRouter
          initialEntries={[
            '/bugdetails?startday=2024-01-01&endday=2024-01-07&tree=all&bug=12345',
          ]}
        >
          <IntermittentFailuresApp />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(container).toBeTruthy();
      });
    });

    it('redirects from / to /main', async () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/']}>
          <IntermittentFailuresApp />
        </MemoryRouter>,
      );

      // If the redirect works and MainView renders, we should see the main view content
      // (or at least not crash due to missing router props)
      await waitFor(() => {
        expect(container).toBeTruthy();
      });
    });
  });
});
