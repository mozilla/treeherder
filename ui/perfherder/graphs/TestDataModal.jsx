import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';
import {
  Button,
  Col,
  Form,
  FormGroup,
  Input,
  Label,
  ModalBody,
  Row,
} from 'reactstrap';

import perf from '../../js/perf';
import { createDropdowns } from '../FilterControls';
import InputFilter from '../InputFilter';
import { getData, processResponse } from '../../helpers/http';
import { getApiUrl } from '../../helpers/url';
import { endpoints } from '../constants';
import PerfSeriesModel from '../../models/perfSeries';
import { thPerformanceBranches } from '../../helpers/constants';
import { containsText } from '../helpers';

// TODO remove $stateParams and $state after switching to react router
export class TestDataModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      frameworks: [],
      platforms: [],
      framework: { name: 'talos', id: 1 },
      project: this.findObject(this.props.repos, 'name', 'mozilla-central'),
      platform: this.props.defaultPlatform || 'linux64',
      errorMessages: [],
      includeSubtests: false,
      seriesData: [],
      relatedTests: [],
      selectedTests: [],
      filteredData: [],
      showNoRelatedTests: false,
    };
  }

  // TODO need to utilize default values (defaultFrameworkId), etc and pass as props
  componentDidMount() {
    this.getInitialData();
  }

  componentDidUpdate(prevProps, prevState) {
    const { platforms, platform } = this.state;

    if (prevState.platforms !== platforms) {
      const newPlatform = platforms.find(item => item === platform)
        ? platform
        : platforms[0];
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ platform: newPlatform });
    }
  }

  getInitialData = async () => {
    const { errorMessages, project, framework } = this.state;
    const { timeRange } = this.props;

    const params = { interval: timeRange, framework: framework.id };
    const [frameworks, platforms] = await Promise.all([
      getData(getApiUrl(endpoints.frameworks)),
      PerfSeriesModel.getPlatformList(project.name, params),
    ]);

    const updates = {
      ...processResponse(frameworks, 'frameworks', errorMessages),
      ...processResponse(platforms, 'platforms', errorMessages),
    };

    this.setState(updates, this.processOptions);
  };

  getSeriesData = async params => {
    const { errorMessages, project } = this.state;

    let updates = {
      filteredData: [],
      relatedTests: [],
      showNoRelatedTests: false,
    };
    const response = await PerfSeriesModel.getSeriesList(project.name, params);
    updates = {
      ...updates,
      ...processResponse(response, 'seriesData', errorMessages),
    };
    this.setState(updates);
  };

  async getPlatforms() {
    const { project, framework, errorMessages } = this.state;
    const { timeRange } = this.props;

    const params = { interval: timeRange, framework: framework.id };
    const response = await PerfSeriesModel.getPlatformList(
      project.name,
      params,
    );

    const updates = processResponse(response, 'platforms', errorMessages);
    this.setState(updates);
  }

  addRelatedConfigs = async params => {
    const { relatedSeries } = this.props.options;
    const { errorMessages, project } = this.state;

    const response = await PerfSeriesModel.getSeriesList(project.name, params);
    const updates = processResponse(response, 'relatedTests', errorMessages);

    if (updates.relatedTests.length) {
      const tests =
        updates.relatedTests.filter(
          series =>
            series.platform === relatedSeries.platform &&
            series.testName === relatedSeries.testName &&
            series.name !== relatedSeries.name,
        ) || [];

      updates.relatedTests = tests;
    }
    updates.showNoRelatedTests = updates.relatedTests.length === 0;

    this.setState(updates);
  };

  addRelatedPlatforms = async params => {
    const { relatedSeries } = this.props.options;
    const { errorMessages, project } = this.state;

    const response = await PerfSeriesModel.getSeriesList(project.name, params);
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

    this.setState(updates);
  };

  addRelatedBranches = async params => {
    const { relatedSeries } = this.props.options;

    const relatedProjects = thPerformanceBranches.filter(
      project => project !== relatedSeries.projectName,
    );
    const requests = relatedProjects.map(projectName =>
      PerfSeriesModel.getSeriesList(projectName, params),
    );
    // TODO error messages
    const responses = await Promise.all(requests);
    const relatedTests = responses.flatMap(function(item) {
      if (!item.failureStatus) {
        return item.data;
      }
    });

    this.setState({
      relatedTests,
      showNoRelatedTests: relatedTests.length === 0,
    });
  };

  processOptions = () => {
    const { option, relatedSeries } = this.props.options;
    const {
      platform,
      framework,
      includeSubtests,
      relatedTests,
      showNoRelatedTests,
    } = this.state;
    const { timeRange } = this.props;

    const params = {
      interval: timeRange,
      framework: framework.id,
      subtests: +includeSubtests,
    };

    // TODO reset option after it's called the first time
    // so user can press update to use test filter controls
    if (!option || relatedTests.length || showNoRelatedTests) {
      params.platform = platform;
      return this.getSeriesData(params);
    }

    params.framework = relatedSeries.frameworkId;

    if (option === 'addRelatedPlatform') {
      this.addRelatedPlatforms(params);
    } else if (option === 'addRelatedConfigs') {
      this.addRelatedConfigs(params);
    } else if (option === 'addRelatedBranches') {
      params.signature = relatedSeries.signature;
      this.addRelatedBranches(params);
    }
  };

  findObject = (list, key, value) => list.find(item => item[key] === value);

  updateFilterText = filterText => {
    const { seriesData } = this.state;
    const filteredData = seriesData.filter(test =>
      containsText(test.name, filterText),
    );
    this.setState({ filteredData });
  };

  updateSelectedTests = (test, removeTest = false) => {
    const { selectedTests } = this.state;
    const index = selectedTests.indexOf(test);

    if (index === -1) {
      this.setState({
        selectedTests: [...selectedTests, ...[test]],
      });
    } else if (index !== 1 && removeTest) {
      selectedTests.splice(index, 1);
      this.setState({ selectedTests });
    }
  };

  render() {
    const {
      frameworks,
      platforms,
      seriesData,
      framework,
      project,
      platform,
      includeSubtests,
      selectedTests,
      filteredData,
      relatedTests,
      showNoRelatedTests,
    } = this.state;
    const { repos, submitData } = this.props;

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
      },
      {
        options: repos.length ? repos.map(item => item.name) : [],
        selectedItem: project.name || '',
        updateData: value =>
          this.setState(
            { project: this.findObject(repos, 'name', value) },
            this.getPlatforms,
          ),
      },
      {
        options: platforms,
        selectedItem: platform,
        updateData: platform => this.setState({ platform }),
      },
    ];
    let tests = seriesData;
    if (filteredData.length) {
      tests = filteredData;
    } else if (relatedTests.length) {
      tests = relatedTests;
    }

    return (
      <ModalBody className="container-fluid test-chooser">
        <Form>
          <Row className="justify-content-start">
            {createDropdowns(modalOptions, 'p-2', true)}
            <Col sm="auto" className="p-2">
              <Button
                color="info"
                outline
                onClick={() =>
                  this.setState({ includeSubtests: !includeSubtests })
                }
                active={includeSubtests}
              >
                Include subtests
              </Button>
            </Col>
            <Col className="p-2">
              <Button color="secondary" onClick={this.processOptions}>
                Update
              </Button>
            </Col>
          </Row>
          <Row className="justify-content-start">
            <Col className="p-2 col-4">
              <InputFilter
                outline
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
              <Input type="select" name="selectMulti" id="selectTests" multiple>
                {tests.length > 0 &&
                  tests.sort().map(test => (
                    <option
                      key={test.id}
                      onClick={() => this.updateSelectedTests(test)}
                    >
                      {relatedTests.length > 0
                        ? `${test.projectName} ${test.platform} ${test.name}`
                        : test.name}
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
              <Label for="exampleSelect">Selected tests</Label>
              <Input type="select" name="selectMulti" id="selectTests" multiple>
                {selectedTests.length > 0 &&
                  selectedTests.map(test => (
                    <option
                      key={test.id}
                      onClick={() => this.updateSelectedTests(test, true)}
                    >
                      {`${test.projectName} ${test.platform} ${test.name}`}
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
                onClick={() => submitData(selectedTests)}
              >
                Plot graphs
              </Button>
            </Col>
          </Row>
        </Form>
      </ModalBody>
    );
  }
}

TestDataModal.propTypes = {
  $stateParams: PropTypes.shape({}),
  $state: PropTypes.shape({}),
  repos: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  timeRange: PropTypes.number.isRequired,
  defaultPlatform: PropTypes.string,
  submitData: PropTypes.func.isRequired,
  options: PropTypes.shape({
    option: PropTypes.string,
    relatedSeries: PropTypes.shape({}),
  }),
};

TestDataModal.defaultProps = {
  $stateParams: undefined,
  $state: undefined,
  defaultPlatform: undefined,
  options: undefined,
};

perf.component(
  'testDataModal',
  react2angular(
    TestDataModal,
    [
      'repos',
      'seriesList',
      'timeRange',
      'defaultPlatform',
      'submitData',
      'options',
    ],
    ['$stateParams', '$state'],
  ),
);

export default TestDataModal;
