import {
  act,
  render,
  cleanup,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';

import fetchMock from 'fetch-mock';

import TestDataModal from '../../../../ui/perfherder/graphs/TestDataModal';
import { getApiUrl } from '../../../../ui/helpers/url';
import { getProjectUrl } from '../../../../ui/helpers/location';
import { buildSearchText } from '../../../../ui/perfherder/perf-helpers/helpers';
import linuxSeries from '../../mock/performance_signature_formatted.json';
import windowsSeries from '../../mock/performance_signature_formatted2.json';
import seriesWithRepeatedTag from '../../mock/performance_signature_with_repeated_tag.json';
import repos from '../../mock/repositories';

const frameworks = [
  { id: 1, name: 'talos' },
  { id: 2, name: 'build_metrics' },
];

const indexed = (list) =>
  list.map((series) => ({
    ...series,
    searchText: buildSearchText(series, frameworks),
  }));

const autolandSeries = indexed(
  linuxSeries.slice(0, 2).map((series) => ({
    ...series,
    id: series.id + 1000000,
    projectName: 'autoland',
    frameworkId: 2,
  })),
);

const defaultSignatures = {
  'mozilla-central': indexed([...linuxSeries, ...windowsSeries]),
  autoland: autolandSeries,
  'mozilla-beta': [],
  try: [],
};

const makeLoader = (signatures = defaultSignatures) =>
  jest.fn(async (repo) =>
    signatures[repo] instanceof Error
      ? { data: signatures[repo].message, failureStatus: 500 }
      : { data: signatures[repo] || [], failureStatus: null },
  );

const renderModal = (props = {}) => {
  const loadSignatures = props.loadSignatures || makeLoader();
  const allProps = {
    projects: repos,
    plottedUnits: new Set([]),
    timeRange: { value: 172800, text: 'Last two days' },
    getTestData: jest.fn(),
    updateTestsAndTimeRange: jest.fn(),
    options: {},
    testData: [],
    frameworks,
    showModal: true,
    toggle: jest.fn(),
    loadSubtests: jest.fn(),
    ...props,
    loadSignatures,
  };
  const result = render(<TestDataModal {...allProps} />);
  return { ...result, props: allProps };
};

const rows = (getByTestId) =>
  within(getByTestId('tests')).queryAllByRole('row');

const search = (getByLabelText, text) =>
  fireEvent.change(getByLabelText('Search tests'), {
    target: { value: text },
  });

const waitForRows = async (getByTestId, count) =>
  waitFor(() => expect(rows(getByTestId)).toHaveLength(count));

// the filter row labels, as opposed to e.g. the "Framework" column header
const facetLabel = { selector: '.test-search-facet-title' };

const openPlatforms = (getByRole) =>
  fireEvent.click(getByRole('button', { name: /^Platform filter:/ }));

// option labels read "<platform> <count>"
const platformOptions = (getByRole) =>
  within(
    getByRole('button', { name: /^Platform filter:/ }).parentElement,
  )
    .getAllByRole('checkbox')
    .map((box) => box.labels[0].textContent);

const tickPlatform = (getByLabelText, platform) =>
  fireEvent.click(getByLabelText(new RegExp(`^${platform} \\d+$`)));

const openMoreFilters = (getByRole) =>
  fireEvent.click(getByRole('button', { name: /More filters/ }));

const allDefaultCount =
  linuxSeries.length + windowsSeries.length + autolandSeries.length;

afterEach(() => {
  cleanup();
  localStorage.clear();
});

test('Loads mozilla-central and autoland by default, but not mozilla-beta or try', async () => {
  const loadSignatures = makeLoader();
  const { getByTestId } = renderModal({ loadSignatures });

  await waitForRows(getByTestId, allDefaultCount);

  const loadedRepos = loadSignatures.mock.calls.map(([repo]) => repo);
  expect(loadedRepos.sort()).toEqual(
    ['autoland', 'mozilla-central'],
  );
});

test('Signatures are not loaded until the modal is shown', () => {
  const loadSignatures = makeLoader();
  renderModal({ loadSignatures, showModal: false });

  expect(loadSignatures).not.toHaveBeenCalled();
});

test('Selecting the try repository loads it and remembers the choice', async () => {
  const loadSignatures = makeLoader();
  const { getByRole, getByTestId } = renderModal({ loadSignatures });
  await waitForRows(getByTestId, allDefaultCount);

  fireEvent.click(getByRole('button', { name: 'try' }));

  await waitFor(() =>
    expect(loadSignatures.mock.calls.map(([repo]) => repo)).toContain('try'),
  );
  expect(
    JSON.parse(localStorage.getItem('perfherder-graphs-test-search-repos')),
  ).toContain('try');
});

test('Without a saved choice mozilla-central and autoland are selected; a saved choice is restored on the next page load', async () => {
  // chip names gain the spinner's label while a repository loads
  const chip = (screen, repo) =>
    screen.findByRole('button', { name: new RegExp(`^${repo}`) });
  const pressed = async (screen, repo) =>
    (await chip(screen, repo)).getAttribute('aria-pressed');

  const first = renderModal();
  await waitForRows(first.getByTestId, allDefaultCount);
  expect(await pressed(first, 'mozilla-central')).toBe('true');
  expect(await pressed(first, 'autoland')).toBe('true');
  expect(await pressed(first, 'mozilla-beta')).toBe('false');
  expect(await pressed(first, 'try')).toBe('false');

  fireEvent.click(await chip(first, 'mozilla-beta'));
  fireEvent.click(await chip(first, 'autoland'));
  first.unmount();

  // a new page load (fresh component) restores the saved choice
  const second = renderModal();
  expect(await pressed(second, 'mozilla-central')).toBe('true');
  expect(await pressed(second, 'mozilla-beta')).toBe('true');
  expect(await pressed(second, 'autoland')).toBe('false');
});

test('Deselecting a repository removes its tests from the results', async () => {
  const { getByRole, getByTestId, queryByTestId } = renderModal();
  await waitForRows(getByTestId, allDefaultCount);

  fireEvent.click(getByRole('button', { name: 'autoland' }));

  await waitForRows(getByTestId, allDefaultCount - autolandSeries.length);
  expect(queryByTestId(autolandSeries[0].id.toString())).toBeNull();
});

test('Search matches across platform, name and repository in any order', async () => {
  const { getByLabelText, getByTestId } = renderModal();
  await waitForRows(getByTestId, allDefaultCount);

  search(getByLabelText, 'a11yr windows7');

  await waitForRows(getByTestId, 1);
  expect(getByTestId(windowsSeries[0].id.toString())).toBeInTheDocument();

  search(getByLabelText, 'autoland about_preferences');

  await waitForRows(getByTestId, 1);
  expect(getByTestId(autolandSeries[1].id.toString())).toBeInTheDocument();
});

test('The platform dropdown lists platforms alphabetically with counts and filters the results', async () => {
  const { getByLabelText, getByRole, getByTestId } = renderModal();
  await waitForRows(getByTestId, allDefaultCount);
  const toggle = getByRole('button', { name: /^Platform filter:/ });
  expect(toggle).toHaveAccessibleName('Platform filter: All platforms');

  openPlatforms(getByRole);

  expect(platformOptions(getByRole)).toEqual(['linux64 6', 'windows7-32 3']);

  tickPlatform(getByLabelText, 'windows7-32');

  await waitForRows(getByTestId, windowsSeries.length);
  expect(toggle).toHaveAccessibleName('Platform filter: windows7-32');
  expect(getByLabelText(/^windows7-32 \d+$/)).toBeChecked();
});

test('Framework chips filter the results', async () => {
  const { getByRole, getByTestId } = renderModal();
  await waitForRows(getByTestId, allDefaultCount);
  openMoreFilters(getByRole);

  fireEvent.click(getByRole('button', { name: /^build_metrics/ }));

  await waitForRows(getByTestId, autolandSeries.length);
});

test('Tag used in multiple tests appears once in the tags list', async () => {
  const loadSignatures = makeLoader({
    'mozilla-central': indexed(seriesWithRepeatedTag),
  });
  const { getByRole, getAllByRole, getByTestId } = renderModal({ loadSignatures });
  await waitForRows(getByTestId, seriesWithRepeatedTag.length);
  openMoreFilters(getByRole);

  expect(getAllByRole('button', { name: 'repeated-tag' })).toHaveLength(1);
});

test('Selecting two tags shows the tests that have both tags; clicking again removes one', async () => {
  const loadSignatures = makeLoader({
    'mozilla-central': indexed(seriesWithRepeatedTag),
  });
  const [tag1, tag2] = seriesWithRepeatedTag[0].tags;
  const { getByRole, getByTestId } = renderModal({ loadSignatures });
  await waitForRows(getByTestId, seriesWithRepeatedTag.length);
  openMoreFilters(getByRole);

  fireEvent.click(getByRole('button', { name: tag1 }));
  fireEvent.click(getByRole('button', { name: tag2 }));

  await waitForRows(getByTestId, 1);

  fireEvent.click(getByRole('button', { name: tag1 }));

  await waitForRows(getByTestId, seriesWithRepeatedTag.length);
});

test('Tag chips are not shown when no test has tags', async () => {
  const loadSignatures = makeLoader({
    'mozilla-central': indexed(
      linuxSeries.map((series) => ({ ...series, tags: [] })),
    ),
  });
  const { getByRole, getByTestId, queryByText } = renderModal({ loadSignatures });
  await waitForRows(getByTestId, linuxSeries.length);
  openMoreFilters(getByRole);

  expect(queryByText('Tags')).toBeNull();
});

test('Clicking a test selects it; clicking it in the selected list removes it', async () => {
  const { getByTestId } = renderModal();
  await waitForRows(getByTestId, allDefaultCount);

  fireEvent.click(getByTestId(linuxSeries[1].id.toString()));

  const selectedTests = getByTestId('selectedTests');
  const selected = await waitFor(() =>
    within(selectedTests).getByRole('button', {
      name: /mozilla-central linux64 about_preferences_basic/,
    }),
  );
  expect(
    within(getByTestId(linuxSeries[1].id.toString())).getByRole('checkbox'),
  ).toBeChecked();

  fireEvent.click(selected);

  await waitFor(() => expect(selectedTests.children).toHaveLength(0));
});

test('Tests already on the graph are shown checked and cannot be selected again', async () => {
  const plotted = linuxSeries[0];
  const { getByTestId } = renderModal({
    testData: [{ signature_id: plotted.id, visible: true }],
  });
  await waitForRows(getByTestId, allDefaultCount);

  const row = getByTestId(plotted.id.toString());
  const checkbox = within(row).getByRole('checkbox');
  expect(checkbox).toBeChecked();
  expect(checkbox).toBeDisabled();

  fireEvent.click(row);

  expect(getByTestId('selectedTests').children).toHaveLength(0);
});

test('Tests with a different unit than what is selected show a warning', async () => {
  const { getByTestId, queryAllByTitle } = renderModal();
  await waitForRows(getByTestId, allDefaultCount);

  expect(queryAllByTitle(/^Warning:/)).toHaveLength(0);

  // dromaeo_dom's unit is "score", while the other tests don't have any
  fireEvent.click(getByTestId(linuxSeries[0].id.toString()));

  await waitFor(() =>
    expect(queryAllByTitle(/^Warning:/)).toEqual([
      getByTestId(linuxSeries[3].id.toString()),
    ]),
  );
});

test('Plotting sends the selected tests, closes the modal and keeps the search', async () => {
  const { getByLabelText, getByRole, getByTestId, props } = renderModal();
  await waitForRows(getByTestId, allDefaultCount);

  search(getByLabelText, 'autoland');
  await waitForRows(getByTestId, autolandSeries.length);
  fireEvent.click(getByTestId(autolandSeries[0].id.toString()));
  fireEvent.click(getByRole('button', { name: 'Plot graphs (1)' }));

  expect(props.getTestData).toHaveBeenCalledWith([
    {
      repository_name: 'autoland',
      signature_id: autolandSeries[0].id,
      framework_id: 2,
      replicates: false,
    },
  ]);
  expect(props.toggle).toHaveBeenCalled();
  expect(getByLabelText('Search tests')).toHaveValue('autoland');
  expect(getByTestId('selectedTests').children).toHaveLength(0);
});

test('Plotting with a different time range updates the time range too', async () => {
  const { getByRole, getByTestId, getByText, props } = renderModal();
  await waitForRows(getByTestId, allDefaultCount);

  fireEvent.click(getByRole('button', { name: 'Last 30 days' }));
  fireEvent.click(await waitFor(() => getByText('Last 7 days')));
  await waitForRows(getByTestId, allDefaultCount);
  fireEvent.click(getByTestId(linuxSeries[0].id.toString()));
  fireEvent.click(getByRole('button', { name: 'Plot graphs (1)' }));

  expect(props.getTestData).not.toHaveBeenCalled();
  expect(props.updateTestsAndTimeRange).toHaveBeenCalledWith(
    [expect.objectContaining({ signature_id: linuxSeries[0].id })],
    expect.objectContaining({ value: 604800 }),
  );
});

test('Arrow keys move through the results, Enter selects and Ctrl+Enter plots', async () => {
  const { getByLabelText, getByTestId, props } = renderModal();
  await waitForRows(getByTestId, allDefaultCount);
  const input = getByLabelText('Search tests');

  search(getByLabelText, 'linux64 mozilla-central');
  await waitForRows(getByTestId, linuxSeries.length);

  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.keyDown(input, { key: 'Enter' });

  const secondRow = rows(getByTestId)[1];
  expect(secondRow).toHaveClass('table-active');
  expect(within(secondRow).getByRole('checkbox')).toBeChecked();

  fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });

  expect(props.getTestData).toHaveBeenCalledWith([
    expect.objectContaining({ signature_id: Number(secondRow.dataset.testid) }),
  ]);
});

