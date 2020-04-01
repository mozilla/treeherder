import React from 'react';
import fetchMock from 'fetch-mock';
import { render, cleanup, waitForElement } from '@testing-library/react';

import Usage from '../../../ui/push-health/Usage';
import healthUsage from '../mock/health_usage';

beforeEach(() => {
  fetchMock.get('/api/project/try/push/health_usage/', healthUsage);
});

afterEach(() => {
  cleanup();
  fetchMock.reset();
});

describe('Usage', () => {
  const revision = 'bdb000dbec165634372c03ad2a8692ed81bf98a1';

  test('should show 10 facets', async () => {
    const { getAllByTestId } = render(<Usage />);
    const facets = await waitForElement(() => getAllByTestId('facet-link'));

    expect(facets).toHaveLength(10);
  });

  test('should show details about each revision', async () => {
    const { getByTestId } = render(<Usage />);
    const facet = await waitForElement(() => getByTestId(`facet-${revision}`));
    const { children } = facet;

    expect(children[0].children[0].text).toBe(revision);
    expect(children[1].textContent).toBe('mozilla@christophkerschbaumer.com');
    expect(children[3].textContent).toBe('11');
    expect(children[5].textContent).toBe('5');
  });
});
