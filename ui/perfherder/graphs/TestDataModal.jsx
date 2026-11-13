import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  Button,
  CloseButton,
  Dropdown,
  Form,
  Modal,
  Spinner,
  Table,
} from 'react-bootstrap';

import { thPerformanceBranches } from '../../helpers/constants';
import { phTimeRanges } from '../perf-helpers/constants';
import {
  getFrameworkName,
  loadRepositorySignatures,
  loadSubtestSignatures,
  matchesQuery,
} from '../perf-helpers/helpers';

import TimeRangeDropdown from './TimeRangeDropdown';

const PINNED_REPOS = ['mozilla-central', 'autoland', 'mozilla-beta', 'try'];
// mozilla-beta and try (the largest repository) are rarely wanted in a
// general search, so they're only loaded once the user asks for them.
const DEFAULT_REPOS = ['mozilla-central', 'autoland'];
// The modal's time range decides which tests are listed. It only changes the
// graph's time range if the user picks one in the modal.
const DEFAULT_TIME_RANGE = phTimeRanges.find((item) => item.value === 2592000);
const SORTABLE_COLUMNS = [
  { key: 'name', label: 'Test' },
  { key: 'application', label: 'App' },
  { key: 'platform', label: 'Platform' },
  { key: 'projectName', label: 'Repository' },
  { key: 'framework', label: 'Framework' },
  { key: 'measurementUnit', label: 'Unit' },
];
const REPOS_STORAGE_KEY = 'perfherder-graphs-test-search-repos';
const MAX_RESULTS = 200;
const MAX_VISIBLE_GRAPHS = 6;

const removeSubstring = (subString, fromString) =>
  subString && fromString.includes(subString)
    ? fromString.split(subString).join('').trim()
    : fromString;

// The legend card links open the modal pre-filtered to tests related to the
// clicked series. Related tests always come from the same framework.
export const relatedFilters = {
  addRelatedConfigs: {
    label: 'Other configurations of',
    matches: (series, related) =>
      series.projectName === related.repository_name &&
      series.platform === related.platform &&
      series.suite === related.suite &&
      series.name !== related.name,
  },
  addRelatedBranches: {
    label: 'Same test on other branches as',
    matches: (series, related) =>
      series.projectName !== related.repository_name &&
      series.platform === related.platform &&
      series.name.trim() === related.name.trim(),
  },
  addRelatedPlatform: {
    label: 'Same test on other platforms as',
    matches: (series, related) =>
      series.platform !== related.platform &&
      series.name.trim() === related.name.trim(),
  },
  addRelatedApplications: {
    label: 'Same test in other applications as',
    matches: (series, related) =>
      series.projectName === related.repository_name &&
      series.platform === related.platform &&
      series.application !== related.application &&
      removeSubstring(series.application, series.name) ===
        removeSubstring(related.application, related.name),
  },
};

const compareSeries = (a, b) => {
  if (a.name !== b.name) return a.name < b.name ? -1 : 1;
  if (a.platform !== b.platform) return a.platform < b.platform ? -1 : 1;
  if (a.projectName !== b.projectName)
    return a.projectName < b.projectName ? -1 : 1;
  return 0;
};

const toggleItem = (list, item) =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

// The search box keeps focus while the arrow keys move through the results
// (an ARIA combobox controlling a grid), so screen readers follow the active
// result through aria-activedescendant, which needs stable row IDs.
const RESULTS_ID = 'test-search-results';
const rowId = (series) => `test-search-row-${series.id}`;

const getFullTestName = (series) =>
  `${series.projectName} ${series.platform} ${series.name} ${
    series.application || ''
  }`.trim();

const readStoredRepos = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(REPOS_STORAGE_KEY));
    if (
      Array.isArray(stored) &&
      stored.length &&
      stored.every((repo) => typeof repo === 'string')
    ) {
      return stored;
    }
  } catch {
    // fall through to the defaults
  }
  return DEFAULT_REPOS;
};

