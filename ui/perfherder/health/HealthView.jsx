import React from 'react';
import PropTypes from 'prop-types';
import { Col, Container, Row } from 'reactstrap';

import withValidation from '../Validation';
import { getFrameworkData } from '../helpers';
import LoadingSpinner from '../../shared/LoadingSpinner';
import {
  errorMessageClass,
  genericErrorMessage,
} from '../../helpers/constants';
import ErrorBoundary from '../../shared/ErrorBoundary';
import { getData } from '../../helpers/http';
import { createApiUrl } from '../../helpers/url';
import ErrorMessages from '../../shared/ErrorMessages';

import HealthTableControls from './HealthTableControls';

class HeathView extends React.PureComponent {
  constructor(props) {
    super(props);
    this.validated = this.props.validated;
    this.state = {
      framework: getFrameworkData(this.props),
      loading: false,
      failureMessages: [],
      projectsMap: false,
      platformsMap: false,
    };
  }

  componentDidMount() {
    this.getHealthData();
  }

  getHealthData = async () => {
    const { projects } = this.props;
    const { framework } = this.state;

    this.setState({ loading: true });

    await this.createPlatformsMap();
    // create projectsMap
    await this.createObjectsMap(projects, 'projectsMap', 'name');

    const updates = await this.getTestSuiteHealthData({
      framework: framework.id,
    });
    this.setState({ ...updates, loading: false });
  };

  createPlatformsMap = async () => {
    const { platforms, updateAppState } = this.props;
    const { failureMessages } = this.state;

    if (platforms.length) {
      // if the platforms were already cached, use those
      this.createObjectsMap(platforms, 'platformsMap', 'platform');
    } else {
      // get the platforms, cache them and create the platformsMap
      getData('api/machineplatforms/').then(({ data, failureStatus }) => {
        if (failureStatus) {
          this.setState({ failureMessages: [data, ...failureMessages] });
        } else {
          updateAppState({ platforms: data });
          this.createObjectsMap(data, 'platformsMap', 'platform');
        }
      });
    }
  };

  getTestSuiteHealthData = async params => {
    const { failureMessages } = this.state;

    const { data, failureStatus } = await getData(
      createApiUrl('performance/validity-dashboard/', params),
    );
    if (failureStatus) {
      return { failureMessages: [data, ...failureMessages] };
    }
    return { results: data };
  };

  createObjectsMap = (objects, state, propertyName) => {
    const objectsMap = objects.reduce((result, currentObject) => {
      result[currentObject.id] = currentObject[propertyName];
      return result;
    }, {});

    this.setState({ [state]: objectsMap });
  };

  updateFramework = selection => {
    const { updateParams } = this.props.validated;
    const { frameworks } = this.props;
    const framework = frameworks.find(item => item.name === selection);

    updateParams({ framework: framework.id });
    this.setState({ framework }, () => this.getHealthData());
  };

  render() {
    const { frameworks } = this.props;
    const {
      framework,
      results,
      loading,
      failureMessages,
      projectsMap,
      platformsMap,
    } = this.state;

    const frameworkNames =
      frameworks && frameworks.length ? frameworks.map(item => item.name) : [];

    const healthDropdows = [
      {
        options: frameworkNames,
        selectedItem: framework.name,
        updateData: this.updateFramework,
      },
    ];

    return (
      <ErrorBoundary
        errorClasses={errorMessageClass}
        message={genericErrorMessage}
      >
        <Container fluid className="max-width-default">
          {loading && !failureMessages.length && <LoadingSpinner />}
          <Row className="justify-content-center">
            <Col sm="8" className="text-center">
              {failureMessages.length !== 0 && (
                <ErrorMessages errorMessages={failureMessages} />
              )}
            </Col>
          </Row>
          <Row>
            <Col sm="12" className="text-center pb-1">
              <h1>Perfherder Health</h1>
            </Col>
          </Row>
          <HealthTableControls
            healthResults={results}
            dropdownOptions={healthDropdows}
            projectsMap={projectsMap}
            platformsMap={platformsMap}
          />
        </Container>
      </ErrorBoundary>
    );
  }
}

HeathView.propTypes = {
  location: PropTypes.shape({}),
  validated: PropTypes.shape({
    projects: PropTypes.arrayOf(PropTypes.shape({})),
    frameworks: PropTypes.arrayOf(PropTypes.shape({})),
    updateParams: PropTypes.func.isRequired,
    framework: PropTypes.string,
  }).isRequired,
  frameworks: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  projects: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  platforms: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  updateAppState: PropTypes.func.isRequired,
};

HeathView.defaultProps = {
  location: null,
};

export default withValidation(
  { requiredParams: new Set([]) },
  false,
)(HeathView);
