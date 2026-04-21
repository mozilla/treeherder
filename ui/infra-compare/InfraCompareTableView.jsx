import { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { useLocation } from 'react-router';
import { Col, Row, Container, Alert } from 'react-bootstrap';

import ErrorMessages from '../shared/ErrorMessages';
import { genericErrorMessage, errorMessageClass } from '../helpers/constants';
import ErrorBoundary from '../shared/ErrorBoundary';
import { getData } from '../helpers/http';
import { createApiUrl } from '../helpers/url';
import LoadingSpinner from '../shared/LoadingSpinner';
import TruncatedText from '../shared/TruncatedText';
import RevisionInformation from '../shared/RevisionInformation';
import ComparePageTitle from '../shared/ComparePageTitle';

import InfraCompareTableControls from './InfraCompareTableControls';
import { compareDefaultTimeRange, endpoints, phTimeRanges } from './constants';

export default function InfraCompareTableView({
  validated = {},
  compareData,
  getQueryParams,
  getDisplayResults,
  jobsNotDisplayed,
  ...otherProps
}) {
  const location = useLocation();
  const prevLocationSearch = useRef(location.search);

  const getInitialTimeRange = () => {
    const { selectedTimeRange, originalRevision } = validated;
    if (originalRevision) {
      return null;
    }
    let timeRange;
    if (selectedTimeRange) {
      timeRange = phTimeRanges.find(
        (tr) => tr.value === parseInt(selectedTimeRange, 10),
      );
    }
    return timeRange || compareDefaultTimeRange;
  };

  const [compareResults, setCompareResults] = useState(new Map());
  const [failureMessages, setFailureMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState(getInitialTimeRange);
  const [tabTitle, setTabTitle] = useState(null);

  const getInfraData = useCallback(async () => {
    const {
      originalProject,
      originalRevision,
      newProject,
      newRevision,
    } = validated;

    setLoading(true);

    const [originalParams, newParams] = getQueryParams(timeRange);
    const [originalResults, newResults] = await Promise.all([
      getData(createApiUrl(endpoints.infra_compare, originalParams)),
      getData(createApiUrl(endpoints.infra_compare, newParams)),
    ]);
    if (originalResults.failureStatus) {
      setFailureMessages((prev) => [originalResults.data, ...prev]);
      setLoading(false);
      return;
    }

    if (newResults.failureStatus) {
      setFailureMessages((prev) => [newResults.data, ...prev]);
      setLoading(false);
      return;
    }

    const data = [...originalResults.data, ...newResults.data];

    if (!data.length) {
      setLoading(false);
      return;
    }

    const tableNames = [
      ...new Set(data.map((item) => item.job_type__name.replace(/-\d+$/, ''))),
    ].sort();

    const text = originalRevision
      ? `${originalRevision} (${originalProject})`
      : originalProject;

    setTabTitle(
      `Comparison between ${text} and ${newRevision} (${newProject})`,
    );

    const updates = getDisplayResults(
      originalResults.data,
      newResults.data,
      tableNames,
    );
    if (updates.compareResults) {
      setCompareResults(updates.compareResults);
    }
    setLoading(false);
  }, [validated, getQueryParams, getDisplayResults, timeRange]);

  // componentDidMount
  useEffect(() => {
    if (
      compareData &&
      compareData.size > 0 &&
      location.pathname === '/infracompare'
    ) {
      setCompareResults(compareData);
    } else {
      getInfraData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // componentDidUpdate - detect location.search changes
  useEffect(() => {
    if (location.search !== prevLocationSearch.current) {
      getInfraData();
    }
    prevLocationSearch.current = location.search;
  }, [location.search, getInfraData]);

  const updateTimeRange = (selection) => {
    const { updateParams } = validated;
    const newTimeRange = phTimeRanges.find((item) => item.text === selection);

    updateParams({ selectedTimeRange: newTimeRange.value });
    setTimeRange(newTimeRange);
  };

  // Re-fetch when timeRange changes (from updateTimeRange)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    getInfraData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  const {
    originalProject,
    newProject,
    originalRevision,
    newRevision,
    originalResultSet,
    newResultSet,
    pageTitle,
  } = validated;

  const compareDropdowns = [];
  const params = {
    originalProject,
    newProject,
    newRevision,
  };

  if (originalRevision) {
    params.originalRevision = originalRevision;
  } else if (timeRange) {
    params.selectedTimeRange = timeRange.value;
  }

  if (!originalRevision) {
    compareDropdowns.push({
      options: phTimeRanges.map((option) => option.text),
      selectedItem: timeRange.text,
      updateData: (tr) => updateTimeRange(tr),
    });
  }

  return (
    <Container fluid className="max-width-default">
      {loading && !failureMessages.length && <LoadingSpinner />}
      <ErrorBoundary
        errorClasses={errorMessageClass}
        message={genericErrorMessage}
      >
        <div className="mx-auto">
          <Row className="justify-content-center">
            <Col sm="8" className="text-center">
              {failureMessages.length !== 0 && (
                <ErrorMessages errorMessages={failureMessages} />
              )}
            </Col>
          </Row>
          {newRevision && newProject && (originalRevision || timeRange) && (
            <Row>
              <Col sm="12" className="text-center pb-1">
                <h1>
                  <ComparePageTitle
                    title="Infra Compare Revisions"
                    pageTitleQueryParam={pageTitle}
                    defaultPageTitle={tabTitle}
                  />
                </h1>
                <RevisionInformation
                  originalProject={originalProject}
                  originalRevision={originalRevision}
                  originalResultSet={originalResultSet}
                  newProject={newProject}
                  newRevision={newRevision}
                  newResultSet={newResultSet}
                  selectedTimeRange={timeRange}
                />
              </Col>
            </Row>
          )}
          {jobsNotDisplayed && jobsNotDisplayed.length > 0 && (
            <Row className="pt-5 justify-content-center">
              <Col small="12" className="px-0 max-width-default">
                <Alert variant="warning">
                  <TruncatedText
                    title="Tests without results: "
                    maxLength={174}
                    text={jobsNotDisplayed.join(', ')}
                  />
                </Alert>
              </Col>
            </Row>
          )}
          <InfraCompareTableControls
            validated={validated}
            compareData={compareData}
            getQueryParams={getQueryParams}
            getDisplayResults={getDisplayResults}
            jobsNotDisplayed={jobsNotDisplayed}
            {...otherProps}
            updateState={(state) => {
              if (state.compareResults) setCompareResults(state.compareResults);
              if (state.loading !== undefined) setLoading(state.loading);
            }}
            compareResults={compareResults}
          />
        </div>
      </ErrorBoundary>
    </Container>
  );
}

InfraCompareTableView.propTypes = {
  validated: PropTypes.shape({
    originalResultSet: PropTypes.shape({}),
    newResultSet: PropTypes.shape({}),
    newRevision: PropTypes.string,
    originalProject: PropTypes.string,
    newProject: PropTypes.string,
    originalRevision: PropTypes.string,
    selectedTimeRange: PropTypes.string,
    updateParams: PropTypes.func.isRequired,
  }),
  getDisplayResults: PropTypes.func.isRequired,
  getQueryParams: PropTypes.func.isRequired,
};