test('Only the first 200 results are rendered', async () => {
  const many = indexed(
    Array.from({ length: 250 }, (_, i) => ({
      ...linuxSeries[0],
      id: i + 1,
      name: `test${String(i).padStart(3, '0')} opt`,
    })),
  );
  const { getByRole, getByTestId } = renderModal({
    loadSignatures: makeLoader({ 'mozilla-central': many }),
  });

  await waitForRows(getByTestId, 200);
  expect(getByRole('status')).toHaveTextContent('Showing 200 of 250 tests');
});

test('A repository that fails to load shows an error without hiding the others', async () => {
  const { getByTestId, getByText } = renderModal({
    loadSignatures: makeLoader({
      ...defaultSignatures,
      autoland: new Error('server error'),
    }),
  });

  await waitForRows(getByTestId, linuxSeries.length + windowsSeries.length);
  expect(getByText('autoland: server error')).toBeInTheDocument();
});

test('Related platforms option shows the same test on other platforms', async () => {
  const relatedSeries = {
    ...linuxSeries[0],
    repository_name: 'mozilla-central',
    framework_id: 1,
  };
  const { getByLabelText, getByTestId, getByText } = renderModal({
    options: { option: 'addRelatedPlatform', relatedSeries },
  });

  await waitForRows(getByTestId, 1);
  expect(getByTestId(windowsSeries[0].id.toString())).toBeInTheDocument();
  expect(getByText(/Same test on other platforms as/)).toBeInTheDocument();

  fireEvent.click(getByLabelText('Show all tests'));

  await waitForRows(getByTestId, allDefaultCount);
});

