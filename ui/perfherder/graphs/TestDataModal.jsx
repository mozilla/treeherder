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

import {
  getFrameworkName,
  loadRepositorySignatures,
  loadSubtestSignatures,
  matchesQuery,
} from '../perf-helpers/helpers';

import TimeRangeDropdown from './TimeRangeDropdown';

const PINNED_REPOS = ['mozilla-central', 'autoland', 'mozilla-beta', 'try'];
// try is the largest repository and rarely wanted in a general search, so it
// is only loaded once the user asks for it.
const DEFAULT_REPOS = ['mozilla-central', 'autoland', 'mozilla-beta'];
const REPOS_STORAGE_KEY = 'perfherder-graphs-test-search-repos';
const MAX_RESULTS = 200;
const MAX_VISIBLE_GRAPHS = 6;
const COLLAPSED_PLATFORM_CHIPS = 8;

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

const FilterChip = ({ label, count, active, loading, onClick, title }) => (
  <Button
    size="sm"
    variant={active ? 'darker-info' : 'outline-darker-info'}
    className="me-1 mb-1 rounded-pill test-search-chip"
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
  const [activeTags, setActiveTags] = useState([]);
  const [showAllPlatforms, setShowAllPlatforms] = useState(false);
  const [innerTimeRange, setInnerTimeRange] = useState(timeRange);
  const [selected, setSelected] = useState([]);
  const [related, setRelated] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [activeIndex, setActiveIndex] = useState(0);

  const pending = useRef(new Set());
  const mounted = useRef(true);
  const activeRow = useRef(null);

  const interval = innerTimeRange.value;
  const repoKey = (repo) => `${repo}:${interval}`;

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  useEffect(() => {
    setInnerTimeRange(timeRange);
  }, [timeRange]);

  // The legend card links open the modal pre-filtered to related tests.
  useEffect(() => {
    const { option, relatedSeries } = options ?? {};
    if (!relatedSeries || !relatedFilters[option]) return;

    setRelated({ option, series: relatedSeries });
    setQuery('');
    setPlatformFilter([]);
    setFrameworkFilter([]);
    setActiveTags([]);
    setRepos((prev) =>
      prev.includes(relatedSeries.repository_name)
        ? prev
        : [...prev, relatedSeries.repository_name],
    );
  }, [options]);

  // Signature lists are only fetched while the modal is open.
  useEffect(() => {
    if (!showModal) return;

    repos.forEach((repo) => {
      const key = `${repo}:${interval}`;
      if (loaded[key] || failed[key] || pending.current.has(key)) return;

      pending.current.add(key);
      setLoading((prev) => [...prev, key]);
      loadSignatures(repo, interval, frameworks).then(
        ({ data, failureStatus }) => {
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
        },
      );
    });
  }, [showModal, repos, interval, loaded, failed, frameworks, loadSignatures]);

  const index = useMemo(
    () =>
      repos
        .flatMap((repo) => loaded[`${repo}:${interval}`] || [])
        .sort(compareSeries),
    [repos, loaded, interval],
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

  const { results, platformCounts, frameworkCounts, availableTags } =
    useMemo(() => {
      const platforms = new Map();
      const frameworkIds = new Map();
      const tags = new Set(activeTags);
      const matching = [];

      baseResults.forEach((series) => {
        const platformMatches =
          !platformFilter.length || platformFilter.includes(series.platform);
        const frameworkMatches =
          !frameworkFilter.length ||
          frameworkFilter.includes(series.frameworkId);

        if (frameworkMatches) {
          platforms.set(series.platform, (platforms.get(series.platform) || 0) + 1);
        }
        if (platformMatches) {
          frameworkIds.set(
            series.frameworkId,
            (frameworkIds.get(series.frameworkId) || 0) + 1,
          );
        }
        if (platformMatches && frameworkMatches) {
          matching.push(series);
          series.tags.forEach((tag) => tags.add(tag));
        }
      });

      return {
        results: matching,
        platformCounts: platforms,
        frameworkCounts: frameworkIds,
        availableTags: [...tags].sort(),
      };
    }, [baseResults, platformFilter, frameworkFilter, activeTags]);

  const displayed = results.slice(0, MAX_RESULTS);

  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  useEffect(() => {
    activeRow.current?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex]);

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
    setExpanded((prev) => ({ ...prev, [series.id]: { loading: true } }));

    const { data, failureStatus } = await loadSubtests(series, interval);
    if (!mounted.current) return;

    setExpanded((prev) => {
      if (!prev[series.id]) return prev;
      return {
        ...prev,
        [series.id]: failureStatus
          ? { error: 'Failed to load subtests' }
          : { data: [...data].sort(compareSeries) },
      };
    });
  };

  const submitData = () => {
    const displayedTestParams = selected.map((series) => ({
      repository_name: series.projectName,
      signature_id: parseInt(series.id, 10),
      framework_id: parseInt(series.frameworkId, 10),
      replicates,
    }));

    if (innerTimeRange.value !== timeRange.value) {
      updateTestsAndTimeRange(displayedTestParams, innerTimeRange);
    } else {
      getTestData(displayedTestParams);
    }
    // the search and filters are kept so the next test is quicker to add
    setSelected([]);
    setRelated(null);
    setExpanded({});
    toggle();
  };

  const onSearchKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, displayed.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (event.metaKey || event.ctrlKey) {
        if (selected.length) submitData();
      } else if (displayed[activeIndex]) {
        toggleSelected(displayed[activeIndex]);
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

  const sortedPlatforms = [...platformCounts.entries()].sort(
    (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1),
  );
  // selected platforms stay visible even when nothing else matches them
  platformFilter.forEach((platform) => {
    if (!platformCounts.has(platform)) sortedPlatforms.push([platform, 0]);
  });
  const visiblePlatforms = showAllPlatforms
    ? sortedPlatforms
    : sortedPlatforms.filter(
        ([platform], i) =>
          i < COLLAPSED_PLATFORM_CHIPS || platformFilter.includes(platform),
      );
  const hiddenPlatformCount = sortedPlatforms.length - visiblePlatforms.length;

  const sortedFrameworks = [...frameworkCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  );

  const isLoading = loading.some((key) => key.endsWith(`:${interval}`));
  const visiblePlotted = testData.filter((series) => series.visible).length;
  const failures = repos
    .filter((repo) => failed[repoKey(repo)])
    .map((repo) => `${repo}: ${failed[repoKey(repo)]}`);

  const renderRow = (series, { isSubtest = false, rowIndex = -1 } = {}) => {
    const plotted = plottedIds.has(series.id);
    const checked = plotted || isSelected(series);
    const isActive = rowIndex === activeIndex;
    const subtests = expanded[series.id];

    return (
      <tr
        key={series.id}
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
          {series.hasSubtests && !isSubtest && (
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

  let status;
  if (!index.length && isLoading) {
    status = 'Loading tests…';
  } else if (!repos.length) {
    status = 'Select at least one repository.';
  } else if (!results.length && !isLoading) {
    status = related ? 'No related tests found.' : 'No tests match.';
  } else if (results.length > MAX_RESULTS) {
    status = `Showing ${MAX_RESULTS} of ${results.length.toLocaleString()} tests, refine the search to see more.`;
  } else {
    status = `${results.length.toLocaleString()} tests${
      isLoading ? ', still loading…' : ''
    }`;
  }

  return (
    <Modal size="xl" show={showModal} onHide={toggle}>
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

          {sortedPlatforms.length > 0 && (
            <FilterRow title="Platform">
              {visiblePlatforms.map(([platform, count]) => (
                <FilterChip
                  key={platform}
                  label={platform}
                  count={count}
                  active={platformFilter.includes(platform)}
                  onClick={() =>
                    setPlatformFilter((prev) => toggleItem(prev, platform))
                  }
                />
              ))}
              {(hiddenPlatformCount > 0 || showAllPlatforms) && (
                <Button
                  size="sm"
                  variant="link"
                  className="mb-1"
                  onClick={() => setShowAllPlatforms(!showAllPlatforms)}
                >
                  {showAllPlatforms ? 'fewer' : `+${hiddenPlatformCount} more`}
                </Button>
              )}
            </FilterRow>
          )}

          {sortedFrameworks.length > 0 && (
            <FilterRow title="Framework">
              {sortedFrameworks.map(([frameworkId, count]) => (
                <FilterChip
                  key={frameworkId}
                  label={getFrameworkName(frameworks, frameworkId)}
                  count={count}
                  active={frameworkFilter.includes(frameworkId)}
                  onClick={() =>
                    setFrameworkFilter((prev) => toggleItem(prev, frameworkId))
                  }
                />
              ))}
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

          <FilterRow title="Time range">
            <TimeRangeDropdown
              timeRangeText={innerTimeRange.text}
              updateTimeRange={(newTimeRange) => {
                setInnerTimeRange(newTimeRange);
                setExpanded({});
              }}
            />
          </FilterRow>

          {failures.length > 0 && (
            <Alert variant="danger" className="py-1 px-2 my-2 small">
              {failures.map((failure) => (
                <div key={failure}>{failure}</div>
              ))}
            </Alert>
          )}

          <div className="test-search-results border rounded mt-2">
            <Table size="sm" hover className="mb-0 small">
              <thead className="sticky-top bg-white">
                <tr>
                  <th aria-label="Selected" />
                  <th>Test</th>
                  <th>App</th>
                  <th>Platform</th>
                  <th>Repository</th>
                  <th>Framework</th>
                  <th>Unit</th>
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
