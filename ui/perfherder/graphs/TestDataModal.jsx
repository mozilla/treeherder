import React from 'react';
import PropTypes from 'prop-types';
import {
  Button,
  Col,
  Form,
  Input,
  Label,
  Modal,
  ModalHeader,
  ModalBody,
  Row,
} from 'reactstrap';

import { createDropdowns } from '../FilterControls';
import InputFilter from '../../shared/InputFilter';
import { processResponse } from '../../helpers/http';
import PerfSeriesModel from '../../models/perfSeries';
import { thPerformanceBranches } from '../../helpers/constants';
import { containsText, getInitialData, getSeriesData } from '../helpers';

export default class TestDataModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      platforms: [],
      framework: { name: 'talos', id: 1 },
      repository_name: this.findObject(
        this.props.projects,
        'name',
        'mozilla-central',
      ),
      platform: 'linux64',
      pinnedProjects: ['autoland', 'mozilla-central', 'mozilla-beta', 'try'],
      errorMessages: [],
      includeSubtests: false,
      seriesData: [],
      relatedTests: [],
      selectedTests: [],
      filteredData: [],
      showNoRelatedTests: false,
      filterText: '',
      loading: true,
      selectedUnits: new Set(),
    };
  }

  async componentDidMount() {
    const {
      errorMessages,
      repository_name: repositoryName,
      framework,
    } = this.state;
    const { timeRange, getInitialData } = this.props;
    const updates = await getInitialData(
      errorMessages,
      repositoryName,
      framework,
      timeRange,
    );
    this.setState(updates, this.processOptions);
  }

  componentDidUpdate(prevProps, prevState) {
    const { platforms, platform } = this.state;
    const { testData } = this.props;

    if (prevState.platforms !== platforms) {
      const newPlatform = platforms.find(item => item === platform)
        ? platform
        : platforms[0];
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ platform: newPlatform });
    }
    if (this.props.options !== prevProps.options) {
      this.processOptions(true);
    }

    if (testData !== prevProps.testData) {
      this.processOptions();
    }
  }

  async getPlatforms() {
    const {
      repository_name: repositoryName,
      framework,
      errorMessages,
    } = this.state;
    const { timeRange } = this.props;

    const params = { interval: timeRange.value, framework: framework.id };
    const response = await PerfSeriesModel.getPlatformList(
      repositoryName.name,
      params,
    );

    const updates = processResponse(response, 'platforms', errorMessages);
    this.setState(updates);
    this.processOptions();
  }

  getDropdownOptions(options) {
    return options.length ? options.map(item => item.name) : [];
  }

  addRelatedApplications = async params => {
    const { relatedSeries: relatedSignature } = this.props.options;
    const { errorMessages } = this.state;
    let relatedTests = [];

    const { data, failureStatus } = await PerfSeriesModel.getSeriesList(
      relatedSignature.repository_name,
      params,
    );

    if (!failureStatus) {
      relatedTests = data.filter(signature => {
        const differentApplications =
          signature.application !== relatedSignature.application;
        const similarTestNames =
          this.removeSubstring(signature.application, signature.name) ===
          this.removeSubstring(
            relatedSignature.application,
            relatedSignature.name,
          );
        const samePlatform = signature.platform === relatedSignature.platform;
        const sameProject =
          signature.projectName === relatedSignature.repository_name;

        return (
          differentApplications &&
          similarTestNames &&
          samePlatform &&
          sameProject
        );
      });
    } else {
      errorMessages.push(data);
    }

    this.setState({
      relatedTests,
      showNoRelatedTests: relatedTests.length === 0,
      errorMessages,
      loading: false,
    });
  };

  addRelatedConfigs = async params => {
    const { relatedSeries } = this.props.options;
    const { errorMessages, repository_name: repositoryName } = this.state;

    const response = await PerfSeriesModel.getSeriesList(
      repositoryName.name,
      params,
    );
    const updates = processResponse(response, 'relatedTests', errorMessages);

    if (updates.relatedTests.length) {
      const tests = updates.relatedTests.filter(
        series =>
          series.platform === relatedSeries.platform &&
          series.testName === relatedSeries.test &&
          series.name !== relatedSeries.name,
      );

      updates.relatedTests = tests;
    }
    updates.showNoRelatedTests = updates.relatedTests.length === 0;
    updates.loading = false;

    this.setState(updates);
  };

  addRelatedBranches = async (params, samePlatform = true) => {
    const { relatedSeries } = this.props.options;
    const { errorMessages } = this.state;

    const relatedProjects = thPerformanceBranches.filter(
      repositoryName => repositoryName !== relatedSeries.repository_name,
    );

    const requests = relatedProjects.map(projectName =>
      PerfSeriesModel.getSeriesList(projectName, params),
    );

    const responses = await Promise.all(requests);
    const relatedTests = responses
      .flatMap(item => {
        if (!item.failureStatus) {
          return item.data;
        }
        errorMessages.push(item.data);
      })
      .filter(
        item =>
          item.name === relatedSeries.name &&
          (samePlatform
            ? item.platform === relatedSeries.platform
            : item.platform !== relatedSeries.platform),
      );

    this.setState({
      relatedTests,
      showNoRelatedTests: relatedTests.length === 0,
      errorMessages,
      loading: false,
    });
  };

  processOptions = async (relatedTestsMode = false) => {
    const { option, relatedSeries } = this.props.options;
    const {
      platform,
      framework,
      includeSubtests,
      errorMessages,
      repository_name: repositoryName,
    } = this.state;
    const { timeRange, getSeriesData, testData } = this.props;

    const params = {
      interval: timeRange.value,
      framework: framework.id,
      subtests: +includeSubtests,
    };
    this.setState({ loading: true });

    if (!relatedTestsMode) {
      params.platform = platform;
      const updates = await getSeriesData(
        params,
        errorMessages,
        repositoryName,
        testData,
      );
      this.setState(updates);
      return;
    }

    params.framework = relatedSeries.framework_id;
    if (option === 'addRelatedPlatform') {
      this.addRelatedBranches(params, false);
    } else if (option === 'addRelatedConfigs') {
      this.addRelatedConfigs(params);
    } else if (option === 'addRelatedBranches') {
      this.addRelatedBranches(params);
    } else if (option === 'addRelatedApplications') {
      this.addRelatedApplications(params);
    }
  };

  findObject = (list, key, value) => list.find(item => item[key] === value);

  updateFilterText = filterText => {
    const { seriesData } = this.state;
    const filteredData = seriesData.filter(test => {
      // spell out all searchable characteristics
      // into a single encompassing string
      const tags = test.tags.join(' ');
      const textToSearch = `${test.name} ${tags} ${test.application}`;

      return containsText(textToSearch, filterText);
    });
    this.setState({ filteredData, filterText });
  };

  updateSelectedTests = (test, removeTest = false) => {
    let { selectedTests, selectedUnits } = this.state;
    const index = selectedTests.indexOf(test);

    if (index === -1) {
      selectedTests = [...selectedTests, ...[test]];
      selectedUnits = this.extractUniqueUnits(selectedTests);

      this.setState({
        selectedTests,
        selectedUnits,
      });
    } else if (index !== -1 && removeTest) {
      selectedTests.splice(index, 1);
      selectedUnits = this.extractUniqueUnits(selectedTests);

      this.setState({ selectedTests, selectedUnits });
    }
  };

  getFullTestName = test => `${test.projectName} ${test.platform} ${test.name}`;

  getOriginalTestName = test =>
    this.state.relatedTests.length > 0 ? this.getFullTestName(test) : test.name;

  closeModal = () => {
    this.setState(
      {
        relatedTests: [],
        filteredData: [],
        showNoRelatedTests: false,
        filterText: '',
      },
      this.props.toggle,
    );
  };

  submitData = () => {
    const { selectedTests } = this.state;
    const { getTestData } = this.props;

    const displayedTestParams = selectedTests.map(series => ({
      repository_name: series.projectName,
      signature_id: parseInt(series.id, 10),
      framework_id: parseInt(series.frameworkId, 10),
    }));

    getTestData(displayedTestParams);
    this.setState({
      selectedTests: [],
      selectedUnits: new Set(),
      filterText: '',
    });
    this.closeModal();
  };

  selectableTestClassName = test => {
    return this.hasDifferentUnit(test) ? 'bg-warning' : '';
  };

  selectableTestTitle = test => {
    if (this.hasDifferentUnit(test)) {
      return `Warning: ${this.getOriginalTestName(
        test,
      )} has a different measurement unit (${test.measurementUnit}) `;
    }
    return this.getOriginalTestName(test);
  };

  hasDifferentUnit = test => {
    const { plottedUnits } = this.props;
    const { selectedUnits } = this.state;
    const unit = test.measurementUnit;

    const differentThanPlottedUnits =
      plottedUnits.size && !plottedUnits.has(unit);
    const selectedUnitTypesMismatch = selectedUnits.size >= 2;
    const differentThanSelectedUnits =
      selectedUnits.size && !selectedUnits.has(unit);

    return (
      differentThanPlottedUnits ||
      selectedUnitTypesMismatch ||
      differentThanSelectedUnits
    );
  };

  removeSubstring = (subString, fromString) =>
    fromString.includes(subString)
      ? fromString
          .split(subString)
          .join('')
          .trim()
      : fromString;

  extractUniqueUnits(tests) {
    return new Set(tests.map(aTest => aTest.measurementUnit));
  }

  render() {
    const {
      platforms,
      seriesData,
      framework,
      repository_name: repositoryName,
      platform,
      includeSubtests,
      selectedTests,
      filteredData,
      relatedTests,
      showNoRelatedTests,
      filterText,
      loading,
      pinnedProjects,
    } = this.state;
    const { projects, frameworks, showModal } = this.props;
    const projectOptions = this.getDropdownOptions(projects);
    const modalOptions = [
      {
        options: frameworks.length ? frameworks.map(item => item.name) : [],
        selectedItem: framework.name,
        updateData: value =>
          this.setState(
            {
              framework: this.findObject(frameworks, 'name', value),
            },
            this.getPlatforms,
          ),
        title: 'Framework',
      },
      {
        options: projectOptions,
        selectedItem: repositoryName.name || '',
        pinnedProjects: projectOptions.filter(item =>
          pinnedProjects.includes(item),
        ),
        updateData: value =>
          this.setState(
            { repository_name: this.findObject(projects, 'name', value) },
            this.getPlatforms,
          ),
        title: 'Project',
      },
      {
        options: platforms,
        selectedItem: platform,
        updateData: platform =>
          this.setState({ platform }, this.processOptions),
        title: 'Platform',
      },
    ];

    let tests = [];
    if (filterText) {
      tests = filteredData;
    } else if (relatedTests.length || showNoRelatedTests) {
      tests = relatedTests;
    } else if (seriesData.length && !loading) {
      tests = seriesData;
    }

    return (
      <Modal size="lg" isOpen={showModal}>
        <ModalHeader toggle={this.closeModal}>Add Test Data</ModalHeader>
        <ModalBody className="container-fluid test-chooser">
          <Form>
            <Row className="justify-content-start">
              {createDropdowns(modalOptions, 'p-2', true)}
              <Col sm="auto" className="p-2">
                <Button
                  color="darker-info"
                  outline
                  onClick={() =>
                    this.setState(
                      { includeSubtests: !includeSubtests },
                      this.processOptions,
                    )
                  }
                  active={includeSubtests}
                >
                  Include subtests
                </Button>
              </Col>
            </Row>
            <Row className="justify-content-start">
              <Col className="p-2 col-4">
                <InputFilter
                  disabled={relatedTests.length > 0}
                  updateFilterText={this.updateFilterText}
                />
              </Col>
            </Row>
            <Row className="p-2 justify-content-start">
              <Col className="p-0">
                <Label for="exampleSelect">
                  {relatedTests.length > 0 ? 'Related tests' : 'Tests'}
                </Label>
                <Input
                  className="fa"
                  data-testid="tests"
                  type="select"
                  name="selectMulti"
                  id="selectTests"
                  multiple
                >
                  {tests.length > 0 &&
                    tests.sort().map(test => (
                      <option
                        key={test.id}
                        className={this.selectableTestClassName(test)}
                        data-testid={test.id.toString()}
                        onClick={() => this.updateSelectedTests(test)}
                        title={this.selectableTestTitle(test)}
                      >
                        {this.getOriginalTestName(test)}
                      </option>
                    ))}
                </Input>
                {showNoRelatedTests && (
                  <p className="text-info pt-2">No related tests found.</p>
                )}
              </Col>
            </Row>
            <Row className="p-2 justify-content-start">
              <Col className="p-0">
                <Label for="exampleSelect">
                  Selected tests{' '}
                  <span className="small">(click a test to remove it)</span>
                </Label>
                <Input
                  data-testid="selectedTests"
                  type="select"
                  name="selectMulti"
                  id="selectTests"
                  multiple
                >
                  {selectedTests.length > 0 &&
                    selectedTests.map(test => (
                      <option
                        key={test.id}
                        className={this.selectableTestClassName(test)}
                        onClick={() => this.updateSelectedTests(test, true)}
                        title={this.selectableTestTitle(test)}
                      >
                        {this.getFullTestName(test)}
                      </option>
                    ))}
                </Input>
                {selectedTests.length > 6 && (
                  <p className="text-info pt-2">
                    Displaying more than 6 graphs at a time is not supported in
                    the UI.
                  </p>
                )}
              </Col>
            </Row>
            <Row className="p-2">
              <Col className="py-2 px-0 text-right">
                <Button
                  color="darker-info"
                  disabled={!selectedTests.length}
                  onClick={this.submitData}
                  onKeyPress={event => event.preventDefault()}
                >
                  Plot graphs
                </Button>
              </Col>
            </Row>
          </Form>
        </ModalBody>
      </Modal>
    );
  }
}

TestDataModal.propTypes = {
  projects: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  plottedUnits: PropTypes.instanceOf(Set).isRequired,
  timeRange: PropTypes.shape({}).isRequired,
  getTestData: PropTypes.func.isRequired,
  options: PropTypes.shape({
    option: PropTypes.string,
    relatedSeries: PropTypes.shape({}),
  }),
  testData: PropTypes.arrayOf(PropTypes.shape({})),
  frameworks: PropTypes.arrayOf(PropTypes.shape({})),
  showModal: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  getInitialData: PropTypes.func,
  getSeriesData: PropTypes.func,
};

TestDataModal.defaultProps = {
  options: undefined,
  testData: [],
  frameworks: [],
  getInitialData,
  getSeriesData,
};
