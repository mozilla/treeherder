import React from 'react';
import PropTypes from 'prop-types';
import {
  Col,
  Card,
  CardHeader,
  CardText,
  CardBody,
  DropdownItem,
  Input,
  CardSubtitle,
  Label,
  FormGroup,
  ButtonDropdown,
  DropdownToggle,
  DropdownMenu,
  InputGroup,
  InputGroupButtonDropdown,
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';

import PushModel from '../../models/push';
import { genericErrorMessage } from '../../helpers/constants';
import { selectorCardText } from '../constants';

export default class SelectorCard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      buttonDropdownOpen: false,
      inputDropdownOpen: false,
      checkboxSelected: this.props.queryParam,
      data: {},
      failureStatus: null,
      invalidRevision: false,
      invalidProject: false,
      disabled: false,
      validating: false,
      validated: false,
    };
  }

  async componentDidMount() {
    this.validateQueryParams();
  }

  validateQueryParams = () => {
    const { projects, selectedRepo, revisionState } = this.props;
    const validProject = projects.find((item) => item.name === selectedRepo);

    if (!validProject) {
      return this.setState({
        invalidProject: 'Invalid project',
      });
    }
    // TODO might need to reset invalidProject after switching to react router
    // (not sure if entire page is reloaded if query params change)

    // by default revisions are only needed for the 'New' component dropdown
    // so we'll fetch revisions for the 'Base' component only as needed
    if (this.state.checkboxSelected || revisionState === 'newRevision') {
      this.fetchRevisions(selectedRepo);
    }
  };

  fetchRevisions = async (selectedRepo) => {
    const { selectedRevision, updateState, getRevisions } = this.props;

    // if a user selects a new project/repo, we don't want them to
    // be able to select revisions until that new data has returned
    if (Object.keys(this.state.data) !== 0) {
      this.setState({ disabled: true });
    }

    const { data, failureStatus } = await getRevisions({
      repo: selectedRepo,
    });

    if (failureStatus) {
      updateState({ errorMessages: [genericErrorMessage] });
    } else {
      this.setState({ data, failureStatus, disabled: false });
      // if a user pastes a revision then selects a different project,
      // re-validate the revision with that new project (repository)
      if (selectedRevision !== '') {
        this.validateInput(selectedRevision);
      }
    }
  };

  toggle = (dropdown) => {
    this.setState((prevState) => ({
      [dropdown]: !prevState[dropdown],
    }));
  };

  updateRevisions = (selectedRepo) => {
    const { updateState, projectState } = this.props;
    // reset invalidProject from query param validation
    // in case user resets project via dropdown instead
    // of updating the query param
    if (this.state.invalidProject) {
      this.setState({ invalidProject: false });
    }
    this.fetchRevisions(selectedRepo);
    updateState({ [projectState]: selectedRepo });
  };

  compareRevisions = () => {
    this.toggle('checkboxSelected');
    if (!this.state.data.results) {
      this.fetchRevisions(this.props.selectedRepo);
    }
  };

  selectRevision = (value) => {
    const { updateState, revisionState } = this.props;

    this.setState({ invalidRevision: false });
    updateState({
      [revisionState]: value,
      disableButton: false,
      missingRevision: false,
    });
  };

  validateInput = async (value) => {
    const {
      updateState,
      revisionState,
      selectedRepo,
      getRevisions,
    } = this.props;
    const { data } = this.state;

    updateState({
      [revisionState]: value,
      disableButton: true,
    });

    if (value === '') {
      return this.setState({ validated: false });
    }
    value = value.trim();

    if (value.length !== 40) {
      return this.setState({
        invalidRevision: selectorCardText.invalidRevisionLength,
      });
    }
    // if a revision has been entered, check whether it's already
    // been fetched for the revision dropdown menu (data)
    const existingRevision = data.results.find(
      (item) => item.revision === value,
    );

    if (!existingRevision) {
      this.setState({ validating: 'Validating...' });

      const { data: revisions, failureStatus } = await getRevisions({
        repo: selectedRepo,
        commit_revision: value,
      });

      if (failureStatus || revisions.meta.count === 0) {
        return this.setState({
          invalidRevision: selectorCardText.invalidRevision,
          validating: false,
          validated: true,
        });
      }
    }

    updateState({ disableButton: false, missingRevision: false });
    this.setState({
      invalidRevision: false,
      validating: false,
      validated: true,
    });
  };

  render() {
    const {
      buttonDropdownOpen,
      inputDropdownOpen,
      checkboxSelected,
      data,
      invalidRevision,
      invalidProject,
      disabled,
      validating,
      validated,
    } = this.state;
    const {
      selectedRepo,
      projects,
      title,
      text,
      checkbox,
      selectedRevision,
      missingRevision,
    } = this.props;
    return (
      <Col sm="4" className="p-2 text-left">
        <Card className="card-height">
          <CardHeader className="bg-lightgray">{title}</CardHeader>
          <CardBody>
            <CardSubtitle className="pb-2 pt-3">Project</CardSubtitle>
            <ButtonDropdown
              className="mr-3 w-25 text-nowrap"
              isOpen={buttonDropdownOpen}
              toggle={() => this.toggle('buttonDropdownOpen')}
            >
              <DropdownToggle caret outline>
                {selectedRepo}
              </DropdownToggle>
              {projects.length > 0 && (
                <DropdownMenu className="overflow-auto dropdown-menu-height">
                  {projects.map((item) => (
                    <DropdownItem
                      tag="a"
                      key={item.name}
                      onClick={(event) =>
                        this.updateRevisions(event.target.innerText)
                      }
                    >
                      <FontAwesomeIcon
                        icon={faCheck}
                        className={`mr-1 ${
                          selectedRepo === item.name ? '' : 'hide'
                        }`}
                        title={selectedRepo === item.name ? 'Checked' : ''}
                      />
                      {item.name}
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              )}
            </ButtonDropdown>
            {invalidProject && (
              <CardText className="text-danger pt-1 mb-0">
                {invalidProject}
              </CardText>
            )}

            {checkbox && (
              <FormGroup check className="pt-1">
                <Label check className="font-weight-normal">
                  <Input
                    type="checkbox"
                    defaultChecked={checkboxSelected}
                    onClick={this.compareRevisions}
                  />{' '}
                  Compare with a specific revision
                </Label>
              </FormGroup>
            )}

            {!checkboxSelected && text ? (
              <CardText className="text-muted py-2">{text}</CardText>
            ) : (
              <React.Fragment>
                <CardSubtitle className="pt-4 pb-2">Revision</CardSubtitle>
                <InputGroup>
                  <Input
                    valid={!invalidRevision && !validating && validated}
                    placeholder={selectorCardText.revisionPlaceHolder}
                    value={selectedRevision}
                    onChange={(event) => this.validateInput(event.target.value)}
                    onFocus={() =>
                      this.setState({
                        invalidRevision: false,
                        validated: false,
                      })
                    }
                  />
                  <InputGroupButtonDropdown
                    addonType="append"
                    isOpen={inputDropdownOpen}
                    toggle={() => this.toggle('inputDropdownOpen')}
                  >
                    <DropdownToggle caret outline disabled={disabled}>
                      Recent
                    </DropdownToggle>
                    {!!data.results && data.results.length > 0 && (
                      <DropdownMenu>
                        {data.results.map((item) => (
                          <DropdownItem
                            tag="a"
                            key={item.id}
                            onClick={(event) =>
                              this.selectRevision(
                                event.target.innerText.split(' ')[0],
                              )
                            }
                          >
                            <FontAwesomeIcon
                              icon={faCheck}
                              className={`mr-1 ${
                                selectedRevision === item.revision ? '' : 'hide'
                              }`}
                              title={
                                selectedRevision === item.revision
                                  ? 'Checked'
                                  : ''
                              }
                            />
                            {`${item.revision} ${item.author}`}
                          </DropdownItem>
                        ))}
                      </DropdownMenu>
                    )}
                  </InputGroupButtonDropdown>
                </InputGroup>
                {(validating || invalidRevision || missingRevision) && (
                  <CardText
                    className={
                      validating ? 'text-info pt-1' : 'text-danger pt-1'
                    }
                  >
                    {validating || invalidRevision || missingRevision}
                  </CardText>
                )}
              </React.Fragment>
            )}
          </CardBody>
        </Card>
      </Col>
    );
  }
}

SelectorCard.propTypes = {
  projects: PropTypes.arrayOf(PropTypes.shape({})),
  selectedRepo: PropTypes.string.isRequired,
  selectedRevision: PropTypes.string.isRequired,
  revisionState: PropTypes.string.isRequired,
  projectState: PropTypes.string.isRequired,
  updateState: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  text: PropTypes.string,
  checkbox: PropTypes.bool,
  queryParam: PropTypes.string,
  missingRevision: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
  getRevisions: PropTypes.func,
};

SelectorCard.defaultProps = {
  projects: [],
  text: null,
  checkbox: false,
  queryParam: undefined,
  missingRevision: false,
  getRevisions: PushModel.getList,
};
