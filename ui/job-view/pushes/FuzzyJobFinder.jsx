import { useState, useCallback, useMemo } from 'react';
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
import Fuse from 'fuse.js';

import PushModel from '../../models/push';
import { formatTaskclusterError } from '../../helpers/errorMessage';
import { sortAlphaNum } from '../../helpers/sort';
import { notify } from '../../shared/stores/notificationStore';

const FUSE_OPTIONS = {
  // http://fusejs.io/ describes the options available
  useExtendedSearch: true,
  keys: ['name', 'symbol'],
  threshold: 0.4, // This seems like a good threshold to remove most false matches, lower is stricter
  matchAllTokens: true,
  tokenize: true,
};

// Cap how many <option> nodes we actually render. On firefox repos the
// runnable list can be tens of thousands of jobs; mounting (and later tearing
// down) that many DOM nodes freezes the main thread. Rendering only the first
// slice keeps the modal responsive; the header still shows the true match
// count, and narrowing the search brings the real matches under the cap.
const MAX_RENDERED_JOBS = 500;

function FuzzyJobFinder({
  className,
  isOpen,
  toggle,
  jobList = [],
  filteredJobList = [],
  decisionTaskId = '',
  currentRepo,
}) {
  const [fuzzySearch, setFuzzySearch] = useState('');
  const [selectedList, setSelectedList] = useState([]);
  const [removeDisabled, setRemoveDisabled] = useState(true);
  const [addDisabled, setAddDisabled] = useState(true);
  const [submitDisabled, setSubmitDisabled] = useState(false);
  const [useFullList, setUseFullList] = useState(false);
  const [addJobsSelected, setAddJobsSelected] = useState([]);
  const [removeJobsSelected, setRemoveJobsSelected] = useState([]);

  // By default we show a trimmed down list of runnable jobs, but there's an
  // option to show the full list.
  const currentList = useFullList ? jobList : filteredJobList;

  // Build the Fuse index only when the underlying list changes, instead of
  // rebuilding it from scratch on every search (expensive with tens of
  // thousands of runnable tasks).
  const fuse = useMemo(() => new Fuse(currentList, FUSE_OPTIONS), [currentList]);

  /*
   *  The list of runnable jobs to display, derived from the current search term.
   *  Filtering only happens when `enter` is pressed (which updates `fuzzySearch`)
   *  rather than on every keystroke, as the fuzzy search is costly over large
   *  lists. When the search is empty we fall back to the full (filtered) list of
   *  runnable jobs. Memoized so the search + sort only reruns when the term or
   *  source list changes, not on every re-render (e.g. selecting an option).
   */
  const fuzzyList = useMemo(() => {
    const matches = fuzzySearch
      ? fuse.search(fuzzySearch).map((job) => job.item)
      : currentList;
    // Sort a copy.
    return [...matches].sort(sortAlphaNum);
  }, [fuse, fuzzySearch, currentList]);

  // Only the first slice is turned into DOM nodes (see MAX_RENDERED_JOBS).
  const visibleJobs = useMemo(
    () => fuzzyList.slice(0, MAX_RENDERED_JOBS),
    [fuzzyList],
  );

  const selectedSet = useMemo(() => new Set(selectedList), [selectedList]);
  const sortedSelectedList = useMemo(
    () => [...selectedList].sort(sortAlphaNum),
    [selectedList],
  );

  const filterJobs = useCallback((ev) => {
    if (ev && ev.type === 'keydown' && ev.key === 'Enter') {
      setFuzzySearch(ev.target.value);
    }
  }, []);

  const resetForm = useCallback(() => {
    setSelectedList([]);
    setRemoveDisabled(true);
    setSubmitDisabled(false);
    setFuzzySearch('');
    setUseFullList(false);
  }, []);

  const addAllJobs = useCallback(() => {
    const selectedOptions = Array.from(fuzzyList, (option) => option.name);

    // When adding jobs, add only new, unique job names to avoid duplicates
    setSelectedList((prev) => [...new Set([...prev, ...selectedOptions])]);
  }, [fuzzyList]);

  const removeAllJobs = useCallback(() => {
    setSelectedList([]);
    setRemoveDisabled(true);
  }, []);

  const addJobs = useCallback(
    (evt) => {
      // When adding jobs, add only new, unique job names to avoid duplicates
      setSelectedList((prev) => [...new Set([...prev, ...addJobsSelected])]);
      evt.target.parentNode.previousElementSibling.selectedIndex = -1;
    },
    [addJobsSelected],
  );

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
    // `currentList` (and therefore `fuzzyList`) derives from this state, so the
    // list re-derives automatically with the current search term applied.
    setUseFullList(evt.target.checked);
  }, []);

  const updateAddButton = useCallback((evt) => {
    const selectedOptions = Array.from(
      evt.target.selectedOptions,
      (option) => option.textContent,
    );

    setAddDisabled(selectedOptions.length === 0);
    setAddJobsSelected(selectedOptions);
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
                onKeyDown={filterJobs}
                placeholder="Filter runnable jobs: 'Android', 'Mochitest', 'Build', etc..."
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
            <Button onClick={addJobs} variant="success" disabled={addDisabled}>
              Add selected
            </Button>
            &nbsp;
            <Button variant="success" onClick={addAllJobs}>
              Add all
            </Button>
          </div>
          {fuzzyList.length > MAX_RENDERED_JOBS && (
            <small className="text-muted">
              Showing the first {MAX_RENDERED_JOBS} of {fuzzyList.length} jobs.
              Refine your search to narrow the list.
            </small>
          )}
          <InputGroup id="addJobsGroup">
            <Form.Control as="select" multiple onChange={updateAddButton}>
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
