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
  FormGroup,
  Badge,
} from 'reactstrap';
import flatMap from 'lodash/flatMap';

import { createDropdowns } from '../../shared/FilterControls';
import InputFilter from '../../shared/InputFilter';
import { processResponse } from '../../helpers/http';
import PerfSeriesModel from '../../models/perfSeries';
import { thPerformanceBranches } from '../../helpers/constants';
import {
  containsText,
  getInitialData,
  getSeriesData,
  getFrameworkName,
} from '../perf-helpers/helpers';

import TimeRangeDropdown from './TimeRangeDropdown';

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
      activeTags: [],
      availableTags: [],
      innerTimeRange: this.props.timeRange,
    };
  }

  async componentDidMount() {
    const {
      errorMessages,
      framework,
      innerTimeRange,
      repository_name: repositoryName,
    } = this.state;
    const { getInitialData } = this.props;
    const updates = await getInitialData(
      errorMessages,
      repositoryName,
      framework,
      innerTimeRange,
    );
    this.setState(updates, this.processOptions);
  }

  componentDidUpdate(prevProps, prevState) {
    const { activeTags, availableTags, platform, platforms } = this.state;
    const { testData, timeRange, showModal } = this.props;

    if (prevState.platforms !== platforms) {
      const newPlatform = platforms.find((item) => item === platform)
        ? platform
        : platforms[0];

      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ platform: newPlatform });
    }

    if (prevState.availableTags !== availableTags) {
      const newActiveTags = activeTags.filter((tag) =>
        availableTags.includes(tag),
      );
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ activeTags: newActiveTags }, this.applyFilters);
    }

    if (this.props.options !== prevProps.options) {
      this.processOptions(true);
    }

    if (timeRange !== prevProps.timeRange) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ innerTimeRange: timeRange });
    }

    if (testData !== prevProps.testData) {
      this.processOptions();
    }

    if (showModal === true && showModal !== prevProps.showModal) {
      const newFramework = {
        name: getFrameworkName(this.props.frameworks, testData[0].framework_id),
        id: testData[0].framework_id,
      };

      this.setState(
        {
          framework: newFramework,
          platform: testData[0].platform,
          filterText: testData[0].name,
        },
        () => {
          this.processOptions();
        },
      );
    }
  }

  async getPlatforms() {
    const {
      errorMessages,
      framework,
      innerTimeRange,
      repository_name: repositoryName,
    } = this.state;

    const params = { interval: innerTimeRange.value, framework: framework.id };
    const response = await PerfSeriesModel.getPlatformList(
      repositoryName.name,
      params,
    );

    const updates = processResponse(response, 'platforms', errorMessages);
    this.setState(updates);
    this.processOptions();
  }

  getTagOptions(seriesData) {
    const newAvailableTags = flatMap(seriesData, (test) => test.tags);
    return [...new Set(newAvailableTags)];
  }

  getDropdownOptions(options) {
    return options.length ? options.map((item) => item.name) : [];
  }

  addRelatedApplications = async (params) => {
    const { relatedSeries: relatedSignature } = this.props.options;
    const { errorMessages } = this.state;
    let relatedTests = [];

    const { data, failureStatus } = await PerfSeriesModel.getSeriesList(
      relatedSignature.repository_name,
      params,
    );

    if (!failureStatus) {
      relatedTests = data.filter((signature) => {
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

  addRelatedConfigs = async (params) => {
    const { relatedSeries } = this.props.options;
    const { errorMessages, repository_name: repositoryName } = this.state;

    const response = await PerfSeriesModel.getSeriesList(
      repositoryName.name,
      params,
    );
    const updates = processResponse(response, 'relatedTests', errorMessages);

    if (updates.relatedTests.length) {
      const tests = updates.relatedTests.filter(
        (series) =>
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
      (repositoryName) => repositoryName !== relatedSeries.repository_name,
    );

    const requests = relatedProjects.map((projectName) =>
      PerfSeriesModel.getSeriesList(projectName, params),
    );
    const responses = await Promise.all(requests);
    const relatedTests = responses
      // eslint-disable-next-line array-callback-return
      .flatMap((item) => {
        if (!item.failureStatus) {
          return item.data;
        }
        errorMessages.push(item.data);
      })
      .filter(
        (responseSeries) =>
          responseSeries.name.trim() === relatedSeries.name.trim() &&
          (samePlatform
            ? responseSeries.platform === relatedSeries.platform
            : responseSeries.platform !== relatedSeries.platform),
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
      errorMessages,
      filterText,
      framework,
      includeSubtests,
      innerTimeRange,
      platform,
      repository_name: repositoryName,
    } = this.state;
    const { getSeriesData, testData } = this.props;

    const params = {
      interval: innerTimeRange.value,
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
      const { seriesData } = updates;
      const availableTags = this.getTagOptions(seriesData);

      this.setState({ ...updates, availableTags });
      this.applyFilters(filterText);
    } else {
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
      this.applyFilters(filterText);
    }
  };

  findObject = (list, key, value) => list.find((item) => item[key] === value);

  filterTestsByText = (tests, filterText) => {
    return tests.filter((test) => {
      // spell out all searchable characteristics
      // into a single encompassing string
      const textToSearch = `${test.name} ${test.application}`;

      return containsText(textToSearch, filterText);
    });
  };

  applyFilters = (filterText) => {
    const { seriesData, activeTags } = this.state;
    let filteredData = activeTags.length ? [] : [...seriesData];

    if (activeTags.length) {
      filteredData = seriesData.filter((test) =>
        activeTags.every((activeTag) => test.tags.includes(activeTag)),
      );
    }

    if (filterText) {
      filteredData = this.filterTestsByText(filteredData, filterText);
    }

    this.setState({ filteredData, filterText });
  };

  toggleTag = (tag) => {
    const { filterText, activeTags } = this.state;
    let newActiveTags = [...activeTags];

    if (activeTags.includes(tag)) {
      newActiveTags = activeTags.filter((activeTag) => activeTag !== tag);
    } else {
      newActiveTags = activeTags.concat(tag);
    }

    this.setState({ activeTags: newActiveTags }, () => {
      this.applyFilters(filterText);
    });
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

  getFullTestName = (test) =>
    `${test.projectName} ${test.platform} ${test.name} ${
      test.application || ''
    }`;

  getOriginalTestName = (test) =>
    this.state.relatedTests.length > 0
      ? this.getFullTestName(test)
      : `${test.name} ${test.application || ''}`;

  closeModal = () => {
    this.setState(
      {
        relatedTests: [],
        filteredData: [],
        showNoRelatedTests: false,
        filterText: '',
        innerTimeRange: this.props.timeRange,
      },
      this.props.toggle,
    );
  };

  submitData = () => {
    const { selectedTests, innerTimeRange } = this.state;
    const {
      getTestData,
      timeRange: parentTimeRange,
      updateTestsAndTimeRange,
      replicates,
    } = this.props;

    const displayedTestParams = selectedTests.map((series) => ({
      repository_name: series.projectName,
      signature_id: parseInt(series.id, 10),
      framework_id: parseInt(series.frameworkId, 10),
      replicates,
    }));

    this.setState({
      selectedTests: [],
      selectedUnits: new Set(),
      filterText: '',
    });

    if (innerTimeRange.value !== parentTimeRange.value) {
      updateTestsAndTimeRange(displayedTestParams, innerTimeRange);
    } else {
      getTestData(displayedTestParams);
    }
    this.closeModal();
  };

  selectableTestClassName = (test) => {
    return this.hasDifferentUnit(test) ? 'bg-warning' : '';
  };

  selectableTestTitle = (test) => {
    if (this.hasDifferentUnit(test)) {
      return `Warning: ${this.getOriginalTestName(
        test,
      )} has a different measurement unit (${test.measurementUnit}) `;
    }
    return this.getOriginalTestName(test);
  };

  hasDifferentUnit = (test) => {
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
      ? fromString.split(subString).join('').trim()
      : fromString;

  extractUniqueUnits(tests) {
    return new Set(tests.map((aTest) => aTest.measurementUnit));
  }

  render() {
    const {
      activeTags,
      availableTags,
      filterText,
      filteredData,
      framework,
      includeSubtests,
      innerTimeRange,
      loading,
      pinnedProjects,
      platform,
      platforms,
      relatedTests,
      repository_name: repositoryName,
      selectedTests,
      seriesData,
      showNoRelatedTests,
    } = this.state;
    const { frameworks, projects, showModal } = this.props;
    const projectOptions = this.getDropdownOptions(projects);
    const modalOptions = [
      {
        options: frameworks.length ? frameworks.map((item) => item.name) : [],
        selectedItem: framework.name,
        updateData: (value) =>
          this.setState(
            {
              framework: this.findObject(frameworks, 'name', value),
            },
            this.getPlatforms,
          ),
        title: 'Framework',
      },
      {
        options: projectOptions
          .sort()
          .filter((item) => !pinnedProjects.includes(item)),
        selectedItem: repositoryName.name || '',
        pinnedProjects: pinnedProjects.filter((item) =>
          projectOptions.includes(item),
        ),
        updateData: (value) =>
          this.setState(
            { repository_name: this.findObject(projects, 'name', value) },
            this.getPlatforms,
          ),
        title: 'Project',
      },
      {
        options: platforms.sort(),
        selectedItem: platform,
        updateData: (platform) =>
          this.setState({ platform }, this.processOptions),
        title: 'Platform',
      },
    ];

    let tests = [];
    if (filterText || activeTags.length) {
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
              {innerTimeRange && (
                <Col sm="auto" className="p-2">
                  <TimeRangeDropdown
                    timeRangeText={innerTimeRange.text}
                    updateTimeRange={(newTimeRange) =>
                      this.setState(
                        { innerTimeRange: newTimeRange },
                        this.getPlatforms,
                      )
                    }
                  />
                </Col>
              )}
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
                  placeholder="filter tests e.g. linux tp5o"
                  updateFilterText={this.applyFilters}
                  filteredTextValue={filterText ? filterText : ""}
                />
              </Col>
            </Row>
            {availableTags.length > 1 && (
              <>
                <Row className="justify-content-start">
                  <Col className="p-2">
                    <FormGroup>
                      <Label for="selectMultiTags">Tags</Label>
                      <Input
                        className="fa"
                        type="select"
                        name="selectMultiTags"
                        id="selectMultiTags"
                        multiple
                      >
                        {availableTags.sort().map((tag) => (
                          <option
                            key={`available-tag-${tag}`}
                            data-testid={`available-tag ${tag}`}
                            onClick={() => this.toggleTag(tag)}
                          >
                            {tag}
                          </option>
                        ))}
                      </Input>
                    </FormGroup>
                  </Col>
                </Row>
                <Row className="pb-2 justify-content-start">
                  <Col className="p-2" sm="auto">
                    {activeTags.sort().map((tag, index) => (
                      <React.Fragment key={`active-tag-${tag}`}>
                        <Badge
                          id={`active-tag-${index}`}
                          data-testid={`active-tag ${tag}`}
                          className="mr-2 btn btn-darker-secondary"
                          role="button"
                          title="Click to remove tag"
                          pill
                          onClick={() => this.toggleTag(tag)}
                        >
                          {tag} ×
                        </Badge>
                      </React.Fragment>
                    ))}
                  </Col>
                </Row>
              </>
            )}
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
                    tests.sort().map((test) => (
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
                    selectedTests.map((test) => (
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
                  onKeyPress={(event) => event.preventDefault()}
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
  getTestData: PropTypes.func.isRequired,
  plottedUnits: PropTypes.instanceOf(Set).isRequired,
  projects: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  showModal: PropTypes.bool.isRequired,
  timeRange: PropTypes.shape({}).isRequired,
  toggle: PropTypes.func.isRequired,
  updateTestsAndTimeRange: PropTypes.func.isRequired,
  frameworks: PropTypes.arrayOf(PropTypes.shape({})),
  getInitialData: PropTypes.func,
  getSeriesData: PropTypes.func,
  options: PropTypes.shape({
    option: PropTypes.string,
    relatedSeries: PropTypes.shape({}),
  }),
  testData: PropTypes.arrayOf(PropTypes.shape({})),
};

TestDataModal.defaultProps = {
  frameworks: [],
  getInitialData,
  getSeriesData,
  options: undefined,
  testData: [],
};
