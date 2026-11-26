import { useState, useCallback, useEffect, useMemo } from 'react';
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
  decisionTaskId = '',
  currentRepo,
}) {
  const [fuzzySearch, setFuzzySearch] = useState('');
  const [selectedList, setSelectedList] = useState([]);
  const [removeDisabled, setRemoveDisabled] = useState(true);
  const [submitDisabled, setSubmitDisabled] = useState(false);
  const [useFullList, setUseFullList] = useState(false);
  const [addJobsSelected, setAddJobsSelected] = useState([]);
  const [removeJobsSelected, setRemoveJobsSelected] = useState([]);

  // By default we show a trimmed down list of runnable jobs, but there's an
  // option to show the full list.
  const currentList = useFullList ? jobList : filteredJobList;

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

  const visibleSelection = useMemo(() => {
    if (addJobsSelected.length === 0) return addJobsSelected;
    const visibleNames = new Set(visibleJobs.map((job) => job.name));
    const remaining = addJobsSelected.filter((name) => visibleNames.has(name));
    return remaining.length === addJobsSelected.length
      ? addJobsSelected
      : remaining;
  }, [addJobsSelected, visibleJobs]);

  useEffect(() => {
    if (visibleSelection !== addJobsSelected) {
      setAddJobsSelected(visibleSelection);
    }
  }, [addJobsSelected, visibleSelection]);

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
    setAddJobsSelected([]);
  }, []);

  const addAllJobs = useCallback(() => {
    if (pending) return;
    const selectedOptions = Array.from(fuzzyList, (option) => option.name);

    // When adding jobs, add only new, unique job names to avoid duplicates
    setSelectedList((prev) => [...new Set([...prev, ...selectedOptions])]);
  }, [fuzzyList, pending]);

  const removeAllJobs = useCallback(() => {
    setSelectedList([]);
    setRemoveDisabled(true);
  }, []);

  const addJobs = useCallback(() => {
    if (pending) return;
    // When adding jobs, add only new, unique job names to avoid duplicates
    setSelectedList((prev) => [...new Set([...prev, ...visibleSelection])]);
    setAddJobsSelected([]);
  }, [visibleSelection, pending]);

  const removeJobs = useCallback(() => {
    setSelectedList((prev) =>
      prev.filter((value) => !removeJobsSelected.includes(value)),
    );
    setRemoveDisabled(true);
  }, [removeJobsSelected]);

  const submitJobs = useCallback(() => {
    if (selectedList.length > 0) {
      notify('Submitting selected jobs...');
      setSubmitDisabled(true);
      PushModel.triggerNewJobs(selectedList, decisionTaskId, currentRepo)
        .then((result) => {
          notify(result, 'success');
          toggle();
        })
        .catch((e) => {
          notify(formatTaskclusterError(e), 'danger', { sticky: true });
          setSubmitDisabled(false);
        });
    } else {
      notify('Please select at least one job from the list', 'danger');
    }
  }, [selectedList, decisionTaskId, currentRepo, notify, toggle]);

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
        onHide={toggle}
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
                label="Use full job list"
                title="The full list includes thousands of jobs that don't typically get run, and is much slower to render"
                onChange={toggleFullList}
                className="my-2"
              />
            </Col>
          </Form.Group>
          <h4> Runnable Jobs [{fuzzyList.length}]</h4>
          <div className="fuzzybuttons">
            <Button
              onClick={addJobs}
              variant="success"
              disabled={pending || visibleSelection.length === 0}
            >
              Add selected
            </Button>
            &nbsp;
            <Button variant="success" onClick={addAllJobs} disabled={pending}>
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
              value={visibleSelection}
              onChange={updateAddButton}
            >
              {visibleJobs.map((e) => (
                <option
                  data-testid="fuzzyList"
                  title={`${e.name} - ${e.groupsymbol}(${e.symbol})`}
                  key={e.name}
                  className={selectedSet.has(e.name) ? 'selected' : ''}
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
              disabled={removeDisabled}
            >
              Remove selected
            </Button>
            &nbsp;
            <Button
              variant="danger"
              onClick={removeAllJobs}
              disabled={selectedList.length === 0}
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
          <Button
            variant="primary"
            onClick={submitJobs}
            disabled={selectedList.length === 0 || submitDisabled}
          >
            Trigger ({selectedList.length}) Selected Jobs
          </Button>{' '}
          <Button variant="secondary" onClick={toggle}>
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
  currentRepo: PropTypes.shape({}).isRequired,
};

export default FuzzyJobFinder;
