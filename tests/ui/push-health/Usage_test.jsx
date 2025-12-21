import React from 'react';
import fetchMock from 'fetch-mock';
import { render, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';

import { configureStore } from '../../../ui/job-view/redux/configureStore';
import healthUsage from '../mock/health_usage';
import Usage from '../../../ui/push-health/Usage';

beforeEach(() => {
  fetchMock.get('/api/project/try/push/health_usage/', healthUsage);
});

afterEach(() => {
  cleanup();
  fetchMock.reset();
});

const testUsage = () => {
  const store = configureStore();
  return (
    <Provider store={store}>
      <MemoryRouter>
        <Usage />
      </MemoryRouter>
    </Provider>
  );
};

describe('Usage', () => {
  const revision = 'bdb000dbec165634372c03ad2a8692ed81bf98a1';

  test('should show 10 facets', async () => {
    const { getAllByTestId } = render(testUsage());
    const facets = await waitFor(() => getAllByTestId('facet-link'));

    expect(facets).toHaveLength(10);
  });

  test('should show details about each revision', async () => {
    const { getByTestId } = render(testUsage());
    const facet = await waitFor(() => getByTestId(`facet-${revision}`));
    const { children } = facet;

    expect(children[0].children[0].text).toBe(revision);
    expect(children[1].textContent).toBe('mozilla@christophkerschbaumer.com');
    expect(children[3].textContent).toBe('11');
    expect(children[5].textContent).toBe('5');
  });
});
