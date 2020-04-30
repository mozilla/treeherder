import React from 'react';
import {
  Container,
  Col,
  Row,
  Button,
  ButtonGroup,
  ButtonDropdown,
  DropdownToggle,
} from 'reactstrap';

import { parseQueryParams, createQueryParams } from '../../helpers/url';
import ErrorMessages from '../../shared/ErrorMessages';
import DropdownMenuItems from '../../shared/DropdownMenuItems';
import {
  genericErrorMessage,
  errorMessageClass,
} from '../../helpers/constants';
import { compareDefaultTimeRange } from '../constants';
import ErrorBoundary from '../../shared/ErrorBoundary';

import SelectorCard from './SelectorCard';

export default class CompareSelectorView extends React.Component {
  constructor(props) {
    super(props);
    this.queryParams = parseQueryParams(this.props.location.search);
    this.state = {
      originalProject: this.queryParams.originalProject || 'mozilla-central',
      newProject: this.queryParams.newProject || 'try',
      originalRevision: this.queryParams.originalRevision || '',
      newRevision: this.queryParams.newRevision || '',
      errorMessages: [],
      disableButton: true,
      missingRevision: false,
      framework: 1,
      frameworkName: 'talos',
      frameworkDropdownIsOpen: false,
    };
  }

  updateFramework = (selection) => {
    const selectedFramework = this.props.frameworks.find(
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
    history.push(`/compare${createQueryParams(params)}`);
  };

  toggleFrameworkDropdown = () => {
    this.setState((prevState) => ({
      frameworkDropdownIsOpen: !prevState.frameworkDropdownIsOpen,
    }));
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
      frameworkDropdownIsOpen,
    } = this.state;

    const { projects, frameworks } = this.props;
    const frameworkNames = frameworks.length
      ? frameworks.map((item) => item.name)
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
            <Row className="justify-content-center">
              <SelectorCard
                projects={projects}
                updateState={(updates) => this.setState(updates)}
                selectedRepo={originalProject}
                title="Base"
                checkbox
                text="By default, Perfherder will compare against performance data gathered over the last 2 days from when new revision was pushed"
                projectState="originalProject"
                revisionState="originalRevision"
                selectedRevision={originalRevision}
                queryParam={this.queryParams.originalRevision}
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
                    color="darker-info"
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
