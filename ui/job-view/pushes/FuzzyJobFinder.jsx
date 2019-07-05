import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  Button,
  Col,
  FormGroup,
  Label,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  InputGroup,
  Input,
} from 'reactstrap';
import Fuse from 'fuse.js';

import PushModel from '../../models/push';
import { formatTaskclusterError } from '../../helpers/errorMessage';
import { sortAlphaNum } from '../../helpers/sort';
import { notify } from '../redux/stores/notifications';

class FuzzyJobFinder extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      presets: {},
      fuzzySearch: '',
      fuzzyList: [],
      selectedList: [],
      removeDisabled: true,
      addDisabled: true,
      submitDisabled: false,
    };
  }

  componentDidMount() {
    this.loadPresets();
  }

  /*
   *  Filter the list of runnable jobs based on the value of this input.
   *  Only actually do the filtering when `enter` is pressed, as filtering 13K DOM elements is slow...
   *  If this input is empty when `enter` is pressed, reset back to the full list of runnable jobs.
   */
  filterJobs = ev => {
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
            keys: ['name', 'symbol'],
            threshold: 0.6, // This seems like a good threshold to remove most false matches, lower is stricter
            matchAllTokens: true,
            tokenize: true,
          };

          // Always search from the full (or full filtered) list of jobs
          const fuse = new Fuse(currentList, options);

          this.setState(prevState => ({
            fuzzyList: prevState.fuzzySearch
              ? fuse.search(prevState.fuzzySearch)
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
    });
  };

  addAllJobs = () => {
    const selectedOptions = Array.from(
      this.state.fuzzyList,
      option => option.name,
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

  addJobs = (evt, preset) => {
    const { selectedList } = this.state;
    const { addJobsSelected } = this.state;
    const { presets } = this.state;
    const { selectedPreset } = this.state;
    let jobsToBeAdded;

    if (preset) {
      jobsToBeAdded = presets[selectedPreset];
    } else {
      jobsToBeAdded = addJobsSelected;
      evt.target.parentNode.previousElementSibling.selectedIndex = -1;
    }

    // When adding jobs, add only new, unique job names to avoid duplicates
    const newSelectedList = [
      ...new Set([].concat(selectedList, jobsToBeAdded)),
    ];
    this.setState({ selectedList: newSelectedList });
  };

  removeJobs = () => {
    const { selectedList } = this.state;
    const { removeJobsSelected } = this.state;

    const newSelectedList = selectedList.filter(
      value => !removeJobsSelected.includes(value),
    );

    this.setState({ selectedList: newSelectedList }, () => {
      this.setState({
        removeDisabled: true,
      });
    });
  };

  loadPresets = () => {
    try {
      const savedPresets =
        JSON.parse(localStorage.getItem('saved-presets')) || {};
      this.setState({ presets: savedPresets });
    } catch (e) {
      // localStorage is disabled/not supported.
    }
  };

  deletePreset = () => {
    try {
      const savedPresets =
        JSON.parse(localStorage.getItem('saved-presets')) || {};
      delete savedPresets[this.state.selectedPreset];
      localStorage.setItem('saved-presets', JSON.stringify(savedPresets));
      this.setState({ presets: savedPresets, selectedPreset: '' });
    } catch (e) {
      // localStorage is disabled/not supported.
    }
  };

  savePreset = () => {
    const presetName = window.prompt('Name for this preset?');

    try {
      const savedPresets =
        JSON.parse(localStorage.getItem('saved-presets')) || {};
      if (savedPresets[presetName]) {
        if (
          window.confirm('Preset of this name already exists. Overwrite it?')
        ) {
          savedPresets[presetName] = this.state.selectedList;
          localStorage.setItem('saved-presets', JSON.stringify(savedPresets));
        }
      } else {
        savedPresets[presetName] = this.state.selectedList;
        localStorage.setItem('saved-presets', JSON.stringify(savedPresets));
      }
      this.setState({ presets: savedPresets });
    } catch (e) {
      // localStorage is disabled/not supported.
    }
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
      )
        .then(result => {
          notify(result, 'success');
          this.props.toggle();
        })
        .catch(e => {
          notify(formatTaskclusterError(e), 'danger', { sticky: true });
          this.setState({
            submitDisabled: false,
          });
        });
    } else {
      notify('Please select at least one job from the list', 'danger');
    }
  };

  toggleFullList = evt => {
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

  updateAddButton = evt => {
    const selectedOptions = Array.from(
      evt.target.selectedOptions,
      option => option.textContent,
    );

    this.setState({
      addDisabled: selectedOptions.length === 0,
      addJobsSelected: selectedOptions,
    });
  };

  updatePresetSelection = evt => {
    this.setState({
      selectedPreset: evt.target.selectedOptions[0].textContent,
    });
  };

  updateRemoveButton = evt => {
    const selectedOptions = Array.from(
      evt.target.selectedOptions,
      option => option.textContent,
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
            <InputGroup id="preset-group">
              <Label htmlFor="preset-select">Saved Presets:</Label>
              <Input
                bsSize="sm"
                type="select"
                id="preset-select"
                onChange={this.updatePresetSelection}
              >
                <option value=""></option>
                {Object.keys(this.state.presets)
                  .sort()
                  .map(e => (
                    <option key={e} title={this.state.presets[e].join('\n')}>
                      {e}
                    </option>
                  ))}
              </Input>
              <Button
                onClick={evt => this.addJobs(evt, true)}
                size="sm"
                color="success"
              >
                Add to Selection
              </Button>
              <Button
                size="sm"
                color="danger"
                disabled={this.state.selectedPreset === ''}
                onClick={this.deletePreset}
              >
                Delete Preset
              </Button>
            </InputGroup>
            <FormGroup row>
              <Col sm={10}>
                <Input
                  type="search"
                  onKeyDown={this.filterJobs}
                  placeholder="Filter runnable jobs: 'Android', 'Mochitest', 'Build', etc..."
                  className="my-2"
                  title="Filter the list of runnable jobs"
                />
              </Col>
              <Col sm={2}>
                <Label
                  className="my-3"
                  onChange={evt => this.toggleFullList(evt)}
                  title="The full list includes thousands of jobs that don't typically get run, and is much slower to render"
                >
                  <Input type="checkbox" /> Use full job list
                </Label>
              </Col>
            </FormGroup>
            <h4> Runnable Jobs [{this.state.fuzzyList.length}]</h4>
            <div className="fuzzybuttons">
              <Button
                onClick={this.addJobs}
                color="success"
                disabled={this.state.addDisabled}
              >
                Add selected
              </Button>
              &nbsp;
              <Button color="success" onClick={this.addAllJobs}>
                Add all
              </Button>
            </div>
            <InputGroup id="addJobsGroup">
              <Input type="select" multiple onChange={this.updateAddButton}>
                {this.state.fuzzyList.sort(sortAlphaNum).map(e => (
                  <option
                    title={`${e.name} - ${e.groupsymbol}(${e.symbol})`}
                    key={e.name}
                    className={
                      this.state.selectedList.includes(e.name) ? 'selected' : ''
                    }
                  >
                    {e.name}
                  </option>
                ))}
              </Input>
            </InputGroup>
            <hr />
            <h4> Selected Jobs [{this.state.selectedList.length}]</h4>
            <div className="fuzzybuttons">
              <Button
                onClick={this.removeJobs}
                color="danger"
                disabled={this.state.removeDisabled}
              >
                Remove selected
              </Button>
              &nbsp;
              <Button
                color="danger"
                onClick={this.removeAllJobs}
                disabled={this.state.selectedList.length === 0}
              >
                Remove all
              </Button>
              <Button
                id="save-presets"
                color="primary"
                onClick={this.savePreset}
                disabled={
                  this.state.selectedList.length === 0 ||
                  this.state.submitDisabled
                }
              >
                Save Selected Jobs as Preset
              </Button>
            </div>
            <InputGroup id="removeJobsGroup">
              <Input type="select" multiple onChange={this.updateRemoveButton}>
                {this.state.selectedList.sort(sortAlphaNum).map(e => (
                  <option title={e} key={e}>
                    {e}
                  </option>
                ))}
              </Input>
            </InputGroup>
          </ModalBody>
          <ModalFooter>
            <Button
              color="success"
              onClick={this.submitJobs}
              disabled={
                this.state.selectedList.length === 0 ||
                this.state.submitDisabled
              }
            >
              Trigger ({this.state.selectedList.length}) Selected Jobs
            </Button>{' '}
            <Button color="secondary" onClick={this.props.toggle}>
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
  jobList: PropTypes.array,
  filteredJobList: PropTypes.array,
};

FuzzyJobFinder.defaultProps = {
  jobList: [],
  filteredJobList: [],
  decisionTaskId: '',
};

export default connect(
  null,
  { notify },
)(FuzzyJobFinder);
