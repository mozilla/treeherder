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
import { thDefaultRepo } from '../../helpers/constants';
import PerfSeriesModel from '../../models/perfSeries';

// TODO remove $stateParams and $state after switching to react router
export class TestDataModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      frameworks: [],
      platforms: [],
      tests: [],
      framework: { name: 'talos', id: 1 },
      project: this.findObject(this.props.repos, 'name', thDefaultRepo),
      platform: this.props.defaultPlatform,
      errorMessages: [],
    };
  }

  // TODO need to utilize default values (defaultFrameworkId), etc and pass as props
  async componentDidMount() {
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

    this.setState(updates);
  }

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

  findObject = (list, key, value) => list.find(item => item[key] === value);

  render() {
    const {
      frameworks,
      platforms,
      tests,
      framework,
      project,
      platform,
    } = this.state;
    const { repos } = this.props;

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
        selectedItem: platform || platforms[0],
        updateData: platform => this.setState({ platform }),
      },
    ];

    return (
      <ModalBody className="container-fluid test-chooser">
        <Form>
          <Row className="justify-content-start">
            {createDropdowns(modalOptions, 'p-2', true)}
          </Row>
          <Row>
            <Col className="px-2 py-3 col-5">
              <InputFilter outline updateFilterText={() => {}} />
            </Col>
          </Row>
          <Row className="p-2 justify-content-start">
            <Col className="p-0">
              <Label for="exampleSelect">Tests</Label>
              <Input type="select" name="selectMulti" id="selectTests" multiple>
                {tests.length > 0 && tests.map(test => <option>{test}</option>)}
              </Input>
            </Col>
          </Row>
          <Row className="p-2 justify-content-center">
            <Col className="text-left px-0">
              <FormGroup check>
                <Label check className="pt-2 font-weight-normal">
                  <Input type="checkbox" id="checkbox2" /> Include subtests
                </Label>
              </FormGroup>
            </Col>
            <Col className="text-right py-2 px-0">
              <Button outline color="secondary">
                Add selected
              </Button>
            </Col>
          </Row>
          {/* TODO add warning if more than 6 tests selected (not supported in UI) */}
          <Row className="p-2 justify-content-start">
            <Col className="p-0">
              <Label for="exampleSelect">Selected tests</Label>
              <Input type="select" name="selectMulti" id="selectTests" multiple>
                {tests.length > 0 && tests.map(test => <option>test</option>)}
              </Input>
            </Col>
          </Row>

          <Row className="pr-2">
            <Col className="p-0 text-right">
              <Button color="secondary" outline className="inline-block m-3">
                Remove selected
              </Button>
              <Button color="secondary">Plot graphs</Button>
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
  seriesList: PropTypes.arrayOf(PropTypes.shape({})),
  timeRange: PropTypes.number.isRequired,
  defaultPlatform: PropTypes.string,
};

TestDataModal.defaultProps = {
  $stateParams: undefined,
  $state: undefined,
  seriesList: undefined,
  defaultPlatform: undefined,
};

perf.component(
  'testDataModal',
  react2angular(
    TestDataModal,
    ['repos', 'seriesList', 'timeRange', 'defaultPlatform'],
    ['$stateParams', '$state'],
  ),
);

export default TestDataModal;
