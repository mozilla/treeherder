import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';
import { Container, Col, Row, Button } from 'reactstrap';

import perf from '../../js/perf';
import { getApiUrl, repoEndpoint } from '../../helpers/url';
import { getData } from '../../helpers/http';
import ErrorMessages from '../../shared/ErrorMessages';
import {
  compareDefaultTimeRange,
  genericErrorMessage,
  errorMessageClass,
} from '../../helpers/constants';
import ErrorBoundary from '../../shared/ErrorBoundary';

import SelectorCard from './SelectorCard';

// TODO remove $stateParams and $state after switching to react router
export default class CompareSelectorView extends React.Component {
  constructor(props) {
    super(props);
    const { $stateParams } = this.props;
    this.queryParams = $stateParams;
    this.state = {
      projects: [],
      failureStatus: null,
      originalProject: this.queryParams.originalProject || 'mozilla-central',
      newProject: this.queryParams.newProject || 'try',
      originalRevision: this.queryParams.originalRevision || '',
      newRevision: this.queryParams.newRevision || '',
      errorMessages: [],
      disableButton: true,
      missingRevision: false,
    };
  }

  async componentDidMount() {
    const { data, failureStatus } = await getData(getApiUrl(repoEndpoint));
    this.setState({ projects: data, failureStatus });
  }

  submitData = () => {
    const {
      originalProject,
      newProject,
      originalRevision,
      newRevision,
    } = this.state;
    const { $state } = this.props;

    if (newRevision === '') {
      return this.setState({ missingRevision: 'Revision is required' });
    }

    if (originalRevision !== '') {
      $state.go('compare', {
        originalProject,
        originalRevision,
        newProject,
        newRevision,
      });
    } else {
      $state.go('compare', {
        originalProject,
        newProject,
        newRevision,
        selectedTimeRange: compareDefaultTimeRange.value,
      });
    }
  };

  render() {
    const {
      originalProject,
      newProject,
      projects,
      originalRevision,
      newRevision,
      data,
      failureStatus,
      errorMessages,
      disableButton,
      missingRevision,
    } = this.state;
    const { $stateParams } = this.props;

    return (
      <Container fluid className="my-5 pt-5 max-width-default">
        <ErrorBoundary
          errorClasses={errorMessageClass}
          message={genericErrorMessage}
        >
          <div className="mx-auto">
            <Row className="justify-content-center">
              <Col sm="8" className="text-center">
                {(failureStatus || errorMessages.length > 0) && (
                  <ErrorMessages
                    failureMessage={data}
                    errorMessages={errorMessages}
                  />
                )}
              </Col>
            </Row>
            {projects.length > 0 && (
              <Row className="justify-content-center">
                <SelectorCard
                  projects={projects}
                  updateState={updates => this.setState(updates)}
                  selectedRepo={originalProject}
                  title="Base"
                  checkbox
                  text="By default, Perfherder will compare against performance data gathered over the last 2 days from when new revision was pushed"
                  projectState="originalProject"
                  revisionState="originalRevision"
                  selectedRevision={originalRevision}
                  queryParam={$stateParams.originalRevision}
                  errorMessages={errorMessages}
                />
                <SelectorCard
                  projects={projects}
                  updateState={updates => this.setState(updates)}
                  selectedRepo={newProject}
                  title="New"
                  projectState="newProject"
                  revisionState="newRevision"
                  selectedRevision={newRevision}
                  errorMessages={errorMessages}
                  missingRevision={missingRevision}
                />
              </Row>
            )}
            <Row className="justify-content-center">
              <Col sm="8" className="text-right px-1">
                <Button
                  color="info"
                  className="mt-2 mx-auto"
                  onClick={
                    newRevision !== '' && disableButton ? null : this.submitData
                  }
                >
                  Compare
                </Button>
              </Col>
            </Row>
          </div>
        </ErrorBoundary>
      </Container>
    );
  }
}

CompareSelectorView.propTypes = {
  $stateParams: PropTypes.shape({
    newRevision: PropTypes.string,
    originalRevision: PropTypes.string,
    newProject: PropTypes.string,
    originalProject: PropTypes.string,
  }).isRequired,
  $state: PropTypes.shape({}).isRequired,
};

perf.component(
  'compareSelectorView',
  react2angular(CompareSelectorView, [], ['$stateParams', '$state']),
);
