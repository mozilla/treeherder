import { useState, useCallback, useMemo, useId } from 'react';
import PropTypes from 'prop-types';
import {
  Button,
  Col,
  Form,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  InputGroup,
} from 'react-bootstrap';

import PushModel from '../../models/push';
import { formatTaskclusterError } from '../../helpers/errorMessage';
import { sortAlphaNum } from '../../helpers/sort';
import { notify } from '../../shared/stores/notificationStore';

import { normalizeTestPaths, planPathJobs } from './runnableJobPaths';
import useRunnableJobSearch from './useRunnableJobSearch';

// Cap how many <option> nodes we actually render. On firefox repos the
// runnable list can be tens of thousands of jobs; mounting (and later tearing
// down) that many DOM nodes freezes the main thread. Rendering only the first
// slice keeps the modal responsive; the header still shows the true match
// count, and narrowing the search brings the real matches under the cap.
const MAX_RENDERED_JOBS = 500;
const EMPTY_JOBS = [];

function FuzzyJobFinder({
  className,
  isOpen,
  toggle,
  jobList = EMPTY_JOBS,
  filteredJobList = EMPTY_JOBS,
  pushJobs = EMPTY_JOBS,
  decisionTaskId = '',
  revision = '',
  currentRepo,
}) {
  const [fuzzySearch, setFuzzySearch] = useState('');
  const [selectedList, setSelectedList] = useState([]);
  const [removeDisabled, setRemoveDisabled] = useState(true);
  const [submitDisabled, setSubmitDisabled] = useState(false);
  const [useFullList, setUseFullList] = useState(false);
  const [showChunkNumbers, setShowChunkNumbers] = useState(false);
  const [showSpecialized, setShowSpecialized] = useState(false);
  const [existingBuildsOnly, setExistingBuildsOnly] = useState(false);
  const [addJobsSelected, setAddJobsSelected] = useState([]);
  const [removeJobsSelected, setRemoveJobsSelected] = useState([]);
  const [pathInput, setPathInput] = useState('');
  const controlId = useId();
  const pathMode = Boolean(pathInput.trim());

  const jobsByLabel = useMemo(
    () => new Map(jobList.map((job) => [job.name, job])),
    [jobList],
  );
  const hasPathMetadata = revision && jobList.some((job) => job.pathScope);
  const { pathError, pathJobs, unmatchedPaths } = useMemo(() => {
    if (!pathMode) return {};
    const { paths, error } = normalizeTestPaths(pathInput);
    if (error) return { pathError: error };
    const { plan, unmatched } = planPathJobs(
      selectedList.map((label) => jobsByLabel.get(label)),
      paths,
    );
    return { pathJobs: plan, unmatchedPaths: unmatched };
  }, [jobsByLabel, pathInput, pathMode, selectedList]);

  // By default we show a trimmed down list of runnable jobs, but there's an
  // option to show the full list.
  const availableJobs = useFullList ? jobList : filteredJobList;
  const hasBuildMetadata = jobList.some((job) => job.buildDependency);
  const hasChunkMetadata = jobList.some(
    (job) => job.chunkPattern && job.chunkPattern !== job.name,
  );
  const hasSpecializedMetadata = jobList.some(
    (job) => job.specialized || Number(job.tier) > 1,
  );
  const existingBuilds = useMemo(
    () =>
      new Set(
        pushJobs
          .filter(
            (job) =>
              ['pending', 'running'].includes(job.state) ||
              job.result === 'success',
          )
          .map((job) => job.job_type_name),
      ),
    [pushJobs],
  );
  const buildFilter = existingBuildsOnly ? existingBuilds : null;
  const currentList = useMemo(() => {
    const groups = new Map();
    for (const job of availableJobs) {
      if (pathMode && !job.pathScope) continue;
      if (!showSpecialized && (job.specialized || Number(job.tier) > 1))
        continue;
      if (buildFilter && !buildFilter.has(job.buildDependency)) continue;
      const name = (!showChunkNumbers && job.chunkPattern) || job.name;
      if (!groups.has(name)) groups.set(name, { ...job, name, labels: [] });
      groups.get(name).labels.push(job.name);
    }
    return [...groups.values()];
  }, [availableJobs, buildFilter, pathMode, showChunkNumbers, showSpecialized]);
  const matchesByName = useMemo(
    () => new Map(currentList.map((job) => [job.name, job.labels])),
    [currentList],
  );

  const {
    matches: fuzzyList,
    pending,
    failed,
  } = useRunnableJobSearch(currentList, fuzzySearch, isOpen);

  // Only the first slice is turned into DOM nodes (see MAX_RENDERED_JOBS).
  const visibleJobs = useMemo(
    () => fuzzyList.slice(0, MAX_RENDERED_JOBS),
    [fuzzyList],
  );

  if (addJobsSelected.length > 0) {
    const visibleNames = new Set(visibleJobs.map((job) => job.name));
    const remaining = addJobsSelected.filter((name) => visibleNames.has(name));
    if (remaining.length !== addJobsSelected.length) {
      setAddJobsSelected(remaining);
    }
  }

  const selectedSet = useMemo(() => new Set(selectedList), [selectedList]);
  const sortedSelectedList = useMemo(
    () => [...selectedList].sort(sortAlphaNum),
    [selectedList],
  );

  const filterJobs = useCallback((ev) => {
    setFuzzySearch(ev.target.value);
  }, []);

  const resetForm = useCallback(() => {
    setSelectedList([]);
    setRemoveDisabled(true);
    setSubmitDisabled(false);
    setFuzzySearch('');
    setUseFullList(false);
    setShowChunkNumbers(false);
    setShowSpecialized(false);
    setExistingBuildsOnly(false);
    setPathInput('');
    setRemoveJobsSelected([]);
    setAddJobsSelected([]);
  }, []);

  const addAllJobs = useCallback(() => {
    if (pending || submitDisabled) return;
    const selectedOptions = fuzzyList.flatMap((option) => option.labels);

    // When adding jobs, add only new, unique job names to avoid duplicates
    setSelectedList((prev) => [...new Set([...prev, ...selectedOptions])]);
  }, [fuzzyList, pending, submitDisabled]);

  const removeAllJobs = useCallback(() => {
    setSelectedList([]);
    setRemoveDisabled(true);
  }, []);

  const addJobs = useCallback(() => {
    if (pending || submitDisabled) return;
    // When adding jobs, add only new, unique job names to avoid duplicates
    setSelectedList((prev) => [
      ...new Set([
        ...prev,
        ...addJobsSelected.flatMap((name) => matchesByName.get(name) ?? []),
      ]),
    ]);
    setAddJobsSelected([]);
  }, [addJobsSelected, matchesByName, pending, submitDisabled]);

  const removeJobs = useCallback(() => {
    setSelectedList((prev) =>
      prev.filter((value) => !removeJobsSelected.includes(value)),
    );
    setRemoveDisabled(true);
  }, [removeJobsSelected]);

  const canSubmit =
    !submitDisabled &&
    selectedList.length > 0 &&
    (!pathMode || (pathJobs?.length > 0 && !unmatchedPaths.length));

  const submitJobs = useCallback(async () => {
    if (!canSubmit) return;
    notify('Submitting selected jobs...');
    setSubmitDisabled(true);
    try {
      if (pathMode) {
        const { failed, submitted } = await PushModel.triggerJobsForPaths(
          pathJobs,
          decisionTaskId,
          currentRepo,
          revision,
        );
        if (failed.length) {
          const failedLabels = new Set(failed.map((job) => job.label));
          const retryPaths = new Set(
            pathJobs
              .filter((job) => failedLabels.has(job.label))
              .flatMap((job) => job.requestedPaths),
          );
          setSelectedList([...failedLabels]);
          setPathInput([...retryPaths].join('\n'));
          notify(
            `Requested ${submitted.length} of ${pathJobs.length} path-scoped jobs. ${formatTaskclusterError(failed[0].error)}`,
            'danger',
            { sticky: true },
          );
          setSubmitDisabled(false);
          return;
        }
        notify(`Requested ${submitted.length} path-scoped jobs.`, 'success');
      } else {
        const result = await PushModel.triggerNewJobs(
          selectedList,
          decisionTaskId,
          currentRepo,
        );
        notify(result, 'success');
      }
      toggle();
    } catch (error) {
      notify(formatTaskclusterError(error), 'danger', { sticky: true });
      setSubmitDisabled(false);
    }
  }, [
    canSubmit,
    pathMode,
    pathJobs,
    decisionTaskId,
    currentRepo,
    revision,
    selectedList,
    toggle,
  ]);

  const toggleFullList = useCallback((evt) => {
    setUseFullList(evt.target.checked);
    setAddJobsSelected([]);
  }, []);

  const updateAddButton = useCallback((evt) => {
    setAddJobsSelected(
      Array.from(evt.target.selectedOptions, (option) => option.value),
    );
  }, []);

  const updateRemoveButton = useCallback((evt) => {
    const selectedOptions = Array.from(
      evt.target.selectedOptions,
      (option) => option.textContent,
    );
    setRemoveDisabled(selectedOptions.length === 0);
    setRemoveJobsSelected(selectedOptions);
  }, []);

  return (
    <div>
      <Modal
        onExited={resetForm}
        size="lg"
        show={isOpen}
        onHide={submitDisabled ? undefined : toggle}
        className={className}
      >
        <ModalHeader>Add New Jobs (Search)</ModalHeader>
        <ModalBody>
          <Form.Group as="div" className="row">
            <Col sm={10}>
              <Form.Control
                type="search"
                value={fuzzySearch}
                onChange={filterJobs}
                placeholder="Try: ^test- 'mochitest !asan !tsan"
                className="my-2"
                title="Filter the list of runnable jobs"
              />
            </Col>
            <Col sm={2} className="d-flex align-items-center">
              <Form.Check
                type="checkbox"
                id={`${controlId}-full-list`}
                label="Use full job list"
                checked={useFullList}
                title="The full list includes thousands of jobs that don't typically get run, and is much slower to render"
                onChange={toggleFullList}
                className="my-2"
              />
            </Col>
          </Form.Group>
          <div className="d-flex flex-wrap gap-3 my-2">
            {hasChunkMetadata && (
              <Form.Check
                id={`${controlId}-show-chunks`}
                label="Show chunk numbers"
                checked={showChunkNumbers}
                onChange={(event) => {
                  setShowChunkNumbers(event.target.checked);
                  setAddJobsSelected([]);
                }}
              />
            )}
            {hasSpecializedMetadata && (
              <Form.Check
                id={`${controlId}-show-specialized`}
                label="Show specialized jobs"
                title="Includes tier 2 and tier 3 jobs"
                checked={showSpecialized}
                onChange={(event) => setShowSpecialized(event.target.checked)}
              />
            )}
            {hasBuildMetadata && (
              <Form.Check
                id={`${controlId}-existing-builds`}
                label="Only tests with existing builds"
                checked={existingBuildsOnly}
                disabled={submitDisabled}
                onChange={(event) => {
                  setExistingBuildsOnly(event.target.checked);
                  if (event.target.checked) {
                    setSelectedList((prev) =>
                      prev.filter((label) =>
                        existingBuilds.has(
                          jobsByLabel.get(label)?.buildDependency,
                        ),
                      ),
                    );
                  }
                }}
              />
            )}
          </div>
          {hasPathMetadata && (
            <Form.Group controlId={`${controlId}-test-paths`} className="my-2">
              <Form.Label>Test paths</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="One repository-relative directory per line"
                value={pathInput}
                disabled={submitDisabled}
                onChange={(event) => {
                  const value = event.target.value;
                  setPathInput(value);
                  if (value.trim()) {
                    setSelectedList((prev) =>
                      prev.filter((label) => jobsByLabel.get(label)?.pathScope),
                    );
                  }
                }}
              />
            </Form.Group>
          )}
          <h4> Runnable Jobs [{fuzzyList.length}]</h4>
          <div className="fuzzybuttons">
            <Button
              onClick={addJobs}
              variant="success"
              disabled={addJobsSelected.length === 0 || submitDisabled}
              aria-disabled={pending || undefined}
            >
              Add selected
            </Button>
            &nbsp;
            <Button
              variant="success"
              onClick={addAllJobs}
              aria-disabled={pending || undefined}
            >
              Add all
            </Button>
          </div>
          {fuzzyList.length > MAX_RENDERED_JOBS && (
            <small className="text-muted">
              Showing the first {MAX_RENDERED_JOBS} of {fuzzyList.length} jobs.
              Refine your search to narrow the list.
            </small>
          )}
          {failed && <div role="alert">Unable to search runnable jobs.</div>}
          <InputGroup id="addJobsGroup" aria-busy={pending && !failed}>
            <Form.Control
              as="select"
              multiple
              value={addJobsSelected}
              onChange={updateAddButton}
            >
              {visibleJobs.map((e) => (
                <option
                  data-testid="fuzzyList"
                  title={
                    e.labels.length > 1
                      ? `${e.name} (${e.labels.length} chunks)`
                      : `${e.name} - ${e.groupsymbol}(${e.symbol})`
                  }
                  key={e.name}
                  className={
                    e.labels.every((label) => selectedSet.has(label))
                      ? 'selected'
                      : ''
                  }
                >
                  {e.name}
                </option>
              ))}
            </Form.Control>
          </InputGroup>
          <hr />
          <h4> Selected Jobs [{selectedList.length}]</h4>
          <div className="fuzzybuttons">
            <Button
              onClick={removeJobs}
              variant="danger"
              disabled={removeDisabled || submitDisabled}
            >
              Remove selected
            </Button>
            &nbsp;
            <Button
              variant="danger"
              onClick={removeAllJobs}
              disabled={selectedList.length === 0 || submitDisabled}
            >
              Remove all
            </Button>
          </div>
          <InputGroup id="removeJobsGroup">
            <Form.Control as="select" multiple onChange={updateRemoveButton}>
              {sortedSelectedList.map((e) => (
                <option title={e} key={e}>
                  {e}
                </option>
              ))}
            </Form.Control>
          </InputGroup>
          {pathError && <div role="alert">{pathError}</div>}
          {selectedList.length > 0 && unmatchedPaths?.length > 0 && (
            <div role="alert">
              No selected test groups match {unmatchedPaths.join(', ')}.
            </div>
          )}
          {pathJobs?.length > 0 && (
            <details className="mt-2">
              <summary>
                {pathJobs.length === 1
                  ? '1 task matches the test paths'
                  : `${pathJobs.length} tasks match the test paths`}
              </summary>
              <ul>
                {pathJobs.slice(0, MAX_RENDERED_JOBS).map(({ label }) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </details>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={submitJobs} disabled={!canSubmit}>
            Trigger ({pathMode ? (pathJobs?.length ?? 0) : selectedList.length})
            Selected Jobs
          </Button>{' '}
          <Button
            variant="secondary"
            onClick={toggle}
            disabled={submitDisabled}
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

FuzzyJobFinder.propTypes = {
  className: PropTypes.string.isRequired,
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  decisionTaskId: PropTypes.string,
  revision: PropTypes.string,
  jobList: PropTypes.arrayOf(PropTypes.shape({})),
  filteredJobList: PropTypes.arrayOf(PropTypes.shape({})),
  pushJobs: PropTypes.arrayOf(PropTypes.shape({})),
  currentRepo: PropTypes.shape({}).isRequired,
};

export default FuzzyJobFinder;