const FilterChip = ({
  label,
  count,
  active,
  loading,
  onClick,
  title,
  className = '',
}) => (
  <Button
    size="sm"
    variant={active ? 'darker-info' : 'outline-darker-info'}
    className={`me-1 mb-1 rounded-pill test-search-chip ${className}`}
    onClick={onClick}
    aria-pressed={active}
    title={title}
  >
    {label}
    {count !== undefined && <span className="ms-1 opacity-75">{count}</span>}
    {loading && (
      <Spinner
        animation="border"
        size="sm"
        className="ms-1"
        aria-label={`Loading ${label}`}
      />
    )}
  </Button>
);

// For long lists like platforms: a dropdown of alphabetically sorted
// checkboxes with a filter box, which is far easier to scan than many pills.
// It stays open while several values are ticked.
export const CheckboxDropdown = ({
  noun,
  plural,
  options,
  selected,
  onToggle,
  onClear,
}) => {
  const [filter, setFilter] = useState('');
  const shown = options.filter(([value]) =>
    matchesQuery(value.toLowerCase(), filter),
  );

  let summary = `All ${plural}`;
  if (selected.length === 1) [summary] = selected;
  if (selected.length > 1) summary = `${selected.length} ${plural}`;

  return (
    <Dropdown
      autoClose="outside"
      onToggle={(open) => {
        if (!open) setFilter('');
      }}
    >
      <Dropdown.Toggle
        size="sm"
        variant={selected.length ? 'darker-info' : 'outline-darker-info'}
        className="rounded-pill mb-1 test-search-chip"
        aria-label={`${noun} filter: ${summary}`}
      >
        {summary}
      </Dropdown.Toggle>
      <Dropdown.Menu className="p-2 test-search-checkbox-menu">
        <Form.Control
          type="search"
          size="sm"
          className="mb-2"
          placeholder={`Filter ${plural}`}
          aria-label={`Filter ${plural}`}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <div className="test-search-checkbox-list">
          {shown.map(([value, count]) => (
            <Form.Check
              key={value}
              id={`test-search-${noun}-${value}`}
              type="checkbox"
              checked={selected.includes(value)}
              onChange={() => onToggle(value)}
              label={
                <>
                  {value} <span className="text-secondary">{count}</span>
                </>
              }
            />
          ))}
          {!shown.length && (
            <div className="small text-secondary">
              No {plural} match "{filter}".
            </div>
          )}
        </div>
        {selected.length > 0 && (
          <Button variant="link" size="sm" className="p-0 mt-2" onClick={onClear}>
            Clear
          </Button>
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
};

// A filter's options: each value with its count, plus selected values that no
// longer match anything (with 0, so they can always be cleared). They're in
// alphabetical order of their labels, so they don't move as counts change.
export const filterOptions = (counts, selected, label = (value) => value) => {
  const options = [...counts.entries()];
  selected.forEach((value) => {
    if (!counts.has(value)) options.push([value, 0]);
  });
  return options.sort(([a], [b]) =>
    String(label(a)).localeCompare(String(label(b))),
  );
};

const FilterRow = ({ title, children }) => (
  <div className="d-flex align-items-baseline mb-1">
    <span className="test-search-facet-title text-secondary small">
      {title}
    </span>
    <div className="d-flex flex-wrap">{children}</div>
  </div>
);

const TestDataModal = ({
  frameworks = [],
  getTestData,
  loadSignatures = loadRepositorySignatures,
  loadSubtests = loadSubtestSignatures,
  options = undefined,
  plottedUnits,
  projects,
  replicates = false,
  showModal,
  testData = [],
  timeRange,
  toggle,
  updateTestsAndTimeRange = undefined,
}) => {
  const [repos, setRepos] = useState(readStoredRepos);
  const [loaded, setLoaded] = useState({});
  const [loading, setLoading] = useState([]);
  const [failed, setFailed] = useState({});
  const [query, setQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState([]);
  const [frameworkFilter, setFrameworkFilter] = useState([]);
  const [browserFilter, setBrowserFilter] = useState([]);
  const [activeTags, setActiveTags] = useState([]);
  const [includeSubtests, setIncludeSubtests] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [innerTimeRange, setInnerTimeRange] = useState(DEFAULT_TIME_RANGE);
  const [timeRangePicked, setTimeRangePicked] = useState(false);
  const [sort, setSort] = useState(null);
  const [selected, setSelected] = useState([]);
  const [related, setRelated] = useState(null);
  const [expanded, setExpanded] = useState({});
  // the highlighted test; null means the first result
  const [activeId, setActiveId] = useState(null);

  const pending = useRef(new Set());
  const mounted = useRef(true);
  const activeRow = useRef(null);
  // identifies each subtest request, so only the latest one for a row is used
  const subtestRequest = useRef(0);

  const interval = innerTimeRange.value;
  // what's loaded depends on the time range and whether subtests are included
  const listSuffix = `:${interval}:${includeSubtests ? 1 : 0}`;
  const repoKey = (repo) => `${repo}${listSuffix}`;

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  // The legend card links open the modal pre-filtered to related tests.
  useEffect(() => {
    const { option, relatedSeries } = options ?? {};
    if (!relatedSeries || !relatedFilters[option]) return;

    setRelated({ option, series: relatedSeries });
    setQuery('');
    setPlatformFilter([]);
    setFrameworkFilter([]);
    setBrowserFilter([]);
    setActiveTags([]);
    // "other branches" and "other platforms" look beyond the series' own
    // repository, so load the performance branches even if the saved
    // selection doesn't include them
    const neededRepos = [
      relatedSeries.repository_name,
      ...(option === 'addRelatedBranches' || option === 'addRelatedPlatform'
        ? thPerformanceBranches
        : []),
    ];
    setRepos((prev) => [
      ...prev,
      ...neededRepos.filter(
        (repo, i) => !prev.includes(repo) && neededRepos.indexOf(repo) === i,
      ),
    ]);
  }, [options]);

  // Signature lists are only fetched while the modal is open.
  useEffect(() => {
    if (!showModal) return;

    repos.forEach((repo) => {
      const key = `${repo}${listSuffix}`;
      if (loaded[key] || failed[key] || pending.current.has(key)) return;

      pending.current.add(key);
      setLoading((prev) => [...prev, key]);
      // a rejected request must still clear the pending/loading state,
      // otherwise the repository stays "loading" until the page is reloaded
      Promise.resolve()
        .then(() =>
          loadSignatures(repo, interval, frameworks, {
            subtests: includeSubtests,
          }),
        )
        .catch((error) => ({
          data: `failed to load tests (${error?.message || error})`,
          failureStatus: true,
        }))
        .then(({ data, failureStatus }) => {
          pending.current.delete(key);
          if (!mounted.current) return;

          setLoading((prev) => prev.filter((item) => item !== key));
          if (failureStatus) {
            setFailed((prev) => ({
              ...prev,
              [key]: typeof data === 'string' ? data : 'failed to load tests',
            }));
          } else {
            setLoaded((prev) => ({ ...prev, [key]: data }));
          }
        });
    });
  }, [
    showModal,
    repos,
    interval,
    includeSubtests,
    listSuffix,
    loaded,
    failed,
    frameworks,
    loadSignatures,
  ]);

  const index = useMemo(
    () =>
      repos
        .flatMap((repo) => loaded[`${repo}${listSuffix}`] || [])
        .sort(compareSeries),
    [repos, loaded, listSuffix],
  );

  const plottedIds = useMemo(
    () => new Set(testData.map((series) => series.signature_id)),
    [testData],
  );

  // query, tags and related-test filters; platform and framework facets are
  // applied below so each facet can show counts for the other's selection
  const baseResults = useMemo(() => {
    const relatedFilter = related && relatedFilters[related.option];

    return index.filter(
      (series) =>
        (!relatedFilter ||
          (series.frameworkId === related.series.framework_id &&
            relatedFilter.matches(series, related.series))) &&
        activeTags.every((tag) => series.tags.includes(tag)) &&
        matchesQuery(series.searchText, query),
    );
  }, [index, related, activeTags, query]);

  const {
    results,
    platformCounts,
    frameworkCounts,
    browserCounts,
    availableTags,
  } = useMemo(() => {
    // each facet's counts are taken with the other facets' selections applied
    const facets = [
      { selected: platformFilter, value: (series) => series.platform },
      { selected: frameworkFilter, value: (series) => series.frameworkId },
      { selected: browserFilter, value: (series) => series.application },
    ].map((facet) => ({ ...facet, counts: new Map() }));
    const tags = new Set(activeTags);
    const matching = [];

    baseResults.forEach((series) => {
      const matches = facets.map(
        ({ selected, value }) =>
          !selected.length || selected.includes(value(series)),
      );
      const failing = matches.filter((match) => !match).length;
      if (failing > 1) return;

      facets.forEach(({ value, counts }, i) => {
        const key = value(series);
        // only this facet's own selection may exclude the series
        if (key && (failing === 0 || !matches[i])) {
          counts.set(key, (counts.get(key) || 0) + 1);
        }
      });
      if (failing === 0) {
        matching.push(series);
        series.tags.forEach((tag) => tags.add(tag));
      }
    });

    return {
      results: matching,
      platformCounts: facets[0].counts,
      frameworkCounts: facets[1].counts,
      browserCounts: facets[2].counts,
      availableTags: [...tags].sort(),
    };
  }, [baseResults, platformFilter, frameworkFilter, browserFilter, activeTags]);

  // results are already ordered by name, platform and repository; a column
  // sort reorders them, with empty values last and that order as tie-breaker
  const sortedResults = useMemo(() => {
    if (!sort) return results;

    const sortValue = (series) =>
      (sort.key === 'framework'
        ? getFrameworkName(frameworks, series.frameworkId)
        : series[sort.key] || ''
      ).toLowerCase();

    return results
      .map((series) => [sortValue(series), series])
      .sort(([a, seriesA], [b, seriesB]) => {
        if (a !== b) {
          if (!a) return 1;
          if (!b) return -1;
        }
        return (
          a.localeCompare(b) * sort.direction || compareSeries(seriesA, seriesB)
        );
      })
      .map(([, series]) => series);
  }, [results, sort, frameworks]);

  const displayed = sortedResults.slice(0, MAX_RESULTS);

  // back to the first result when the search or filters change, but not when
  // another repository's list arrives while the user moves through results
  useEffect(() => {
    setActiveId(null);
  }, [query, platformFilter, activeTags, related, browserFilter, frameworkFilter, sort]);

  // the highlighted test's row, or the first row if it isn't listed (any more)
  const activeRowIndex = Math.max(
    displayed.findIndex((series) => series.id === activeId),
    0,
  );

  const toggleSort = (key) =>
    setSort((prev) =>
      prev?.key === key
        ? { key, direction: -prev.direction }
        : { key, direction: 1 },
    );

  useEffect(() => {
    activeRow.current?.scrollIntoView?.({ block: 'nearest' });
  }, [activeRowIndex]);

  const selectedUnits = useMemo(
    () => new Set(selected.map((series) => series.measurementUnit)),
    [selected],
  );

  const hasDifferentUnit = (series) => {
    const unit = series.measurementUnit;
    return Boolean(
      (plottedUnits.size && !plottedUnits.has(unit)) ||
        selectedUnits.size >= 2 ||
        (selectedUnits.size && !selectedUnits.has(unit)),
    );
  };

  const rowTitle = (series) =>
    hasDifferentUnit(series)
      ? `Warning: ${getFullTestName(series)} has a different measurement unit (${
          series.measurementUnit || 'none'
        })`
      : getFullTestName(series);

  const isSelected = (series) => selected.some((item) => item.id === series.id);

  const toggleSelected = (series) => {
    if (plottedIds.has(series.id)) return;
    setSelected((prev) =>
      prev.some((item) => item.id === series.id)
        ? prev.filter((item) => item.id !== series.id)
        : [...prev, series],
    );
  };

  const toggleRepo = (repo) => {
    const newRepos = toggleItem(repos, repo);
    setRepos(newRepos);
    // unselecting a repository that failed to load lets the user retry it
    setFailed((prev) => {
      const { [repoKey(repo)]: removed, ...rest } = prev;
      return rest;
    });
    try {
      localStorage.setItem(REPOS_STORAGE_KEY, JSON.stringify(newRepos));
    } catch {
      // storage can be unavailable (e.g. private browsing); not essential
    }
  };

  const toggleSubtests = async (series) => {
    if (expanded[series.id]) {
      setExpanded(({ [series.id]: removed, ...rest }) => rest);
      return;
    }
    subtestRequest.current += 1;
    const request = subtestRequest.current;
    setExpanded((prev) => ({ ...prev, [series.id]: { loading: true, request } }));

    let response;
    try {
      response = await loadSubtests(series, interval);
    } catch {
      response = { failureStatus: true };
    }
    if (!mounted.current) return;
    const { data, failureStatus } = response;

    setExpanded((prev) => {
      // ignore replies for rows that were collapsed, or re-expanded since
      // (e.g. after a time range change) by a newer request
      if (prev[series.id]?.request !== request) return prev;
      return {
        ...prev,
        [series.id]: failureStatus
          ? { error: 'Failed to load subtests', request }
          : { data: [...data].sort(compareSeries), request },
      };
    });
  };

  // Closing the picker, by plotting or dismissing it, ends this "add tests"
  // session: pending selections are dropped, and a time range picked here no
  // longer applies, so later changes to the graph's own range are kept. The
  // search and filters stay so the next test is quicker to find.
  const endSession = () => {
    setSelected([]);
    setTimeRangePicked(false);
    setRelated(null);
    toggle();
  };

  const submitData = () => {
    const displayedTestParams = selected.map((series) => ({
      repository_name: series.projectName,
      signature_id: parseInt(series.id, 10),
      framework_id: parseInt(series.frameworkId, 10),
      replicates,
    }));

    if (timeRangePicked && innerTimeRange.value !== timeRange.value) {
      updateTestsAndTimeRange(displayedTestParams, innerTimeRange);
    } else {
      getTestData(displayedTestParams);
    }
    setExpanded({});
    endSession();
  };

  const onSearchKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = displayed[activeRowIndex + 1];
      if (next) setActiveId(next.id);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const previous = displayed[activeRowIndex - 1];
      if (previous) setActiveId(previous.id);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (event.metaKey || event.ctrlKey) {
        if (selected.length) submitData();
      } else if (displayed[activeRowIndex]) {
        toggleSelected(displayed[activeRowIndex]);
      }
    }
  };

  const otherRepos = projects
    .map((project) => project.name)
    .filter((name) => !PINNED_REPOS.includes(name) && !repos.includes(name))
    .sort();
  const repoChips = [
    ...PINNED_REPOS,
    ...repos.filter((repo) => !PINNED_REPOS.includes(repo)),
  ];

  const platformOptions = filterOptions(platformCounts, platformFilter);

  const browserOptions = filterOptions(browserCounts, browserFilter);

  // framework and tag filters are tucked away; the toggle says how many of
  // them are active so a hidden filter never silently narrows the results
  const hiddenActiveFilters = frameworkFilter.length + activeTags.length;

  const frameworkOptions = filterOptions(
    frameworkCounts,
    frameworkFilter,
    (frameworkId) => getFrameworkName(frameworks, frameworkId),
  );

  const isLoading = repos.some((repo) => loading.includes(repoKey(repo)));
  const visiblePlotted = testData.filter((series) => series.visible).length;
  const failures = repos
    .filter((repo) => failed[repoKey(repo)])
    .map((repo) => `${repo}: ${failed[repoKey(repo)]}`);

  const renderRow = (series, { isSubtest = false, rowIndex = -1 }) => {
    const plotted = plottedIds.has(series.id);
    const checked = plotted || isSelected(series);
    const isActive = rowIndex === activeRowIndex;
    const subtests = expanded[series.id];

    return (
      <tr
        key={series.id}
        id={rowId(series)}
        aria-selected={checked}
        ref={isActive ? activeRow : null}
        data-testid={series.id.toString()}
        title={plotted ? `${getFullTestName(series)} is already plotted` : rowTitle(series)}
        className={`${isActive ? 'table-active' : ''} ${
          plotted ? 'text-muted' : 'pointer'
        }`}
        onClick={() => toggleSelected(series)}
      >
        <td>
          <Form.Check
            type="checkbox"
            checked={checked}
            disabled={plotted}
            readOnly
            aria-label={`Select ${getFullTestName(series)}`}
          />
        </td>
        <td className={isSubtest ? 'ps-4' : ''}>
          {series.hasSubtests && !isSubtest && !includeSubtests && (
            <Button
              variant="link"
              size="sm"
              className="p-0 me-1 text-decoration-none"
              aria-expanded={Boolean(subtests)}
              title={subtests ? 'Hide subtests' : 'Show subtests'}
              onClick={(event) => {
                event.stopPropagation();
                toggleSubtests(series);
              }}
            >
              {subtests ? '▾' : '▸'}
            </Button>
          )}
          {series.name}
        </td>
        <td>{series.application || ''}</td>
        <td>{series.platform}</td>
        <td>{series.projectName}</td>
        <td>{getFrameworkName(frameworks, series.frameworkId)}</td>
        <td>
          {series.measurementUnit}
          {hasDifferentUnit(series) && !plotted && (
            <span className="ms-1 text-warning" aria-label="different unit">
              ⚠
            </span>
          )}
        </td>
      </tr>
    );
  };

  const renderSubtests = (series) => {
    const subtests = expanded[series.id];
    if (!subtests) return null;
    if (subtests.loading || subtests.error) {
      return (
        <tr key={`${series.id}-subtests`}>
          <td />
          <td colSpan={6} className="ps-4 small text-secondary">
            {subtests.error || 'Loading subtests…'}
          </td>
        </tr>
      );
    }
    return subtests.data.map((subtest) => renderRow(subtest, { isSubtest: true }));
  };

  const allFailed =
    repos.length > 0 && repos.every((repo) => failed[repoKey(repo)]);
  const noMatches =
    repos.length > 0 && !isLoading && !allFailed && !results.length;
  const includeSubtestsAndSearch = () => {
    setIncludeSubtests(true);
    setExpanded({});
  };

  let status;
  if (!index.length && isLoading) {
    status = 'Loading tests…';
  } else if (!repos.length) {
    status = 'Select at least one repository.';
  } else if (allFailed) {
    status = "Couldn't load any tests, see the errors above.";
  } else if (!results.length && !isLoading) {
    // the empty results area explains this (and offers to include subtests)
    status = '0 tests';
  } else if (results.length > MAX_RESULTS) {
    status = `Showing ${MAX_RESULTS} of ${results.length.toLocaleString()} tests, refine the search to see more.`;
  } else {
    status = `${results.length.toLocaleString()} tests${
      isLoading ? ', still loading…' : ''
    }`;
  }

  return (
    <Modal size="xl" show={showModal} onHide={endSession}>
      <Modal.Header closeButton>
        <Modal.Title>Add Test Data</Modal.Title>
      </Modal.Header>
      <Modal.Body className="test-search">
        <Form onSubmit={(event) => event.preventDefault()}>
          <Form.Control
            type="search"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Search tests, e.g. speedometer3 android fenix"
            aria-label="Search tests"
            role="combobox"
            aria-autocomplete="list"
            aria-haspopup="grid"
            aria-controls={RESULTS_ID}
            aria-expanded={displayed.length > 0}
            aria-activedescendant={
              displayed[activeRowIndex]
                ? rowId(displayed[activeRowIndex])
                : undefined
            }
            className="mb-2"
          />

          {related && (
            <Alert
              variant="info"
              className="py-1 px-2 mb-2 d-flex align-items-center justify-content-between small"
            >
              <span>
                {relatedFilters[related.option].label}{' '}
                <strong>{getFullTestName({
                  projectName: related.series.repository_name,
                  platform: related.series.platform,
                  name: related.series.name,
                  application: related.series.application,
                })}</strong>
              </span>
              <CloseButton
                aria-label="Show all tests"
                title="Show all tests"
                onClick={() => setRelated(null)}
              />
            </Alert>
          )}

          <FilterRow title="Repository">
            {repoChips.map((repo) => (
              <FilterChip
                key={repo}
                label={repo}
                active={repos.includes(repo)}
                loading={loading.includes(repoKey(repo))}
                onClick={() => toggleRepo(repo)}
              />
            ))}
            {otherRepos.length > 0 && (
              <Dropdown className="d-inline-block">
                <Dropdown.Toggle
                  size="sm"
                  variant="outline-secondary"
                  className="rounded-pill mb-1 test-search-chip"
                >
                  more
                </Dropdown.Toggle>
                <Dropdown.Menu className="overflow-auto test-search-repo-menu">
                  {otherRepos.map((repo) => (
                    <Dropdown.Item key={repo} onClick={() => toggleRepo(repo)}>
                      {repo}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            )}
          </FilterRow>

          <FilterRow title="Time range">
            <TimeRangeDropdown
              size="sm"
              variant="outline-darker-info"
              toggleClassName="rounded-pill mb-1 test-search-chip"
              timeRangeText={innerTimeRange.text}
              updateTimeRange={(newTimeRange) => {
                setInnerTimeRange(newTimeRange);
                setTimeRangePicked(true);
                setExpanded({});
              }}
            />
            <FilterChip
              label="Include subtests"
              className="ms-3 align-self-center"
              active={includeSubtests}
              title="Search subtests too (loads about twice as much data)"
              onClick={() => {
                setIncludeSubtests(!includeSubtests);
                setExpanded({});
              }}
            />
          </FilterRow>

          {platformOptions.length > 0 && (
            <FilterRow title="Platform">
              <CheckboxDropdown
                noun="Platform"
                plural="platforms"
                options={platformOptions}
                selected={platformFilter}
                onToggle={(platform) =>
                  setPlatformFilter((prev) => toggleItem(prev, platform))
                }
                onClear={() => setPlatformFilter([])}
              />
            </FilterRow>
          )}

          {browserOptions.length > 0 && (
            <FilterRow title="Browser">
              {browserOptions.map(([browser, count]) => (
                <FilterChip
                  key={browser}
                  label={browser}
                  count={count}
                  active={browserFilter.includes(browser)}
                  onClick={() =>
                    setBrowserFilter((prev) => toggleItem(prev, browser))
                  }
                />
              ))}
              {browserFilter.length > 0 && (
                <Button
                  size="sm"
                  variant="link"
                  className="p-0 mb-1 ms-1"
                  onClick={() => setBrowserFilter([])}
                >
                  clear
                </Button>
              )}
            </FilterRow>
          )}

          {(frameworkOptions.length > 0 || availableTags.length > 0) && (
            <Button
              size="sm"
              variant="link"
              className="p-0 mb-1"
              aria-expanded={showMoreFilters}
              onClick={() => setShowMoreFilters(!showMoreFilters)}
            >
              {showMoreFilters ? '▾ Fewer filters' : '▸ More filters'}
              {hiddenActiveFilters > 0 && ` (${hiddenActiveFilters} active)`}
            </Button>
          )}
          {showMoreFilters && (
            <>
              {frameworkOptions.length > 0 && (
                <FilterRow title="Framework">
                  {frameworkOptions.map(([frameworkId, count]) => (
                    <FilterChip
                      key={frameworkId}
                      label={getFrameworkName(frameworks, frameworkId)}
                      count={count}
                      active={frameworkFilter.includes(frameworkId)}
                      onClick={() =>
                        setFrameworkFilter((prev) =>
                          toggleItem(prev, frameworkId),
                        )
                      }
                    />
                  ))}
                  {frameworkFilter.length > 0 && (
                    <Button
                      size="sm"
                      variant="link"
                      className="p-0 mb-1 ms-1"
                      onClick={() => setFrameworkFilter([])}
                    >
                      clear
                    </Button>
                  )}
                </FilterRow>
              )}

              {availableTags.length > 0 && (
                <FilterRow title="Tags">
                  {availableTags.map((tag) => (
                    <FilterChip
                      key={tag}
                      label={tag}
                      active={activeTags.includes(tag)}
                      onClick={() => setActiveTags((prev) => toggleItem(prev, tag))}
                    />
                  ))}
                </FilterRow>
              )}
            </>
          )}

          {failures.length > 0 && (
            <Alert variant="danger" className="py-1 px-2 my-2 small">
              {failures.map((failure) => (
                <div key={failure}>{failure}</div>
              ))}
            </Alert>
          )}

          <div className="test-search-results border rounded mt-2">
            <Table
              size="sm"
              hover
              className="mb-0 small"
              id={RESULTS_ID}
              role="grid"
              aria-label="Tests"
              aria-multiselectable="true"
            >
              <thead className="sticky-top bg-white">
                <tr>
                  <th aria-label="Selected" />
                  {SORTABLE_COLUMNS.map(({ key, label }) => {
                    const direction = sort?.key === key ? sort.direction : 0;
                    return (
                      <th
                        key={key}
                        aria-sort={
                          { 1: 'ascending', '-1': 'descending' }[direction] ||
                          'none'
                        }
                      >
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 fw-bold text-reset text-decoration-none text-nowrap"
                          title={`Sort by ${label}`}
                          onClick={() => toggleSort(key)}
                        >
                          {label}
                          {direction === 1 && ' ▲'}
                          {direction === -1 && ' ▼'}
                        </Button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody data-testid="tests">
                {displayed.map((series, rowIndex) => (
                  <React.Fragment key={series.id}>
                    {renderRow(series, { rowIndex })}
                    {renderSubtests(series)}
                  </React.Fragment>
                ))}
              </tbody>
            </Table>
            {noMatches && (
              <div
                className="text-center text-secondary py-4"
                data-testid="no-matches"
              >
                <div>{related ? 'No related tests found.' : 'No tests match.'}</div>
                {!includeSubtests && !related && (
                  <div className="mt-2">
                    Subtests aren't searched yet.{' '}
                    <Button
                      size="sm"
                      variant="darker-info"
                      className="ms-1"
                      data-testid="suggest-subtests"
                      onClick={includeSubtestsAndSearch}
                    >
                      Include subtests
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="small text-secondary mt-1" role="status">
            {status}
            {displayed.length > 0 &&
              ' · ↑/↓ to move, Enter to select, Ctrl/⌘+Enter to plot'}
          </div>

          <div className="d-flex align-items-start mt-3">
            <div className="flex-grow-1">
              <div className="small text-secondary mb-1">
                Selected ({selected.length})
              </div>
              <div data-testid="selectedTests" className="d-flex flex-wrap">
                {selected.map((series) => (
                  <Button
                    key={series.id}
                    size="sm"
                    variant={hasDifferentUnit(series) ? 'warning' : 'light'}
                    className="me-1 mb-1 rounded-pill border"
                    title={`Remove ${rowTitle(series)}`}
                    onClick={() => toggleSelected(series)}
                  >
                    {getFullTestName(series)} ×
                  </Button>
                ))}
              </div>
              {visiblePlotted + selected.length > MAX_VISIBLE_GRAPHS && (
                <div className="small text-info">
                  Only {MAX_VISIBLE_GRAPHS} tests can be visible on the graph at
                  once; the rest are added hidden.
                </div>
              )}
            </div>
            <Button
              variant="darker-info"
              disabled={!selected.length}
              onClick={submitData}
            >
              Plot graphs{selected.length ? ` (${selected.length})` : ''}
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

TestDataModal.propTypes = {
  getTestData: PropTypes.func.isRequired,
  plottedUnits: PropTypes.instanceOf(Set).isRequired,
  projects: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  showModal: PropTypes.bool.isRequired,
  timeRange: PropTypes.shape({}).isRequired,
  toggle: PropTypes.func.isRequired,
  frameworks: PropTypes.arrayOf(PropTypes.shape({})),
  updateTestsAndTimeRange: PropTypes.func,
  loadSignatures: PropTypes.func,
  loadSubtests: PropTypes.func,
  replicates: PropTypes.bool,
  options: PropTypes.shape({
    option: PropTypes.string,
    relatedSeries: PropTypes.shape({}),
  }),
  testData: PropTypes.arrayOf(PropTypes.shape({})),
};

export default TestDataModal;
