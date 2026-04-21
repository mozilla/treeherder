import { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { useLocation } from 'react-router';
import { Col, Container, Row } from 'react-bootstrap';

import withValidation from '../Validation';
import { getFrameworkData } from '../perf-helpers/helpers';
import LoadingSpinner from '../../shared/LoadingSpinner';
import {
  errorMessageClass,
  genericErrorMessage,
} from '../../helpers/constants';
import { endpoints } from '../perf-helpers/constants';
import ErrorBoundary from '../../shared/ErrorBoundary';
import { getData, processResponse } from '../../helpers/http';
import { createApiUrl, platformsEndpoint } from '../../helpers/url';
import ErrorMessages from '../../shared/ErrorMessages';

import TestsTableControls from './TestsTableControls';

function TestsView({
  validated,
  frameworks,
  projects,
  platforms,
  updateAppState,
}) {
  const location = useLocation();
  const [framework, setFramework] = useState(() =>
    getFrameworkData({ validated, frameworks }),
  );
  const [loading, setLoading] = useState(false);
  const [errorMessages, setErrorMessages] = useState([]);
  const [projectsMap, setProjectsMap] = useState(false);
  const [platformsMap, setPlatformsMap] = useState(false);
  const [results, setResults] = useState(undefined);

  const prevLocationSearch = useRef(location.search);

  const createObjectsMap = useCallback((objects, propertyName) => {
    return objects.reduce((result, currentObject) => {
      result[currentObject.id] = currentObject[propertyName];
      return result;
    }, {});
  }, []);

  const fetchTestSuiteData = useCallback(
    async (params) => {
      const response = await getData(
        createApiUrl(endpoints.validityDashboard, params),
      );
      return processResponse(response, 'results', errorMessages);
    },
    [errorMessages],
  );

  const createPlatformsMap = useCallback(async () => {
    if (platforms.length) {
      return createObjectsMap(platforms, 'platform');
    }

    const { data, failureStatus } = await getData(
      createApiUrl(platformsEndpoint),
    );
    if (failureStatus) {
      setErrorMessages((prev) => [data, ...prev]);
      return null;
    }
    updateAppState({ platforms: data });
    return createObjectsMap(data, 'platform');
  }, [platforms, updateAppState, createObjectsMap]);

  const getTestsOverviewData = useCallback(
    async (currentFramework) => {
      setLoading(true);

      const newPlatformsMap = await createPlatformsMap();
      if (newPlatformsMap) {
        setPlatformsMap(newPlatformsMap);
      }

      const newProjectsMap = createObjectsMap(projects, 'name');
      setProjectsMap(newProjectsMap);

      const updates = await fetchTestSuiteData({
        framework: currentFramework.id,
      });
      if (updates.results !== undefined) {
        setResults(updates.results);
      }
      if (updates.errorMessages) {
        setErrorMessages(updates.errorMessages);
      }
      setLoading(false);
    },
    [createPlatformsMap, createObjectsMap, projects, fetchTestSuiteData],
  );

  // componentDidMount
  useEffect(() => {
    getTestsOverviewData(framework);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // componentDidUpdate - detect location.search changes
  useEffect(() => {
    if (
      location.search !== prevLocationSearch.current &&
      framework !== null &&
      projectsMap !== false &&
      platformsMap !== false &&
      location.search === ''
    ) {
      const defaultFramework = { id: 1, name: 'talos' };
      setFramework(defaultFramework);
      setProjectsMap(false);
      setPlatformsMap(false);
      setLoading(false);
      setResults([]);
      getTestsOverviewData(defaultFramework);
    }
    prevLocationSearch.current = location.search;
  }, [location.search, framework, projectsMap, platformsMap, getTestsOverviewData]);

  const updateFramework = (selection) => {
    const { updateParams } = validated;
    const newFramework = frameworks.find((item) => item.name === selection);

    updateParams({ framework: newFramework.id });
    setFramework(newFramework);
    getTestsOverviewData(newFramework);
  };

  const frameworkNames = frameworks?.length
    ? frameworks.map((item) => item.name)
    : [];

  const dropdowns = [
    {
      options: frameworkNames,
      selectedItem: framework.name,
      updateData: updateFramework,
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
          allFrameworks={frameworks}
        />
      </Container>
    </ErrorBoundary>
  );
}

TestsView.propTypes = {
  validated: PropTypes.shape({
    updateParams: PropTypes.func.isRequired,
    framework: PropTypes.string,
  }).isRequired,
  frameworks: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  projects: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  platforms: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  updateAppState: PropTypes.func.isRequired,
};

export default withValidation(
  { requiredParams: new Set([]) },
  false,
)(TestsView);
