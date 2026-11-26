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
  const controlId = useId();

  const jobsByLabel = useMemo(
    () => new Map(jobList.map((job) => [job.name, job])),
    [jobList],
  );
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
      if (!showSpecialized && (job.specialized || Number(job.tier) > 1))
        continue;
      if (buildFilter && !buildFilter.has(job.buildDependency)) continue;
      const name = (!showChunkNumbers && job.chunkPattern) || job.name;
      if (!groups.has(name)) groups.set(name, { ...job, name, labels: [] });
      groups.get(name).labels.push(job.name);
    }
    return [...groups.values()];
  }, [availableJobs, buildFilter, showChunkNumbers, showSpecialized]);
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

  const canSubmit = !submitDisabled && selectedList.length > 0;

  const submitJobs = useCallback(async () => {
    if (!canSubmit) return;
    notify('Submitting selected jobs...');
    setSubmitDisabled(true);
    try {
      const result = await PushModel.triggerNewJobs(
        selectedList,
        decisionTaskId,
        currentRepo,
      );
      notify(result, 'success');
      toggle();
    } catch (error) {
      notify(formatTaskclusterError(error), 'danger', { sticky: true });
      setSubmitDisabled(false);
    }
  }, [canSubmit, selectedList, decisionTaskId, currentRepo, toggle]);

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
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={submitJobs} disabled={!canSubmit}>
            Trigger ({selectedList.length}) Selected Jobs
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
  jobList: PropTypes.arrayOf(PropTypes.shape({})),
  filteredJobList: PropTypes.arrayOf(PropTypes.shape({})),
  pushJobs: PropTypes.arrayOf(PropTypes.shape({})),
  currentRepo: PropTypes.shape({}).isRequired,
};

export default FuzzyJobFinder;
