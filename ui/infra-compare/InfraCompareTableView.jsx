import React from 'react';
import PropTypes from 'prop-types';
import { Col, Row, Container } from 'reactstrap';

import ErrorMessages from '../shared/ErrorMessages';
import { genericErrorMessage, errorMessageClass } from '../helpers/constants';
import ErrorBoundary from '../shared/ErrorBoundary';
import { getData } from '../helpers/http';
import { createApiUrl } from '../helpers/url';
import LoadingSpinner from '../shared/LoadingSpinner';
import RevisionInformation from '../shared/RevisionInformation';
import ComparePageTitle from '../shared/ComparePageTitle';

import InfraCompareTableControls from './InfraCompareTableControls';
import { compareDefaultTimeRange, endpoints, phTimeRanges } from './constants';

export default class InfraCompareTableView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      compareResults: new Map(),
      failureMessages: [],
      loading: false,
      timeRange: this.setTimeRange(),
      tabTitle: null,
    };
  }

  componentDidMount() {
    const { compareData, location } = this.props;

    if (
      compareData &&
      compareData.size > 0 &&
      location.pathname === '/infracompare'
    ) {
      this.setState({ compareResults: compareData });
    } else {
      this.getInfraData();
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.location.search !== prevProps.location.search) {
      this.getInfraData();
    }
  }

  setTimeRange = () => {
    const { selectedTimeRange, originalRevision } = this.props.validated;

    if (originalRevision) {
      return null;
    }

    let timeRange;
    if (selectedTimeRange) {
      timeRange = phTimeRanges.find(
        (timeRange) => timeRange.value === parseInt(selectedTimeRange, 10),
      );
    }

    return timeRange || compareDefaultTimeRange;
  };

  getInfraData = async () => {
    const { getQueryParams, getDisplayResults } = this.props;
    const {
      originalProject,
      originalRevision,
      newProject,
      newRevision,
    } = this.props.validated;
    const { timeRange, failureMessages } = this.state;

    this.setState({ loading: true });

    const [originalParams, newParams] = getQueryParams(timeRange);
    const [originalResults, newResults] = await Promise.all([
      getData(createApiUrl(endpoints.infra_compare, originalParams)),
      getData(createApiUrl(endpoints.infra_compare, newParams)),
    ]);
    if (originalResults.failureStatus) {
      return this.setState({
        failureMessages: [originalResults.data, ...failureMessages],
        loading: false,
      });
    }

    if (newResults.failureStatus) {
      return this.setState({
        failureMessages: [newResults.data, ...failureMessages],
        loading: false,
      });
    }

    const data = [...originalResults.data, ...newResults.data];
    let title;

    if (!data.length) {
      return this.setState({ loading: false });
    }

    const tableNames = [
      ...new Set(data.map((item) => item.job_type__name)),
    ].sort();

    const text = originalRevision
      ? `${originalRevision} (${originalProject})`
      : originalProject;

    this.setState({
      tabTitle:
        title ||
        `Comparison between ${text} and ${newRevision} (${newProject})`,
    });
    const updates = getDisplayResults(
      originalResults.data,
      newResults.data,
      tableNames,
    );
    updates.title = title;
    return this.setState(updates);
  };

  updateTimeRange = (selection) => {
    const { updateParams } = this.props.validated;
    const timeRange = phTimeRanges.find((item) => item.text === selection);

    updateParams({ selectedTimeRange: timeRange.value });
    this.setState({ timeRange }, () => this.getInfraData());
  };

  render() {
    const {
      originalProject,
      newProject,
      originalRevision,
      newRevision,
      originalResultSet,
      newResultSet,
      pageTitle,
    } = this.props.validated;

    const { projects } = this.props;
    const {
      compareResults,
      loading,
      failureMessages,
      timeRange,
      tabTitle,
    } = this.state;

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
        updateData: (timeRange) => this.updateTimeRange(timeRange),
      });
    }

    return (
      <Container fluid className="max-width-default">
        {loading && !failureMessages.length && <LoadingSpinner />}
        <ErrorBoundary
          errorClasses={errorMessageClass}
          message={genericErrorMessage}
        >
          <React.Fragment>
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

              <InfraCompareTableControls
                {...this.props}
                dropdownOptions={compareDropdowns}
                updateState={(state) => this.setState(state)}
                compareResults={compareResults}
                isBaseAggregate={!originalRevision}
                projects={projects}
              />
            </div>
          </React.Fragment>
        </ErrorBoundary>
      </Container>
    );
  }
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
  user: PropTypes.shape({}).isRequired,
  dateRangeOptions: PropTypes.oneOfType([PropTypes.shape({}), PropTypes.bool]),
  getDisplayResults: PropTypes.func.isRequired,
  getQueryParams: PropTypes.func.isRequired,
  projects: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  hasSubtests: PropTypes.bool,
};

InfraCompareTableView.defaultProps = {
  dateRangeOptions: null,
  validated: PropTypes.shape({}),
  hasSubtests: false,
};
