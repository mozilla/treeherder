import React from 'react';
import fetchMock from 'fetch-mock';
import { render, cleanup, waitFor } from '@testing-library/react';
import { createBrowserHistory } from 'history';
import { ConnectedRouter } from 'connected-react-router';
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

const history = createBrowserHistory();

const testUsage = () => {
  const store = configureStore(history);
  return (
    <Provider store={store}>
      <ConnectedRouter history={history}>
        <Usage location={history.location} />
      </ConnectedRouter>
    </Provider>
  );
};

describe('Usage', () => {
  const revision = 'bdb000dbec165634372c03ad2a8692ed81bf98a1';

  test('should show 10 facets', async () => {
    const { getAllByTestId } = render(testUsage(), { legacyRoot: true });
    const facets = await waitFor(() => getAllByTestId('facet-link'));

    expect(facets).toHaveLength(10);
  });

  test('should show details about each revision', async () => {
    const { getByTestId } = render(testUsage(), { legacyRoot: true });
    const facet = await waitFor(() => getByTestId(`facet-${revision}`));
    const { children } = facet;

    expect(children[0].children[0].text).toBe(revision);
    expect(children[1].textContent).toBe('mozilla@christophkerschbaumer.com');
    expect(children[3].textContent).toBe('11');
    expect(children[5].textContent).toBe('5');
  });
});
