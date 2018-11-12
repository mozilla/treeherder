import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular';
import { Container, Col, Row, Button } from 'reactstrap';

import perf from '../js/perf';
import { getApiUrl, repoEndpoint } from '../helpers/url';
import { getData } from '../helpers/http';
import ErrorMessages from '../intermittent-failures/ErrorMessages';

import SelectorCard from './SelectorCard';
import { compareDefaultTimeRange } from '../helpers/constants';
import { prettyErrorMessages, errorMessageClass } from '../intermittent-failures/constants';
import ErrorBoundary from '../shared/ErrorBoundary';

// TODO:
// error messages based on failureStatus for SelectorCard
// remove controller and partial (also from perfapp)
// validate query params (new and original revisions)
export default class CompareSelectorView extends React.Component {
  constructor(props) {
    super(props);

    // TODO remove $stateParams and $state after switching to react router
    this.default = this.props.$stateParams;

    this.state = {
      projects: [],
      failureStatus: null,
      originalProject: this.default.originalProject || 'mozilla-central',
      newProject: this.default.newProject || 'try',
      originalRevision: this.default.originalRevision || '',
      newRevision: this.default.newRevision || '',
      errorMessages: [],
      disableButton: true,
    };
    this.updateState = this.updateState.bind(this);
    this.submitData = this.submitData.bind(this);
  }

  async componentDidMount() {
    const { data, failureMessage } = await getData(getApiUrl(repoEndpoint));
    this.updateState({ projects: data, failureMessage });
  }

  updateState(state) {
    this.setState(state);
  }

  submitData() {
    const { originalProject, newProject, originalRevision, newRevision } = this.state;
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
  }

  render() {
    const { originalProject, newProject, projects, originalRevision, newRevision, data, failureStatus, errorMessages, disableButton } = this.state;
    return (
      <Container fluid style={{ marginBottom: '5rem', marginTop: '5rem', maxWidth: '1200px' }}>
        <div className="mx-auto">
          <ErrorBoundary
            errorClasses={errorMessageClass}
            message={prettyErrorMessages.default}
          >
            <Row className="justify-content-center">
              <Col sm="8" className="text-center">
                {(failureStatus || errorMessages.length > 0) &&
                  <ErrorMessages
                    failureMessage={data}
                    failureStatus={failureStatus}
                    errorMessages={errorMessages}
                  />}
              </Col>
            </Row>
            <Row className="justify-content-center">
              <SelectorCard
                projects={projects}
                updateState={this.updateState}
                selectedRepo={originalProject}
                title="Base"
                checkbox
                text="By default, Perfherder will compare against performance data gathered over the last 2 days from when new revision was pushed"
                projectState="originalProject"
                revisionState="originalRevision"
                selectedRevision={originalRevision}
              />
              <SelectorCard
                projects={projects}
                updateState={this.updateState}
                selectedRepo={newProject}
                title="New"
                projectState="newProject"
                revisionState="newRevision"
                selectedRevision={newRevision}
              />
            </Row>
            <Row className="justify-content-center">
              <Col sm="8" className="text-right px-1">
                <Button color="info" className="mt-2 mx-auto" onClick={newRevision !== '' && disableButton ? '' : this.submitData}>
                  Compare
                </Button>
              </Col>
            </Row>
          </ErrorBoundary>
        </div>
      </Container>
    );
  }
}

CompareSelectorView.propTypes = {
  $stateParams: PropTypes.shape({}).isRequired,
  $state: PropTypes.shape({}).isRequired,
};

perf.component('compareSelectorView', react2angular(CompareSelectorView, [], ['$stateParams', '$state']));
