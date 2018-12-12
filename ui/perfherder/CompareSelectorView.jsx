import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';
import { Container, Col, Row, Button } from 'reactstrap';

import perf from '../js/perf';
import {
  getApiUrl,
  repoEndpoint,
  getProjectUrl,
  createQueryParams,
  pushEndpoint,
} from '../helpers/url';
import { getData } from '../helpers/http';
import ErrorMessages from '../shared/ErrorMessages';
import {
  compareDefaultTimeRange,
  genericErrorMessage,
  errorMessageClass,
} from '../helpers/constants';
import ErrorBoundary from '../shared/ErrorBoundary';

import SelectorCard from './SelectorCard';

// TODO remove $stateParams and $state after switching to react router
export default class CompareSelectorView extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      projects: [],
      failureStatus: null,
      originalProject: 'mozilla-central',
      newProject: 'try',
      originalRevision: '',
      newRevision: '',
      errorMessages: [],
      disableButton: true,
    };
  }

  async componentDidMount() {
    const { data, failureStatus } = await getData(getApiUrl(repoEndpoint));
    this.setState({ projects: data, failureStatus });
    this.validateQueryParams();
  }

  validateQueryParams = () => {
    const {
      originalProject,
      newProject,
      originalRevision,
      newRevision,
    } = this.props.$stateParams;

    if (originalProject) {
      this.validateProject('originalProject', originalProject);
    }

    if (newProject) {
      this.validateProject('newProject', newProject);
    }

    if (newRevision) {
      this.validateRevision(
        'newRevision',
        newRevision,
        newProject || this.state.newProject,
      );
    }

    if (originalRevision) {
      this.validateRevision(
        'originalRevision',
        originalRevision,
        originalProject || this.state.originalProject,
      );
    }
  };

  validateProject = (projectName, project) => {
    const { projects, errorMessages } = this.state;
    let updates = {};
    const validProject = projects.find(item => item.name === project);

    if (validProject) {
      updates = { [projectName]: project };
    } else {
      updates = {
        errorMessages: [
          ...errorMessages,
          `${projectName} must be a valid project.`,
        ],
      };
    }
    this.setState(updates);
  };

  validateRevision = async (revisionName, revision, project) => {
    const { errorMessages } = this.state;
    let updates = {};

    const url = `${getProjectUrl(pushEndpoint, project)}${createQueryParams({
      revision,
    })}`;
    const { data, failureStatus } = await getData(url);

    if (failureStatus || data.meta.count === 0) {
      updates = {
        errorMessages: [
          ...errorMessages,
          `${revisionName} must be a valid revision.`,
        ],
      };
    } else {
      updates = { [revisionName]: revision };
    }
    this.setState(updates);
  };

  submitData = () => {
    const {
      originalProject,
      newProject,
      originalRevision,
      newRevision,
    } = this.state;
    const { $state } = this.props;

    if (newRevision === '') {
      return this.setState({ errorMessages: ['New revision is required'] });
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
        selectedTimeRange: compareDefaultTimeRange,
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
    } = this.state;
    return (
      <Container
        fluid
        style={{ marginBottom: '5rem', marginTop: '5rem', maxWidth: '1200px' }}
      >
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
                    failureStatus={failureStatus}
                    errorMessages={errorMessages}
                  />
                )}
              </Col>
            </Row>
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
                queryParam={this.props.$stateParams.originalRevision}
              />
              <SelectorCard
                projects={projects}
                updateState={updates => this.setState(updates)}
                selectedRepo={newProject}
                title="New"
                projectState="newProject"
                revisionState="newRevision"
                selectedRevision={newRevision}
              />
            </Row>
            <Row className="justify-content-center">
              <Col sm="8" className="text-right px-1">
                <Button
                  color="info"
                  className="mt-2 mx-auto"
                  onClick={
                    newRevision !== '' && disableButton ? '' : this.submitData
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
