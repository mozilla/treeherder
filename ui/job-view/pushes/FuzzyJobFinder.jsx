import React, { useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
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
import { notify } from '../redux/stores/notifications';

function FuzzyJobFinder({
  className,
  isOpen,
  toggle,
  jobList = [],
  filteredJobList = [],
  decisionTaskId = '',
  currentRepo,
  notify,
}) {
  const [fuzzySearch, setFuzzySearch] = useState('');
  const [fuzzyList, setFuzzyList] = useState([]);
  const [selectedList, setSelectedList] = useState([]);
  const [removeDisabled, setRemoveDisabled] = useState(true);
  const [addDisabled, setAddDisabled] = useState(true);
  const [submitDisabled, setSubmitDisabled] = useState(false);
  const [useFullList, setUseFullList] = useState(false);
  const [addJobsSelected, setAddJobsSelected] = useState([]);
  const [removeJobsSelected, setRemoveJobsSelected] = useState([]);

  // Use refs to access latest state in callbacks without stale closures
  const useFullListRef = useRef(useFullList);
  useFullListRef.current = useFullList;

  /*
   *  Filter the list of runnable jobs based on the value of this input.
   *  Only actually do the filtering when `enter` is pressed, as filtering 13K DOM elements is slow...
   *  If this input is empty when `enter` is pressed, reset back to the full list of runnable jobs.
   */
  const filterJobs = useCallback(
    (ev) => {
      // By default we show a trimmed down list of runnable jobs, but there's an option to show the full list
      const currentList = useFullListRef.current ? jobList : filteredJobList;

      if (ev && ev.type === 'keydown') {
        if (ev.key === 'Enter') {
          const searchValue = ev.target.value;
          setFuzzySearch(searchValue);

          const options = {
            // http://fusejs.io/ describes the options available
            useExtendedSearch: true,
            keys: ['name', 'symbol'],
            threshold: 0.4, // This seems like a good threshold to remove most false matches, lower is stricter
            matchAllTokens: true,
            tokenize: true,
          };

          // Always search from the full (or full filtered) list of jobs
          const fuse = new Fuse(currentList, options);

          setFuzzyList(
            searchValue
              ? fuse.search(searchValue).map((job) => job.item)
              : currentList,
          );
        }
      } else {
        setFuzzyList(currentList);
      }
    },
    [jobList, filteredJobList],
  );

  const resetForm = useCallback(() => {
    setSelectedList([]);
    setRemoveDisabled(true);
    setSubmitDisabled(false);
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

  const toggleFullList = useCallback(
    (evt) => {
      const { checked } = evt.target;
      setUseFullList(checked);
      useFullListRef.current = checked;
      // Fake enough state to simulate the enter key being pressed in the search box
      filterJobs({
        type: 'keydown',
        key: 'Enter',
        target: { value: fuzzySearch },
      });
    },
    [fuzzySearch, filterJobs],
  );

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
        onShow={filterJobs}
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
          <InputGroup id="addJobsGroup">
            <Form.Control as="select" multiple onChange={updateAddButton}>
              {fuzzyList.sort(sortAlphaNum).map((e) => (
                <option
                  data-testid="fuzzyList"
                  title={`${e.name} - ${e.groupsymbol}(${e.symbol})`}
                  key={e.name}
                  className={selectedList.includes(e.name) ? 'selected' : ''}
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
              {selectedList.sort(sortAlphaNum).map((e) => (
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
  notify: PropTypes.func.isRequired,
  toggle: PropTypes.func.isRequired,
  decisionTaskId: PropTypes.string,
  jobList: PropTypes.arrayOf(PropTypes.shape({})),
  filteredJobList: PropTypes.arrayOf(PropTypes.shape({})),
  currentRepo: PropTypes.shape({}).isRequired,
};

export default connect(null, { notify })(FuzzyJobFinder);
