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
import InputFilter from '../InputFilter';
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
      errorMessages: [],
      includeSubtests: false,
      seriesData: [],
      relatedTests: [],
      selectedTests: [],
      filteredData: [],
      showNoRelatedTests: false,
      filterText: '',
      loading: true,
    };
  }

  async componentDidMount() {
    const { errorMessages, repository_name, framework } = this.state;
    const { timeRange, getInitialData } = this.props;
    const updates = await getInitialData(
      errorMessages,
      repository_name,
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
    const { repository_name, framework, errorMessages } = this.state;
    const { timeRange } = this.props;

    const params = { interval: timeRange.value, framework: framework.id };
    const response = await PerfSeriesModel.getPlatformList(
      repository_name.name,
      params,
    );

    const updates = processResponse(response, 'platforms', errorMessages);
    this.setState(updates);
    this.processOptions();
  }

  addRelatedConfigs = async params => {
    const { relatedSeries } = this.props.options;
    const { errorMessages, repository_name } = this.state;

    const response = await PerfSeriesModel.getSeriesList(
      repository_name.name,
      params,
    );
    const updates = processResponse(response, 'relatedTests', errorMessages);

    if (updates.relatedTests.length) {
      const tests =
        updates.relatedTests.filter(
          series =>
            series.platform === relatedSeries.platform &&
            series.testName === relatedSeries.test &&
            series.name !== relatedSeries.name,
        ) || [];

      updates.relatedTests = tests;
    }
    updates.showNoRelatedTests = updates.relatedTests.length === 0;
    updates.loading = false;

    this.setState(updates);
  };

  addRelatedPlatforms = async params => {
    const { relatedSeries } = this.props.options;
    const { errorMessages, repository_name } = this.state;

    const response = await PerfSeriesModel.getSeriesList(
      repository_name.name,
      params,
    );
    const updates = processResponse(response, 'relatedTests', errorMessages);

    if (updates.relatedTests.length) {
      const tests =
        updates.relatedTests.filter(
          series =>
            series.platform !== relatedSeries.platform &&
            series.name === relatedSeries.name,
        ) || [];

      updates.relatedTests = tests;
    }
    updates.showNoRelatedTests = updates.relatedTests.length === 0;
    updates.loading = false;

    this.setState(updates);
  };

  addRelatedBranches = async params => {
    const { relatedSeries } = this.props.options;
    const errorMessages = [];

    const relatedProjects = thPerformanceBranches.filter(
      repository_name => repository_name !== relatedSeries.repository_name,
    );
    const requests = relatedProjects.map(projectName =>
      PerfSeriesModel.getSeriesList(projectName, params),
    );

    const responses = await Promise.all(requests);
    // eslint-disable-next-line func-names
    const relatedTests = responses.flatMap(function(item) {
      if (!item.failureStatus) {
        return item.data;
      }
      errorMessages.push(item.data);
    });

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
      repository_name,
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
        repository_name,
        testData,
      );

      this.setState(updates);
      return;
    }

    params.framework = relatedSeries.framework_id;

    if (option === 'addRelatedPlatform') {
      this.addRelatedPlatforms(params);
    } else if (option === 'addRelatedConfigs') {
      this.addRelatedConfigs(params);
    } else if (option === 'addRelatedBranches') {
      params.signature = relatedSeries.signature_hash;
      this.addRelatedBranches(params);
    }
  };

  findObject = (list, key, value) => list.find(item => item[key] === value);

  updateFilterText = filterText => {
    const { seriesData } = this.state;
    const filteredData = seriesData.filter(test =>
      containsText(test.name, filterText),
    );
    this.setState({ filteredData, filterText });
  };

  updateSelectedTests = (test, removeTest = false) => {
    const { selectedTests } = this.state;
    const index = selectedTests.indexOf(test);

    if (index === -1) {
      this.setState({
        selectedTests: [...selectedTests, ...[test]],
      });
    } else if (index !== -1 && removeTest) {
      selectedTests.splice(index, 1);
      this.setState({ selectedTests });
    }
  };

  getFullTestName = test => `${test.projectName} ${test.platform} ${test.name}`;

  getOriginalTestName = test =>
    this.state.relatedTests.length > 0 ? this.getFullTestName(test) : test.name;

  closeModal = () => {
    this.setState(
      { relatedTests: [], filteredData: [], showNoRelatedTests: false },
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
    this.setState({ selectedTests: [] });
    this.closeModal();
  };

  render() {
    const {
      platforms,
      seriesData,
      framework,
      repository_name,
      platform,
      includeSubtests,
      selectedTests,
      filteredData,
      relatedTests,
      showNoRelatedTests,
      filterText,
      loading,
    } = this.state;
    const { projects, frameworks, showModal } = this.props;

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
        options: projects.length ? projects.map(item => item.name) : [],
        selectedItem: repository_name.name || '',
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
                  color="info"
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
                        data-testid={test.id.toString()}
                        onClick={() => this.updateSelectedTests(test)}
                        title={this.getOriginalTestName(test)}
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
                        onClick={() => this.updateSelectedTests(test, true)}
                        title={this.getFullTestName(test)}
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
                  color="info"
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
