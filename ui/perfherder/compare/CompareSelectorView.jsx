import React from 'react';
import {
  Container,
  Col,
  Row,
  Button,
  ButtonGroup,
  Dropdown,
  Alert,
} from 'react-bootstrap';

import { parseQueryParams, createQueryParams } from '../../helpers/url';
import ErrorMessages from '../../shared/ErrorMessages';
import DropdownMenuItems from '../../shared/DropdownMenuItems';
import {
  genericErrorMessage,
  errorMessageClass,
} from '../../helpers/constants';
import { compareDefaultTimeRange } from '../perf-helpers/constants';
import ErrorBoundary from '../../shared/ErrorBoundary';

import SelectorCard from './SelectorCard';

export default class CompareSelectorView extends React.Component {
  constructor(props) {
    super(props);
    this.queryParams = parseQueryParams(this.props.location.search);
    this.state = {
      originalProject: this.queryParams.originalProject || 'try',
      newProject: this.queryParams.newProject || 'try',
      originalRevision: this.queryParams.originalRevision || '',
      newRevision: this.queryParams.newRevision || '',
      errorMessages: [],
      disableButton: true,
      missingRevision: false,
      framework: 1,
      frameworkName: 'talos',
      frameworks: [...this.props.frameworks, { id: 0, name: 'infra' }],
    };
  }

  updateFramework = (selection) => {
    const { frameworks } = this.state;
    const selectedFramework = frameworks.find(
      (framework) => framework.name === selection,
    );

    this.setState({
      framework: selectedFramework.id,
      frameworkName: selectedFramework.name,
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
    const { history } = this.props;
    let params;

    if (newRevision === '') {
      return this.setState({ missingRevision: 'Revision is required' });
    }

    if (originalRevision !== '') {
      params = {
        originalProject,
        originalRevision,
        newProject,
        newRevision,
        framework,
      };
    } else {
      params = {
        originalProject,
        newProject,
        newRevision,
        framework,
        selectedTimeRange: compareDefaultTimeRange.value,
      };
    }
    if (framework === 0) {
      history.push(`./infracompare${createQueryParams(params)}`);
    } else {
      history.push(`./compare${createQueryParams(params)}`);
    }
  };

  render() {
    const {
      originalProject,
      newProject,
      frameworkName,
      originalRevision,
      newRevision,
      errorMessages,
      disableButton,
      missingRevision,
      frameworks,
    } = this.state;

    const { projects } = this.props;
    const frameworkNames = frameworks.length
      ? frameworks.map((item) => item.name)
      : [];
    const showWarning =
      (this.state.originalProject === 'mozilla-central' &&
        this.state.newProject === 'try') ||
      (this.state.originalProject === 'try' &&
        this.state.newProject === 'mozilla-central');

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
            <Row className="justify-content-center">
              <Col sm="auto">
                <Alert variant="info">
                  Compare View will be deprecated soon. Please consider using{' '}
                  <a href="https://perf.compare/">PerfCompare</a> as an
                  alternative.
                </Alert>
              </Col>
            </Row>
            <Row className="justify-content-center">
              {showWarning && (
                <Alert variant="warning">
                  It is not recommended to compare a <b>try</b> build against a{' '}
                  <b>mozilla-central</b> build, unless it is based on latest
                  mozilla-central.
                </Alert>
              )}
            </Row>
            <Row className="justify-content-center">
              <SelectorCard
                projects={projects}
                updateState={(updates) => this.setState(updates)}
                selectedRepo={originalProject}
                title="Base"
                projectState="originalProject"
                revisionState="originalRevision"
                selectedRevision={originalRevision}
                errorMessages={errorMessages}
              />
              <SelectorCard
                projects={projects}
                updateState={(updates) => this.setState(updates)}
                selectedRepo={newProject}
                title="New"
                projectState="newProject"
                revisionState="newRevision"
                selectedRevision={newRevision}
                errorMessages={errorMessages}
                missingRevision={missingRevision}
              />
            </Row>

            <Row className="justify-content-center pt-3">
              <Col sm="8" className="d-flex justify-content-end px-1">
                <ButtonGroup>
                  <Dropdown>
                    <Dropdown.Toggle variant="secondary">
                      {frameworkName}
                    </Dropdown.Toggle>
                    <Dropdown.Menu className="overflow-auto dropdown-menu-height">
                      <DropdownMenuItems
                        options={frameworkNames}
                        selectedItem={frameworkName}
                        updateData={this.updateFramework}
                      />
                    </Dropdown.Menu>
                  </Dropdown>
                  <Button
                    variant="darker-info"
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
