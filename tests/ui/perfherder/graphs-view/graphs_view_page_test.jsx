import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import fetchMock from 'fetch-mock';

import GraphsView from '../../../../ui/perfherder/graphs/GraphsView';
import repos from '../../mock/repositories';

const frameworks = [{ id: 1, name: 'talos' }];

const renderAt = (url) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <GraphsView projects={repos} frameworks={frameworks} user={{}} />
    </MemoryRouter>,
  );

beforeEach(() => {
  // every API call (changelog, signatures, summaries, ...) returns nothing
  fetchMock.mock('*', []);
});

afterEach(() => {
  cleanup();
  fetchMock.reset();
});

test('Opening the graphs page with no tests selected opens the Add Test Data modal', async () => {
  renderAt('/perfherder/graphs');

  expect(await screen.findByText('Add Test Data')).toBeInTheDocument();
  expect(screen.getByLabelText('Search tests')).toBeInTheDocument();
});

test('Opening the graphs page with tests in the URL does not open the modal', async () => {
  renderAt('/perfherder/graphs?series=mozilla-central,1647494,1,1&timerange=86400');

  // let the initial data requests settle
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });
  });

  expect(screen.queryByText('Add Test Data')).toBeNull();
});
