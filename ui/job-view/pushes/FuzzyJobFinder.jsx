import React from 'react';
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

class FuzzyJobFinder extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      fuzzySearch: '',
      fuzzyList: [],
      selectedList: [],
      removeDisabled: true,
      addDisabled: true,
      submitDisabled: false,
    };
  }

  /*
   *  Filter the list of runnable jobs based on the value of this input.
   *  Only actually do the filtering when `enter` is pressed, as filtering 13K DOM elements is slow...
   *  If this input is empty when `enter` is pressed, reset back to the full list of runnable jobs.
   */
  filterJobs = (ev) => {
    // By default we show a trimmed down list of runnable jobs, but there's an option to show the full list
    let currentList;
    if (this.state.useFullList) {
      currentList = this.props.jobList;
    } else {
      currentList = this.props.filteredJobList;
    }

    if (ev && ev.type === 'keydown') {
      if (ev.key === 'Enter') {
        this.setState({ fuzzySearch: ev.target.value }, () => {
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

          this.setState((prevState) => ({
            fuzzyList: prevState.fuzzySearch
              ? fuse.search(prevState.fuzzySearch).map((job) => job.item)
              : currentList,
          }));
        });
      }
    } else {
      this.setState({
        fuzzyList: currentList,
      });
    }
  };

  resetForm = () => {
    this.setState({
      selectedList: [],
      removeDisabled: true,
      submitDisabled: false,
    });
  };

  addAllJobs = () => {
    const selectedOptions = Array.from(
      this.state.fuzzyList,
      (option) => option.name,
    );
    let { selectedList } = this.state;

    // When adding jobs, add only new, unique job names to avoid duplicates
    selectedList = [...new Set([].concat(selectedList, selectedOptions))];
    this.setState({ selectedList });
  };

  removeAllJobs = () => {
    this.setState({
      selectedList: [],
      removeDisabled: true,
    });
  };

  addJobs = (evt) => {
    const { selectedList } = this.state;
    const { addJobsSelected } = this.state;

    // When adding jobs, add only new, unique job names to avoid duplicates
    const newSelectedList = [
      ...new Set([].concat(selectedList, addJobsSelected)),
    ];
    this.setState({ selectedList: newSelectedList });
    evt.target.parentNode.previousElementSibling.selectedIndex = -1;
  };

  removeJobs = () => {
    const { selectedList } = this.state;
    const { removeJobsSelected } = this.state;

    const newSelectedList = selectedList.filter(
      (value) => !removeJobsSelected.includes(value),
    );

    this.setState({ selectedList: newSelectedList }, () => {
      this.setState({
        removeDisabled: true,
      });
    });
  };

  submitJobs = () => {
    const { notify } = this.props;
    if (this.state.selectedList.length > 0) {
      notify('Submitting selected jobs...');
      this.setState({
        submitDisabled: true,
      });
      PushModel.triggerNewJobs(
        this.state.selectedList,
        this.props.decisionTaskId,
        this.props.currentRepo,
      )
        .then((result) => {
          notify(result, 'success');
          this.props.toggle();
        })
        .catch((e) => {
          notify(formatTaskclusterError(e), 'danger', { sticky: true });
          this.setState({
            submitDisabled: false,
          });
        });
    } else {
      notify('Please select at least one job from the list', 'danger');
    }
  };

  toggleFullList = (evt) => {
    this.setState(
      {
        useFullList: evt.target.checked,
      },
      () => {
        // Fake enough state to simulate the enter key being pressed in the search box
        this.filterJobs({
          type: 'keydown',
          key: 'Enter',
          target: { value: this.state.fuzzySearch },
        });
      },
    );
  };

  updateAddButton = (evt) => {
    const selectedOptions = Array.from(
      evt.target.selectedOptions,
      (option) => option.textContent,
    );

    this.setState({
      addDisabled: selectedOptions.length === 0,
      addJobsSelected: selectedOptions,
    });
  };

  updateRemoveButton = (evt) => {
    const selectedOptions = Array.from(
      evt.target.selectedOptions,
      (option) => option.textContent,
    );
    this.setState({
      removeDisabled: selectedOptions.length === 0,
      removeJobsSelected: selectedOptions,
    });
  };

  render() {
    return (
      <div>
        <Modal
          onOpened={this.filterJobs}
          onClosed={this.resetForm}
          size="lg"
          isOpen={this.props.isOpen}
          toggle={this.props.toggle}
          className={this.props.className}
        >
          <ModalHeader>Add New Jobs (Search)</ModalHeader>
          <ModalBody>
            <Form.Group row>
              <Col sm={10}>
                <Form.Control
                  type="search"
                  onKeyDown={this.filterJobs}
                  placeholder="Filter runnable jobs: 'Android', 'Mochitest', 'Build', etc..."
                  className="my-2"
                  title="Filter the list of runnable jobs"
                />
              </Col>
              <Col sm={2}>
                <Form.Label
                  className="my-3"
                  title="The full list includes thousands of jobs that don't typically get run, and is much slower to render"
                >
                  <Form.Control
                    type="checkbox"
                    onChange={(evt) => this.toggleFullList(evt)}
                  />
                  Use full job list
                </Form.Label>
              </Col>
            </Form.Group>
            <h4> Runnable Jobs [{this.state.fuzzyList.length}]</h4>
            <div className="fuzzybuttons">
              <Button
                onClick={this.addJobs}
                variant="success"
                disabled={this.state.addDisabled}
              >
                Add selected
              </Button>
              &nbsp;
              <Button variant="success" onClick={this.addAllJobs}>
                Add all
              </Button>
            </div>
            <InputGroup id="addJobsGroup">
              <Form.Control
                as="select"
                multiple
                onChange={this.updateAddButton}
              >
                {this.state.fuzzyList.sort(sortAlphaNum).map((e) => (
                  <option
                    data-testid="fuzzyList"
                    title={`${e.name} - ${e.groupsymbol}(${e.symbol})`}
                    key={e.name}
                    className={
                      this.state.selectedList.includes(e.name) ? 'selected' : ''
                    }
                  >
                    {e.name}
                  </option>
                ))}
              </Form.Control>
            </InputGroup>
            <hr />
            <h4> Selected Jobs [{this.state.selectedList.length}]</h4>
            <div className="fuzzybuttons">
              <Button
                onClick={this.removeJobs}
                variant="danger"
                disabled={this.state.removeDisabled}
              >
                Remove selected
              </Button>
              &nbsp;
              <Button
                variant="danger"
                onClick={this.removeAllJobs}
                disabled={this.state.selectedList.length === 0}
              >
                Remove all
              </Button>
            </div>
            <InputGroup id="removeJobsGroup">
              <Form.Control
                as="select"
                multiple
                onChange={this.updateRemoveButton}
              >
                {this.state.selectedList.sort(sortAlphaNum).map((e) => (
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
              onClick={this.submitJobs}
              disabled={
                this.state.selectedList.length === 0 ||
                this.state.submitDisabled
              }
            >
              Trigger ({this.state.selectedList.length}) Selected Jobs
            </Button>{' '}
            <Button variant="secondary" onClick={this.props.toggle}>
              Cancel
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    );
  }
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

FuzzyJobFinder.defaultProps = {
  jobList: [],
  filteredJobList: [],
  decisionTaskId: '',
};

export default connect(null, { notify })(FuzzyJobFinder);