test('Related configurations option shows other tests of the same suite', async () => {
  const relatedSeries = {
    ...autolandSeries[0],
    name: 'a11yr opt',
    repository_name: 'autoland',
    framework_id: 2,
  };
  const { getByTestId } = renderModal({
    options: { option: 'addRelatedConfigs', relatedSeries },
  });

  await waitForRows(getByTestId, 1);
  expect(getByTestId(autolandSeries[0].id.toString())).toBeInTheDocument();
});

test('Expanding a test with subtests loads and shows them', async () => {
  const parent = linuxSeries[0];
  const subtest = {
    ...parent,
    id: 42,
    name: 'a11yr dhtml.html opt e10s stylo',
    hasSubtests: false,
    parentSignature: parent.signature,
  };
  const loadSubtests = jest.fn(async () => ({
    data: [subtest],
    failureStatus: null,
  }));
  const { getAllByTitle, getByTestId } = renderModal({ loadSubtests });
  await waitForRows(getByTestId, allDefaultCount);

  fireEvent.click(
    within(getByTestId(parent.id.toString())).getByTitle('Show subtests'),
  );

  await waitFor(() => expect(getByTestId('42')).toBeInTheDocument());
  expect(loadSubtests).toHaveBeenCalledWith(
    expect.objectContaining({ id: parent.id }),
    2592000,
  );
  // expanding doesn't select the parent
  expect(getByTestId('selectedTests').children).toHaveLength(0);

  fireEvent.click(getAllByTitle('Hide subtests')[0]);

  await waitFor(() => expect(within(getByTestId('tests')).queryByTestId('42')).toBeNull());
});

