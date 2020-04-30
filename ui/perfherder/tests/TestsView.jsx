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
import { endpoints } from '../constants';
import ErrorBoundary from '../../shared/ErrorBoundary';
import { getData, processResponse } from '../../helpers/http';
import { createApiUrl, platformsEndpoint } from '../../helpers/url';
import ErrorMessages from '../../shared/ErrorMessages';

import TestsTableControls from './TestsTableControls';

class TestsView extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      framework: getFrameworkData(this.props),
      loading: false,
      errorMessages: [],
      projectsMap: false,
      platformsMap: false,
    };
  }

  componentDidMount() {
    this.getTestsOverviewData();
  }

  getTestsOverviewData = async () => {
    const { projects } = this.props;
    const { framework } = this.state;

    this.setState({ loading: true });

    await this.createPlatformsMap();
    // create projectsMap
    await this.createObjectsMap(projects, 'projectsMap', 'name');

    const updates = await this.fetchTestSuiteData({
      framework: framework.id,
    });
    this.setState({ ...updates, loading: false });
  };

  createPlatformsMap = async () => {
    const { platforms, updateAppState } = this.props;
    const { errorMessages } = this.state;

    if (platforms.length) {
      // if the platforms were already cached, use those
      this.createObjectsMap(platforms, 'platformsMap', 'platform');
    } else {
      // get the platforms, cache them and create the platformsMap
      getData(createApiUrl(platformsEndpoint)).then(
        ({ data, failureStatus }) => {
          if (failureStatus) {
            this.setState({ errorMessages: [data, ...errorMessages] });
          } else {
            updateAppState({ platforms: data });
            this.createObjectsMap(data, 'platformsMap', 'platform');
          }
        },
      );
    }
  };

  fetchTestSuiteData = async (params) => {
    const { errorMessages } = this.state;

    const response = await getData(
      createApiUrl(endpoints.validityDashboard, params),
    );

    return processResponse(response, 'results', errorMessages);
  };

  createObjectsMap = (objects, state, propertyName) => {
    const objectsMap = objects.reduce((result, currentObject) => {
      result[currentObject.id] = currentObject[propertyName];
      return result;
    }, {});

    this.setState({ [state]: objectsMap });
  };

  updateFramework = (selection) => {
    const { updateParams } = this.props.validated;
    const { frameworks } = this.props;
    const framework = frameworks.find((item) => item.name === selection);

    updateParams({ framework: framework.id });
    this.setState({ framework }, () => this.getTestsOverviewData());
  };

  render() {
    const { frameworks } = this.props;
    const {
      framework,
      results,
      loading,
      errorMessages,
      projectsMap,
      platformsMap,
    } = this.state;

    const frameworkNames =
      frameworks && frameworks.length
        ? frameworks.map((item) => item.name)
        : [];

    const dropdowns = [
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
          {loading && !errorMessages.length && <LoadingSpinner />}
          <Row className="justify-content-center">
            <Col sm="8" className="text-center">
              {errorMessages.length !== 0 && (
                <ErrorMessages errorMessages={errorMessages} />
              )}
            </Col>
          </Row>
          <Row>
            <Col sm="12" className="text-center pb-1">
              <h1>Perfherder Tests</h1>
            </Col>
          </Row>
          <TestsTableControls
            testsOverviewResults={results}
            dropdownOptions={dropdowns}
            projectsMap={projectsMap}
            platformsMap={platformsMap}
          />
        </Container>
      </ErrorBoundary>
    );
  }
}

TestsView.propTypes = {
  location: PropTypes.shape({}),
  validated: PropTypes.shape({
    updateParams: PropTypes.func.isRequired,
    framework: PropTypes.string,
  }).isRequired,
  frameworks: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  projects: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  platforms: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  updateAppState: PropTypes.func.isRequired,
};

TestsView.defaultProps = {
  location: null,
};

export default withValidation(
  { requiredParams: new Set([]) },
  false,
)(TestsView);
