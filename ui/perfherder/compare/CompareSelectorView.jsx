import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';
import {
  Container,
  Col,
  Row,
  Button,
  ButtonGroup,
  ButtonDropdown,
  DropdownToggle,
} from 'reactstrap';

import perf from '../../js/perf';
import { getApiUrl, repoEndpoint } from '../../helpers/url';
import { endpoints } from '../constants';
import { getData, processResponse } from '../../helpers/http';
import ErrorMessages from '../../shared/ErrorMessages';
import DropdownMenuItems from '../../shared/DropdownMenuItems';
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
    this.queryParams = this.props.$stateParams;
    this.state = {
      projects: [],
      originalProject: this.queryParams.originalProject || 'mozilla-central',
      newProject: this.queryParams.newProject || 'try',
      originalRevision: this.queryParams.originalRevision || '',
      newRevision: this.queryParams.newRevision || '',
      errorMessages: [],
      disableButton: true,
      missingRevision: false,
      framework: 1,
      frameworkName: 'talos',
      frameworks: [],
      frameworkDropdownIsOpen: false,
    };
  }

  async componentDidMount() {
    const { errorMessages } = this.state;

    const [projects, frameworks] = await Promise.all([
      getData(getApiUrl(repoEndpoint)),
      getData(getApiUrl(endpoints.frameworks)),
    ]);

    const updates = {
      ...processResponse(projects, 'projects', errorMessages),
      ...processResponse(frameworks, 'frameworks', errorMessages),
    };

    this.setState(updates);
  }

  updateFramework = selection => {
    this.setState(prevState => {
      const selectedFramework = prevState.frameworks.find(
        framework => framework.name === selection,
      );

      return {
        framework: selectedFramework.id,
        frameworkName: selectedFramework.name,
      };
    });
  };

  submitData = () => {
    const {
      originalProject,
      newProject,
      originalRevision,
      newRevision,
      framework,
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
        framework,
      });
    } else {
      $state.go('compare', {
        originalProject,
        newProject,
        newRevision,
        framework,
        selectedTimeRange: compareDefaultTimeRange.value,
      });
    }
  };

  toggleFrameworkDropdown = () => {
    this.setState(prevState => ({
      frameworkDropdownIsOpen: !prevState.frameworkDropdownIsOpen,
    }));
  };

  render() {
    const {
      originalProject,
      newProject,
      projects,
      frameworkName,
      frameworks,
      originalRevision,
      newRevision,
      errorMessages,
      disableButton,
      missingRevision,
      frameworkDropdownIsOpen,
    } = this.state;

    const frameworkNames = frameworks.length
      ? frameworks.map(item => item.name)
      : [];
    return (
      <Container fluid className="my-5 pt-5 max-width-default">
        <ErrorBoundary
          errorClasses={errorMessageClass}
          message={genericErrorMessage}
        >
          <div className="mx-auto">
            <Row className="justify-content-center">
              <Col sm="8" className="text-center">
                {errorMessages.length > 0 && (
                  <ErrorMessages errorMessages={errorMessages} />
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
                  queryParam={this.props.$stateParams.originalRevision}
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
                <ButtonGroup>
                  <ButtonDropdown
                    isOpen={frameworkDropdownIsOpen}
                    toggle={this.toggleFrameworkDropdown}
                  >
                    <DropdownToggle caret>{frameworkName}</DropdownToggle>
                    <DropdownMenuItems
                      options={frameworkNames}
                      selectedItem={frameworkName}
                      updateData={this.updateFramework}
                    />
                  </ButtonDropdown>
                  <Button
                    color="info"
                    onClick={
                      newRevision !== '' && disableButton
                        ? null
                        : this.submitData
                    }
                  >
                    Compare
                  </Button>
                </ButtonGroup>
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