test('A search with no results suggests including subtests, and the suggestion includes them', async () => {
  const subtest = {
    ...linuxSeries[0],
    id: 42,
    name: 'a11yr dhtml.html opt e10s stylo',
    hasSubtests: false,
    parentSignature: linuxSeries[0].signature,
  };
  const loadSignatures = jest.fn(async (repo, interval, fw, { subtests }) => ({
    data:
      repo === 'mozilla-central'
        ? indexed(subtests ? [...linuxSeries, subtest] : linuxSeries)
        : [],
    failureStatus: null,
  }));
  const {
    getAllByTitle,
    getByLabelText,
    getByRole,
    getByTestId,
    queryAllByTitle,
    queryByTestId,
  } = renderModal({ loadSignatures });

  // off by default: parents have expanders and only their lists are loaded
  expect(getByRole('button', { name: 'Include subtests' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await waitForRows(getByTestId, linuxSeries.length);
  expect(getAllByTitle('Show subtests').length).toBeGreaterThan(0);
  expect(queryByTestId('no-matches')).toBeNull();

  search(getByLabelText, 'dhtml');

  const noMatches = await waitFor(() => getByTestId('no-matches'));
  expect(noMatches).toHaveTextContent('No tests match.');
  fireEvent.click(within(noMatches).getByRole('button', { name: 'Include subtests' }));

  await waitForRows(getByTestId, 1);
  expect(getByTestId('42')).toBeInTheDocument();
  expect(queryByTestId('no-matches')).toBeNull();
  expect(loadSignatures).toHaveBeenCalledWith(
    'mozilla-central',
    2592000,
    frameworks,
    { subtests: true },
  );
  // the filter chip reflects it, and subtests are regular rows now
  expect(
    getAllByTitle('Search subtests too (loads about twice as much data)')[0],
  ).toHaveAttribute('aria-pressed', 'true');
  search(getByLabelText, '');
  await waitForRows(getByTestId, linuxSeries.length + 1);
  expect(queryAllByTitle('Show subtests')).toHaveLength(0);
});

test('No subtests suggestion is shown once subtests are included', async () => {
  const { getByLabelText, getByRole, getByTestId } = renderModal();
  await waitForRows(getByTestId, allDefaultCount);

  fireEvent.click(getByRole('button', { name: 'Include subtests' }));
  search(getByLabelText, 'no such test');

  const noMatches = await waitFor(() => getByTestId('no-matches'));
  expect(noMatches).toHaveTextContent('No tests match.');
  expect(within(noMatches).queryByRole('button')).toBeNull();
});

test('A selected framework stays visible and can be cleared when nothing matches it', async () => {
  const { getByLabelText, getByRole, getByTestId } = renderModal();
  await waitForRows(getByTestId, allDefaultCount);
  openMoreFilters(getByRole);

  fireEvent.click(getByRole('button', { name: /^talos/ }));
  // only the autoland copies are build_metrics, so talos matches nothing
  search(getByLabelText, 'autoland');
  await waitForRows(getByTestId, 0);

  const talosChip = getByRole('button', { name: /^talos/ });
  expect(talosChip).toHaveAttribute('aria-pressed', 'true');
  expect(talosChip).toHaveTextContent('talos0');

  fireEvent.click(talosChip);

  await waitForRows(getByTestId, autolandSeries.length);
});

test('Related branches option loads the other performance branches even when not selected', async () => {
  const autolandCopy = indexed([
    { ...linuxSeries[0], id: 7, projectName: 'autoland' },
  ]);
  const loadSignatures = makeLoader({
    'mozilla-central': indexed(linuxSeries),
    autoland: autolandCopy,
  });
  const { getByRole, getByTestId, props, rerender } = renderModal({
    loadSignatures,
  });
  await waitForRows(getByTestId, linuxSeries.length + 1);

  // the user is only looking at mozilla-central...
  fireEvent.click(getByRole('button', { name: 'autoland' }));
  await waitForRows(getByTestId, linuxSeries.length);

  // ...then opens "Same test on other branches" from a legend card
  rerender(
    <TestDataModal
      {...props}
      options={{
        option: 'addRelatedBranches',
        relatedSeries: {
          ...linuxSeries[0],
          repository_name: 'mozilla-central',
          framework_id: 1,
        },
      }}
    />,
  );

  await waitForRows(getByTestId, 1);
  expect(getByTestId('7')).toBeInTheDocument();
  expect(getByRole('button', { name: 'autoland' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // the shortcut doesn't change the saved selection
  expect(
    JSON.parse(localStorage.getItem('perfherder-graphs-test-search-repos')),
  ).toEqual(['mozilla-central']);
});

test('A rejected request shows an error, stops loading and can be retried', async () => {
  let autolandAttempts = 0;
  const loadSignatures = jest.fn(async (repo) => {
    if (repo === 'autoland') {
      autolandAttempts += 1;
      if (autolandAttempts === 1) throw new TypeError('Failed to fetch');
      return { data: autolandSeries, failureStatus: null };
    }
    return { data: repo === 'mozilla-central' ? indexed(linuxSeries) : [], failureStatus: null };
  });
  const { getByRole, getByTestId, getByText, queryByLabelText } = renderModal({
    loadSignatures,
  });

  await waitFor(() =>
    expect(
      getByText('autoland: failed to load tests (Failed to fetch)'),
    ).toBeInTheDocument(),
  );
  await waitForRows(getByTestId, linuxSeries.length);
  expect(queryByLabelText('Loading autoland')).toBeNull();

  // deselecting and reselecting the repository retries it
  fireEvent.click(getByRole('button', { name: 'autoland' }));
  fireEvent.click(getByRole('button', { name: 'autoland' }));

  await waitForRows(getByTestId, linuxSeries.length + autolandSeries.length);
  expect(autolandAttempts).toBe(2);
});

test('A rejected subtest request shows an error instead of loading forever', async () => {
  const loadSubtests = jest.fn(async () => {
    throw new TypeError('Failed to fetch');
  });
  const { getByTestId, getByText } = renderModal({ loadSubtests });
  await waitForRows(getByTestId, allDefaultCount);

  fireEvent.click(
    within(getByTestId(linuxSeries[0].id.toString())).getByTitle(
      'Show subtests',
    ),
  );

  await waitFor(() =>
    expect(getByText('Failed to load subtests')).toBeInTheDocument(),
  );
});

test('Tests are listed for the last 30 days, without changing the graph time range', async () => {
  const loadSignatures = makeLoader();
  const { getByRole, getByTestId, props } = renderModal({ loadSignatures });
  await waitForRows(getByTestId, allDefaultCount);

  expect(getByRole('button', { name: 'Last 30 days' })).toBeInTheDocument();
  expect(loadSignatures).toHaveBeenCalledWith(
    'mozilla-central',
    2592000,
    frameworks,
    { subtests: false },
  );

  fireEvent.click(getByTestId(linuxSeries[0].id.toString()));
  fireEvent.click(getByRole('button', { name: 'Plot graphs (1)' }));

  // the graph keeps its own (two day) range
  expect(props.updateTestsAndTimeRange).not.toHaveBeenCalled();
  expect(props.getTestData).toHaveBeenCalledWith([
    expect.objectContaining({ signature_id: linuxSeries[0].id }),
  ]);
});

const columnValues = (getByTestId, column) =>
  rows(getByTestId).map((row) => row.children[column].textContent);

test('Clicking a column header sorts the results, clicking again reverses them', async () => {
  const { getByRole, getByTestId } = renderModal();
  await waitForRows(getByTestId, allDefaultCount);
  const platformHeader = getByRole('button', { name: 'Platform' });

  fireEvent.click(platformHeader);

  const ascending = columnValues(getByTestId, 3);
  expect(ascending).toEqual([...ascending].sort());
  expect(ascending[0]).toBe('linux64');
  expect(platformHeader.closest('th')).toHaveAttribute('aria-sort', 'ascending');
  expect(platformHeader).toHaveTextContent('Platform ▲');

  fireEvent.click(platformHeader);

  expect(columnValues(getByTestId, 3)).toEqual([...ascending].reverse());
  expect(platformHeader.closest('th')).toHaveAttribute(
    'aria-sort',
    'descending',
  );
});

test('Sorting by repository and framework uses their names', async () => {
  const { getByRole, getByTestId } = renderModal();
  await waitForRows(getByTestId, allDefaultCount);

  fireEvent.click(getByRole('button', { name: 'Repository' }));
  expect(columnValues(getByTestId, 4)[0]).toBe('autoland');

  fireEvent.click(getByRole('button', { name: 'Framework' }));
  // build_metrics sorts before talos
  expect(columnValues(getByTestId, 5)[0]).toBe('build_metrics');
});

test('Tests without a value in the sorted column are listed last', async () => {
  const { getByRole, getByTestId } = renderModal();
  await waitForRows(getByTestId, allDefaultCount);
  const unitHeader = getByRole('button', { name: 'Unit' });

  // only dromaeo_dom has a unit ("score")
  fireEvent.click(unitHeader);
  expect(rows(getByTestId)[0]).toBe(getByTestId(linuxSeries[3].id.toString()));

  fireEvent.click(unitHeader);
  expect(rows(getByTestId)[0]).toBe(getByTestId(linuxSeries[3].id.toString()));
});

test('The platform filter box narrows the options; several can be ticked and cleared', async () => {
  const { getByLabelText, getByRole, getByTestId, getByText } = renderModal();
  await waitForRows(getByTestId, allDefaultCount);
  const toggle = getByRole('button', { name: /^Platform filter:/ });
  openPlatforms(getByRole);
  const filterBox = getByLabelText('Filter platforms');

  fireEvent.change(filterBox, { target: { value: 'WIN' } });
  expect(platformOptions(getByRole)).toEqual(['windows7-32 3']);

  fireEvent.change(filterBox, { target: { value: 'zzz' } });
  expect(getByText('No platforms match "zzz".')).toBeInTheDocument();

  fireEvent.change(filterBox, { target: { value: '' } });
  tickPlatform(getByLabelText, 'linux64');
  tickPlatform(getByLabelText, 'windows7-32');

  expect(toggle).toHaveAccessibleName('Platform filter: 2 platforms');
  await waitForRows(getByTestId, allDefaultCount);

  fireEvent.click(getByRole('button', { name: 'Clear' }));

  expect(toggle).toHaveAccessibleName('Platform filter: All platforms');
});

test('Closing the platform dropdown clears its filter box', async () => {
  const { getByLabelText, getByRole, getByTestId } = renderModal();
  await waitForRows(getByTestId, allDefaultCount);

  openPlatforms(getByRole);
  fireEvent.change(getByLabelText('Filter platforms'), {
    target: { value: 'win' },
  });
  // the toggle closes it again
  openPlatforms(getByRole);
  openPlatforms(getByRole);

  await waitFor(() =>
    expect(getByLabelText('Filter platforms')).toHaveValue(''),
  );
});

describe('Browser filter', () => {
  const browserSeries = indexed(
    [
      ['linux64', 'firefox'],
      ['linux64', 'chrome'],
      ['windows7-32', 'firefox'],
      ['windows7-32', null],
    ].map(([platform, application], i) => ({
      ...linuxSeries[0],
      id: i + 1,
      name: `test${i} opt`,
      platform,
      application,
    })),
  );
  const renderWithBrowsers = () =>
    renderModal({
      loadSignatures: makeLoader({ 'mozilla-central': browserSeries }),
    });

  test('lists each browser with its count, and tests without one are not counted', async () => {
    const { getByRole, getByTestId, queryByRole } = renderWithBrowsers();
    await waitForRows(getByTestId, 4);

    expect(getByRole('button', { name: /^firefox/ })).toHaveTextContent(
      'firefox2',
    );
    expect(getByRole('button', { name: /^chrome/ })).toHaveTextContent(
      'chrome1',
    );
    expect(queryByRole('button', { name: /^null/ })).toBeNull();
  });

  test('selecting browsers filters the results', async () => {
    const { getByRole, getByTestId } = renderWithBrowsers();
    await waitForRows(getByTestId, 4);

    fireEvent.click(getByRole('button', { name: /^firefox/ }));

    await waitForRows(getByTestId, 2);
    expect(getByTestId('1')).toBeInTheDocument();
    expect(getByTestId('3')).toBeInTheDocument();

    fireEvent.click(getByRole('button', { name: /^chrome/ }));

    await waitForRows(getByTestId, 3);
  });

    test('browser and platform counts each reflect the other selection', async () => {
    const { getByLabelText, getByRole, getByTestId } = renderWithBrowsers();
    await waitForRows(getByTestId, 4);

    openPlatforms(getByRole);
    tickPlatform(getByLabelText, 'linux64');

    await waitForRows(getByTestId, 2);
    expect(getByRole('button', { name: /^firefox/ })).toHaveTextContent(
      'firefox1',
    );

    fireEvent.click(getByRole('button', { name: /^firefox/ }));

    await waitForRows(getByTestId, 1);
    // windows7-32 still shows how many firefox tests it has
    expect(platformOptions(getByRole)).toEqual([
      'linux64 1',
      'windows7-32 1',
    ]);
  });

  test('a selected browser stays visible when nothing matches it', async () => {
    const { getByLabelText, getByRole, getByTestId } = renderWithBrowsers();
    await waitForRows(getByTestId, 4);

    fireEvent.click(getByRole('button', { name: /^chrome/ }));
    search(getByLabelText, 'windows7');
    await waitForRows(getByTestId, 0);

    const chromeChip = getByRole('button', { name: /^chrome/ });
    expect(chromeChip).toHaveTextContent('chrome0');

    fireEvent.click(chromeChip);

    await waitForRows(getByTestId, 2);
  });
});

test('Framework and tag filters are hidden until "More filters" is expanded', async () => {
  const { getByRole, getByTestId, queryByText } = renderModal();
  await waitForRows(getByTestId, allDefaultCount);

  expect(queryByText('Framework', facetLabel)).toBeNull();
  expect(queryByText('Tags', facetLabel)).toBeNull();
  const toggle = getByRole('button', { name: '▸ More filters' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');

  fireEvent.click(toggle);

  expect(queryByText('Framework', facetLabel)).toBeInTheDocument();
  expect(queryByText('Tags', facetLabel)).toBeInTheDocument();

  fireEvent.click(getByRole('button', { name: '▾ Fewer filters' }));

  expect(queryByText('Framework', facetLabel)).toBeNull();
});

test('The "More filters" toggle shows how many hidden filters are active', async () => {
  const { getByRole, getByTestId } = renderModal();
  await waitForRows(getByTestId, allDefaultCount);
  openMoreFilters(getByRole);

  fireEvent.click(getByRole('button', { name: /^build_metrics/ }));
  fireEvent.click(getByRole('button', { name: linuxSeries[0].tags[0] }));
  fireEvent.click(getByRole('button', { name: /Fewer filters/ }));

  // still applied while hidden
  await waitForRows(getByTestId, 1);
  expect(
    getByRole('button', { name: '▸ More filters (2 active)' }),
  ).toBeInTheDocument();
});

describe('Closing the picker ends the "add tests" session', () => {
  const pickTimeRange = async ({ getByRole, getByText }, from, to) => {
    fireEvent.click(getByRole('button', { name: from }));
    fireEvent.click(await waitFor(() => getByText(to)));
  };
  const plot = ({ getByRole }, count) =>
    fireEvent.click(getByRole('button', { name: `Plot graphs (${count})` }));

  test('a time range picked for an earlier plot does not override later graph changes', async () => {
    const screen = renderModal();
    const { getByTestId, props, rerender } = screen;
    await waitForRows(getByTestId, allDefaultCount);

    await pickTimeRange(screen, 'Last 30 days', 'Last 7 days');
    await waitForRows(getByTestId, allDefaultCount);
    fireEvent.click(getByTestId(linuxSeries[0].id.toString()));
    plot(screen, 1);

    expect(props.updateTestsAndTimeRange).toHaveBeenCalledTimes(1);
    expect(props.updateTestsAndTimeRange).toHaveBeenCalledWith(
      [expect.objectContaining({ signature_id: linuxSeries[0].id })],
      expect.objectContaining({ value: 604800 }),
    );

    // the graph is then switched to the last day, and another test is added
    rerender(
      <TestDataModal
        {...props}
        timeRange={{ value: 86400, text: 'Last day' }}
      />,
    );
    fireEvent.click(getByTestId(linuxSeries[1].id.toString()));
    plot(screen, 1);

    expect(props.updateTestsAndTimeRange).toHaveBeenCalledTimes(1);
    expect(props.getTestData).toHaveBeenCalledWith([
      expect.objectContaining({ signature_id: linuxSeries[1].id }),
    ]);
  });

  test('dismissing drops pending selections but keeps the search', async () => {
    const screen = renderModal();
    const { getByLabelText, getByTestId, props } = screen;
    await waitForRows(getByTestId, allDefaultCount);

    search(getByLabelText, 'linux64');
    await waitForRows(getByTestId, linuxSeries.length + autolandSeries.length);
    fireEvent.click(getByTestId(linuxSeries[0].id.toString()));
    expect(getByTestId('selectedTests').children).toHaveLength(1);

    fireEvent.click(getByLabelText('Close'));

    expect(props.toggle).toHaveBeenCalledTimes(1);
    expect(getByTestId('selectedTests').children).toHaveLength(0);
    expect(getByLabelText('Search tests')).toHaveValue('linux64');

    // selecting B after reopening plots only B
    fireEvent.click(getByTestId(linuxSeries[1].id.toString()));
    plot(screen, 1);

    expect(props.getTestData).toHaveBeenCalledWith([
      expect.objectContaining({ signature_id: linuxSeries[1].id }),
    ]);
  });

  test('dismissing also forgets a time range picked during that session', async () => {
    const screen = renderModal();
    const { getByLabelText, getByTestId, props } = screen;
    await waitForRows(getByTestId, allDefaultCount);

    await pickTimeRange(screen, 'Last 30 days', 'Last 7 days');
    fireEvent.click(getByLabelText('Close'));

    await waitForRows(getByTestId, allDefaultCount);
    fireEvent.click(getByTestId(linuxSeries[0].id.toString()));
    plot(screen, 1);

    expect(props.updateTestsAndTimeRange).not.toHaveBeenCalled();
    expect(props.getTestData).toHaveBeenCalledWith([
      expect.objectContaining({ signature_id: linuxSeries[0].id }),
    ]);
  });
});

describe('Less common interactions', () => {
  test('Related applications option shows the same test in other applications', async () => {
    const series = indexed(
      [
        ['a11yr opt firefox', 'firefox'],
        ['a11yr opt chrome', 'chrome'],
        ['a11yr opt fission chrome', 'chrome'],
      ].map(([name, application], i) => ({
        ...linuxSeries[0],
        id: i + 1,
        name,
        application,
      })),
    );
    const { getByTestId, getByText } = renderModal({
      loadSignatures: makeLoader({ 'mozilla-central': series }),
      options: {
        option: 'addRelatedApplications',
        relatedSeries: {
          ...linuxSeries[0],
          name: 'a11yr opt firefox',
          application: 'firefox',
          repository_name: 'mozilla-central',
          framework_id: 1,
        },
      },
    });

    // names match once each test's own application is removed from them
    await waitForRows(getByTestId, 1);
    expect(getByTestId('2')).toBeInTheDocument();
    expect(getByText(/Same test in other applications as/)).toBeInTheDocument();
  });

  test('Tests with the same name, platform and repository are all listed', async () => {
    const duplicates = indexed(
      [1, 2, 3].map((id) => ({ ...linuxSeries[0], id })),
    );
    const { getByTestId } = renderModal({
      loadSignatures: makeLoader({ 'mozilla-central': duplicates }),
    });

    await waitForRows(getByTestId, 3);
    ['1', '2', '3'].forEach((id) =>
      expect(getByTestId(id)).toBeInTheDocument(),
    );
  });

  test('The up arrow moves back through the results and stops at the first one', async () => {
    const { getByLabelText, getByTestId } = renderModal();
    await waitForRows(getByTestId, allDefaultCount);
    const input = getByLabelText('Search tests');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(rows(getByTestId)[1]).toHaveClass('table-active');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(rows(getByTestId)[0]).toHaveClass('table-active');
  });

  test('Deselecting every repository asks for one', async () => {
    const { getByRole, getByTestId } = renderModal();
    await waitForRows(getByTestId, allDefaultCount);

    fireEvent.click(getByRole('button', { name: 'mozilla-central' }));
    fireEvent.click(getByRole('button', { name: 'autoland' }));

    await waitForRows(getByTestId, 0);
    expect(getByRole('status')).toHaveTextContent(
      'Select at least one repository.',
    );
  });

  test('Submitting the search form (e.g. Enter in a browser) does not reload the page', async () => {
    const { getByLabelText, getByTestId } = renderModal();
    await waitForRows(getByTestId, allDefaultCount);

    const form = getByLabelText('Search tests').closest('form');

    // fireEvent returns false when the handler called preventDefault()
    expect(fireEvent.submit(form)).toBe(false);
  });

  test('Other repositories can be added from the "more" menu', async () => {
    const loadSignatures = makeLoader({
      ...defaultSignatures,
      'mozilla-release': indexed([
        { ...linuxSeries[0], id: 99, projectName: 'mozilla-release' },
      ]),
    });
    const { getByRole, getByTestId, getByText } = renderModal({
      loadSignatures,
      projects: [...repos, { name: 'mozilla-release' }],
    });
    await waitForRows(getByTestId, allDefaultCount);

    fireEvent.click(getByRole('button', { name: 'more' }));
    fireEvent.click(await waitFor(() => getByText('mozilla-release')));

    await waitForRows(getByTestId, allDefaultCount + 1);
    expect(getByTestId('99')).toBeInTheDocument();
    expect(
      getByRole('button', { name: /^mozilla-release/ }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Edge cases', () => {
  const deferred = () => {
    let resolve;
    const promise = new Promise((r) => {
      resolve = r;
    });
    return { promise, resolve };
  };

  test('Renders with only the required props', async () => {
    const loadSignatures = makeLoader();
    const { getByTestId } = render(
      <TestDataModal
        projects={repos}
        plottedUnits={new Set()}
        timeRange={{ value: 172800, text: 'Last two days' }}
        getTestData={jest.fn()}
        showModal
        toggle={jest.fn()}
        loadSignatures={loadSignatures}
      />,
    );

    await waitForRows(getByTestId, allDefaultCount);
    // without frameworks the framework names are unknown, not missing
    expect(loadSignatures).toHaveBeenCalledWith(
      'mozilla-central',
      2592000,
      [],
      { subtests: false },
    );
  });

  test('Related applications also match a test whose name lacks its application', async () => {
    const series = indexed(
      [
        ['a11yr opt firefox', 'firefox'],
        ['a11yr opt', 'safari'],
        ['a11yr opt', null],
      ].map(([name, application], i) => ({
        ...linuxSeries[0],
        id: i + 1,
        name,
        application,
      })),
    );
    const { getByTestId } = renderModal({
      loadSignatures: makeLoader({ 'mozilla-central': series }),
      options: {
        option: 'addRelatedApplications',
        relatedSeries: {
          ...linuxSeries[0],
          name: 'a11yr opt firefox',
          application: 'firefox',
          repository_name: 'mozilla-central',
          framework_id: 1,
        },
      },
    });

    await waitForRows(getByTestId, 2);
    expect(getByTestId('2')).toBeInTheDocument();
    expect(getByTestId('3')).toBeInTheDocument();
  });

  test('A related-tests search with no results says so, without suggesting subtests', async () => {
    const { getByTestId, queryByTestId } = renderModal({
      loadSignatures: makeLoader({ 'mozilla-central': indexed(linuxSeries) }),
      options: {
        option: 'addRelatedPlatform',
        relatedSeries: {
          ...linuxSeries[0],
          repository_name: 'mozilla-central',
          framework_id: 1,
        },
      },
    });

    const noMatches = await waitFor(() => getByTestId('no-matches'));
    expect(noMatches).toHaveTextContent('No related tests found.');
    // including subtests can't add matches to a related-tests view
    expect(queryByTestId('suggest-subtests')).toBeNull();
  });

  test('A selected test with a different unit is highlighted in the selected list', async () => {
    const { getByTestId } = renderModal();
    await waitForRows(getByTestId, allDefaultCount);

    // dromaeo_dom is in "score", the others have no unit
    fireEvent.click(getByTestId(linuxSeries[0].id.toString()));
    fireEvent.click(getByTestId(linuxSeries[3].id.toString()));

    const chips = within(getByTestId('selectedTests')).getAllByRole('button');
    expect(chips).toHaveLength(2);
    chips.forEach((chip) => expect(chip).toHaveClass('btn-warning'));
  });

    test('A selected platform stays listed with a zero count when the search excludes it', async () => {
    const { getByLabelText, getByRole, getByTestId } = renderModal();
    await waitForRows(getByTestId, allDefaultCount);

    openPlatforms(getByRole);
    tickPlatform(getByLabelText, 'windows7-32');
    search(getByLabelText, 'linux64');
    await waitForRows(getByTestId, 0);

    // linux64 still offers its matches; the selected windows7-32 has none
    expect(platformOptions(getByRole)).toEqual(['linux64 6', 'windows7-32 0']);
    expect(getByLabelText(/^windows7-32 0$/)).toBeChecked();
  });

    test('Platforms are listed alphabetically, and browser chips with equal counts too', async () => {
    const series = indexed(
      [
        ['p-delta', 'safari'],
        ['P-bravo', 'chrome'],
        ['p-alpha', 'firefox'],
        ['p-charlie', 'edge'],
      ].map(([platform, application], i) => ({
        ...linuxSeries[0],
        id: i + 1,
        // results are ordered by name, so this keeps the platforms (and
        // browsers) out of alphabetical order before they're sorted
        name: `test${i} opt`,
        platform,
        application,
      })),
    );
    const { getAllByRole, getByRole, getByTestId } = renderModal({
      loadSignatures: makeLoader({ 'mozilla-central': series }),
    });
    await waitForRows(getByTestId, 4);

    openPlatforms(getByRole);
    // case doesn't affect the order
    expect(platformOptions(getByRole)).toEqual([
      'p-alpha 1',
      'P-bravo 1',
      'p-charlie 1',
      'p-delta 1',
    ]);
    expect(
      getAllByRole('button', { name: /^(chrome|edge|firefox|safari) \d/ }).map(
        (chip) => chip.textContent,
      ),
    ).toEqual(['chrome1', 'edge1', 'firefox1', 'safari1']);
  });

  test('Sorting puts tests without a value last in both directions', async () => {
    const series = indexed(
      [null, 'beta', null, 'alpha', null, 'gamma'].map((application, i) => ({
        ...linuxSeries[0],
        id: i + 1,
        name: `test${i} opt`,
        application,
      })),
    );
    const { getByRole, getByTestId } = renderModal({
      loadSignatures: makeLoader({ 'mozilla-central': series }),
    });
    await waitForRows(getByTestId, 6);
    const apps = () => columnValues(getByTestId, 2);

    // the header's name gains the sort arrow once sorted
    const appHeader = getByRole('button', { name: 'App' });
    fireEvent.click(appHeader);
    expect(apps()).toEqual(['alpha', 'beta', 'gamma', '', '', '']);

    fireEvent.click(appHeader);
    expect(apps()).toEqual(['gamma', 'beta', 'alpha', '', '', '']);
  });

  test('A rejection that is not an Error, or a failure without a message, still shows an error', async () => {
    const loadSignatures = jest.fn(async (repo) => {
      if (repo === 'mozilla-central') throw 'offline';
      return { data: { detail: 'server error' }, failureStatus: 500 };
    });
    const { getByText } = renderModal({ loadSignatures });

    await waitFor(() =>
      expect(
        getByText('mozilla-central: failed to load tests (offline)'),
      ).toBeInTheDocument(),
    );
    expect(getByText('autoland: failed to load tests')).toBeInTheDocument();
  });

  test('Lists that arrive after the modal is gone are ignored', async () => {
    const pending = deferred();
    const loadSignatures = jest.fn(() => pending.promise);
    const { unmount } = renderModal({ loadSignatures });
    // the request starts from a promise callback, just after rendering
    await waitFor(() => expect(loadSignatures).toHaveBeenCalled());

    unmount();

    // resolving after unmount must not try to update the removed component
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    await act(async () => {
      pending.resolve({ data: [], failureStatus: null });
      await pending.promise;
    });
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  test('Subtests that arrive after the modal is gone, or after collapsing, are ignored', async () => {
    const pending = deferred();
    const loadSubtests = jest.fn(() => pending.promise);
    const subtest = { ...linuxSeries[0], id: 42, hasSubtests: false };

    // collapsed before the subtests arrived
    const first = renderModal({ loadSubtests });
    await waitForRows(first.getByTestId, allDefaultCount);
    const parentRow = first.getByTestId(linuxSeries[0].id.toString());
    fireEvent.click(within(parentRow).getByTitle('Show subtests'));
    fireEvent.click(within(parentRow).getByTitle('Hide subtests'));
    await act(async () => {
      pending.resolve({ data: [subtest], failureStatus: null });
      await pending.promise;
    });
    expect(first.queryByTestId('42')).toBeNull();
    first.unmount();

    // the modal is gone before the subtests arrived
    const later = deferred();
    loadSubtests.mockImplementation(() => later.promise);
    const second = renderModal({ loadSubtests });
    await waitForRows(second.getByTestId, allDefaultCount);
    fireEvent.click(
      within(second.getByTestId(linuxSeries[0].id.toString())).getByTitle(
        'Show subtests',
      ),
    );
    second.unmount();
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    await act(async () => {
      later.resolve({ data: [subtest], failureStatus: null });
      await later.promise;
    });
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe('Screen reader support for keyboard navigation', () => {
  test('the search box points assistive technology at the active result', async () => {
    const { getByLabelText, getByRole, getByTestId } = renderModal();
    await waitForRows(getByTestId, allDefaultCount);
    const combobox = getByRole('combobox', { name: 'Search tests' });
    const grid = getByRole('grid', { name: 'Tests' });

    expect(combobox).toHaveAttribute('aria-controls', grid.id);
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    expect(grid).toHaveAttribute('aria-multiselectable', 'true');
    const [first, second] = rows(getByTestId);
    expect(combobox).toHaveAttribute('aria-activedescendant', first.id);

    fireEvent.keyDown(getByLabelText('Search tests'), { key: 'ArrowDown' });

    expect(combobox).toHaveAttribute('aria-activedescendant', second.id);
    expect(second.id).toBe(`test-search-row-${second.dataset.testid}`);
  });

  test("each result says whether it's selected", async () => {
    const { getByLabelText, getByTestId } = renderModal();
    await waitForRows(getByTestId, allDefaultCount);
    const input = getByLabelText('Search tests');
    const [first] = rows(getByTestId);

    expect(first).toHaveAttribute('aria-selected', 'false');

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(first).toHaveAttribute('aria-selected', 'true');
  });

  test('there is no active result when nothing matches', async () => {
    const { getByLabelText, getByRole, getByTestId } = renderModal();
    await waitForRows(getByTestId, allDefaultCount);

    search(getByLabelText, 'no such test');
    await waitForRows(getByTestId, 0);

    const combobox = getByRole('combobox', { name: 'Search tests' });
    expect(combobox).not.toHaveAttribute('aria-activedescendant');
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
  });
});

test('A subtest reply from before a time range change does not replace the newer one', async () => {
  const replies = [];
  const loadSubtests = jest.fn(
    () =>
      new Promise((resolve) => {
        replies.push(resolve);
      }),
  );
  const subtest = (id) => ({ ...linuxSeries[0], id, hasSubtests: false });
  const { getByRole, getByTestId, getByText, queryByTestId } = renderModal({
    loadSubtests,
  });
  await waitForRows(getByTestId, allDefaultCount);
  const expand = () =>
    fireEvent.click(
      within(getByTestId(linuxSeries[0].id.toString())).getByTitle(
        'Show subtests',
      ),
    );

  // expanded for the last 30 days...
  expand();
  // ...then for the last 7 days, while the first reply is still on its way
  fireEvent.click(getByRole('button', { name: 'Last 30 days' }));
  fireEvent.click(await waitFor(() => getByText('Last 7 days')));
  await waitForRows(getByTestId, allDefaultCount);
  expand();
  expect(loadSubtests.mock.calls.map(([, interval]) => interval)).toEqual([
    2592000, 604800,
  ]);

  // the 7 day reply arrives first, the stale 30 day one last
  await act(async () => {
    replies[1]({ data: [subtest(7)], failureStatus: null });
  });
  await act(async () => {
    replies[0]({ data: [subtest(30)], failureStatus: null });
  });

  expect(getByTestId('7')).toBeInTheDocument();
  expect(queryByTestId('30')).toBeNull();
});

test('By default the signature lists come from the API', async () => {
  const signaturesUrl = (repo) =>
    `begin:${getProjectUrl('/performance/signatures/', repo)}`;
  fetchMock.mock(getApiUrl('/optioncollectionhash/'), []);
  fetchMock.mock(signaturesUrl('mozilla-central'), {
    11: {
      id: 11,
      suite: 'speedometer3',
      machine_platform: 'android-hw-a55',
      framework_id: 13,
      application: 'fenix',
      signature_hash: 'abc123',
    },
  });
  fetchMock.mock(signaturesUrl('autoland'), {});

  try {
    const { getByTestId } = render(
      <TestDataModal
        projects={repos}
        plottedUnits={new Set()}
        timeRange={{ value: 172800, text: 'Last two days' }}
        getTestData={jest.fn()}
        showModal
        toggle={jest.fn()}
      />,
    );

    await waitForRows(getByTestId, 1);
    expect(getByTestId('11')).toHaveTextContent('speedometer3');
  } finally {
    fetchMock.reset();
  }
});

describe('Review fixes', () => {
  const pending = () => {
    let resolve;
    const promise = new Promise((r) => {
      resolve = r;
    });
    return { promise, resolve };
  };

  test('Dismissing the picker also leaves a related-tests view', async () => {
    const { getByLabelText, getByTestId, queryByLabelText, props } =
      renderModal({
        options: {
          option: 'addRelatedPlatform',
          relatedSeries: {
            ...linuxSeries[0],
            repository_name: 'mozilla-central',
            framework_id: 1,
          },
        },
      });
    await waitForRows(getByTestId, 1);
    expect(getByLabelText('Show all tests')).toBeInTheDocument();

    fireEvent.click(getByLabelText('Close'));

    expect(props.toggle).toHaveBeenCalledTimes(1);
    // opening it again (e.g. with "Add test data") shows every test
    await waitForRows(getByTestId, allDefaultCount);
    expect(queryByLabelText('Show all tests')).toBeNull();
  });

  test('The highlighted test stays highlighted when another repository finishes loading', async () => {
    const autoland = pending();
    const loadSignatures = jest.fn(async (repo) => {
      if (repo === 'autoland') return autoland.promise;
      return {
        data: repo === 'mozilla-central' ? defaultSignatures[repo] : [],
        failureStatus: null,
      };
    });
    const { getByLabelText, getByTestId } = renderModal({ loadSignatures });
    const centralCount = linuxSeries.length + windowsSeries.length;
    await waitForRows(getByTestId, centralCount);
    const input = getByLabelText('Search tests');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const highlighted = rows(getByTestId)[2].dataset.testid;

    // autoland's tests sort in above it
    await act(async () => {
      autoland.resolve({ data: autolandSeries, failureStatus: null });
    });
    await waitForRows(getByTestId, allDefaultCount);

    const active = getByTestId('tests').querySelector('tr.table-active');
    expect(active.dataset.testid).toBe(highlighted);
    expect(rows(getByTestId).indexOf(active)).not.toBe(2);

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(within(active).getByRole('checkbox')).toBeChecked();
  });

  test('The arrow keys stop at the last result', async () => {
    const { getByLabelText, getByTestId } = renderModal({
      loadSignatures: makeLoader({
        'mozilla-central': indexed(linuxSeries.slice(0, 2)),
      }),
    });
    await waitForRows(getByTestId, 2);
    const input = getByLabelText('Search tests');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(rows(getByTestId)[1]).toHaveClass('table-active');
  });

  test('A repository deselected while it is still loading no longer counts as loading', async () => {
    const tryLists = pending();
    const loadSignatures = jest.fn(async (repo) => {
      if (repo === 'try') return tryLists.promise;
      return { data: defaultSignatures[repo] || [], failureStatus: null };
    });
    const { getByRole, getByTestId } = renderModal({ loadSignatures });
    await waitForRows(getByTestId, allDefaultCount);

    fireEvent.click(getByRole('button', { name: 'try' }));
    await waitFor(() =>
      expect(getByRole('status')).toHaveTextContent('still loading'),
    );

    fireEvent.click(getByRole('button', { name: /^try/ }));

    expect(getByRole('status')).not.toHaveTextContent('still loading');
  });

  test('When every selected repository fails, it says so instead of "No tests match"', async () => {
    const { getByRole, getByText, queryByTestId } = renderModal({
      loadSignatures: jest.fn(async () => ({
        data: 'server error',
        failureStatus: 500,
      })),
    });

    await waitFor(() =>
      expect(getByText('mozilla-central: server error')).toBeInTheDocument(),
    );
    expect(getByRole('status')).toHaveTextContent(
      "Couldn't load any tests, see the errors above.",
    );
    expect(queryByTestId('no-matches')).toBeNull();
  });
});

describe('Filter chip review fixes', () => {
  const series = indexed(
    [
      ...Array(3).fill(['linux64', 'firefox', 1]),
      ['windows7-32', 'firefox', 2],
      ['windows7-32', 'chrome', 1],
      ['windows7-32', 'chrome', 1],
    ].map(([platform, application, frameworkId], i) => ({
      ...linuxSeries[0],
      id: i + 1,
      name: `test${i} opt`,
      platform,
      application,
      frameworkId,
    })),
  );
  const renderChips = () =>
    renderModal({ loadSignatures: makeLoader({ 'mozilla-central': series }) });
  const chipNames = (getAllByRole, pattern) =>
    getAllByRole('button', { name: pattern }).map((chip) => chip.textContent);

  test('browser chips are alphabetical and keep their place when other filters change', async () => {
    const { getAllByRole, getByLabelText, getByRole, getByTestId } =
      renderChips();
    await waitForRows(getByTestId, 6);
    const browsers = /^(chrome|firefox) \d/;

    // firefox has more tests, but chrome comes first
    expect(chipNames(getAllByRole, browsers)).toEqual(['chrome2', 'firefox4']);

    // on windows chrome has more tests; the chips still don't move
    openPlatforms(getByRole);
    tickPlatform(getByLabelText, 'windows7-32');
    await waitForRows(getByTestId, 3);

    expect(chipNames(getAllByRole, browsers)).toEqual(['chrome2', 'firefox1']);
  });

  test('framework chips are alphabetical by name', async () => {
    const { getAllByRole, getByRole, getByTestId } = renderChips();
    await waitForRows(getByTestId, 6);
    openMoreFilters(getByRole);

    // talos has more tests, but build_metrics comes first
    expect(chipNames(getAllByRole, /^(build_metrics|talos) \d/)).toEqual([
      'build_metrics1',
      'talos5',
    ]);
  });

  test('the browser and framework rows can be cleared in one click', async () => {
    const { getByRole, getByTestId, queryByRole } = renderChips();
    await waitForRows(getByTestId, 6);
    expect(queryByRole('button', { name: 'clear' })).toBeNull();

    fireEvent.click(getByRole('button', { name: /^chrome/ }));
    fireEvent.click(getByRole('button', { name: /^firefox/ }));
    await waitForRows(getByTestId, 6);
    fireEvent.click(getByRole('button', { name: 'clear' }));
    expect(getByRole('button', { name: /^chrome/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    openMoreFilters(getByRole);
    fireEvent.click(getByRole('button', { name: /^talos/ }));
    await waitForRows(getByTestId, 5);
    fireEvent.click(getByRole('button', { name: 'clear' }));

    await waitForRows(getByTestId, 6);
    expect(queryByRole('button', { name: 'clear' })).toBeNull();
  });
});
