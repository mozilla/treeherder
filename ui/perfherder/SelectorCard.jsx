import React from 'react';
import PropTypes from 'prop-types';
import Icon from 'react-fontawesome';
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

import { getProjectUrl, createQueryParams, pushEndpoint } from '../helpers/url';
import { getData } from '../helpers/http';
import { genericErrorMessage } from '../helpers/constants';

export default class SelectorCard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      buttonDropdownOpen: false,
      inputDropdownOpen: false,
      checkboxSelected: this.props.queryParam,
      inputValue: '',
      data: {},
      failureStatus: null,
      invalidInput: false,
      disabled: false,
    };
  }

  async componentDidMount() {
    // by default revisions are only needed for the 'New' component dropdown
    // so we'll fetch revisions for the 'Base' component only as needed
    if (this.props.revisionState === 'newRevision') {
      this.fetchRevisions(this.props.selectedRepo);
    }
  }

  fetchRevisions = async selectedRepo => {
    // if a user selects a new project/repo, we don't want them to
    // be able to select revisions until that new data has returned
    if (Object.keys(this.state.data) !== 0) {
      this.setState({ disabled: true });
    }

    const params = {
      full: true,
      count: 10,
    };
    const url = `${getProjectUrl(
      pushEndpoint,
      selectedRepo,
    )}${createQueryParams(params)}`;
    const { data, failureStatus } = await getData(url);

    if (failureStatus) {
      this.props.updateState({ errorMessages: genericErrorMessage });
    } else {
      this.setState({ data, failureStatus, disabled: false });
    }
  };

  toggle = dropdown => {
    this.setState({
      [dropdown]: !this.state[dropdown],
    });
  };

  updateData = selectedRepo => {
    const { updateState, projectState } = this.props;
    this.fetchRevisions(selectedRepo);
    updateState({ [projectState]: selectedRepo });
  };

  compareRevisions = () => {
    this.toggle('checkboxSelected');
    if (!this.state.data.results) {
      this.fetchRevisions(this.props.selectedRepo);
    }
  };

  updateRevision = value => {
    const { updateState, revisionState } = this.props;

    this.setState({ invalidInput: false });
    updateState({
      [revisionState]: value,
      errorMessages: [],
      disableButton: false,
    });
  };

  render() {
    const {
      buttonDropdownOpen,
      inputDropdownOpen,
      checkboxSelected,
      data,
      invalidInput,
      disabled,
    } = this.state;
    const {
      selectedRepo,
      updateState,
      projects,
      title,
      text,
      checkbox,
      selectedRevision,
      revisionState,
    } = this.props;

    return (
      <Col sm="4" className="p-2">
        <Card style={{ height: '250px' }}>
          <CardHeader style={{ backgroundColor: 'lightgrey' }}>
            {title}
          </CardHeader>
          <CardBody>
            <CardSubtitle className="pb-2 pt-3">Project</CardSubtitle>
            <ButtonDropdown
              className="mr-3 w-25"
              isOpen={buttonDropdownOpen}
              toggle={() => this.toggle('buttonDropdownOpen')}
            >
              <DropdownToggle caret outline>
                {selectedRepo}
              </DropdownToggle>
              {projects.length > 0 && (
                <DropdownMenu
                  style={{
                    overflow: 'auto',
                    maxHeight: 300,
                  }}
                >
                  {projects.map(item => (
                    <DropdownItem
                      key={item.name}
                      onClick={event => this.updateData(event.target.innerText)}
                    >
                      <Icon
                        name="check"
                        className={`pr-1 ${
                          selectedRepo === item.name ? '' : 'hide'
                        }`}
                      />
                      {item.name}
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              )}
            </ButtonDropdown>

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
                    placeholder="select or enter a revision"
                    value={selectedRevision}
                    onChange={event =>
                      updateState({
                        [revisionState]: event.target.value,
                        errorMessages: [],
                        disableButton: false,
                      })
                    }
                    onFocus={() => this.setState({ invalidInput: false })}
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
                        {data.results.map(item => (
                          <DropdownItem
                            key={item.id}
                            onClick={event =>
                              this.updateRevision(
                                event.target.innerText.split(' ')[0],
                              )
                            }
                          >
                            <Icon
                              name="check"
                              className={`pr-1 ${
                                selectedRevision === item.revision ? '' : 'hide'
                              }`}
                            />
                            {`${item.revision} ${item.author}`}
                          </DropdownItem>
                        ))}
                      </DropdownMenu>
                    )}
                  </InputGroupButtonDropdown>
                </InputGroup>
                {invalidInput && (
                  <CardText className="text-danger py-2">
                    {invalidInput}
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
};

SelectorCard.defaultProps = {
  projects: [],
  text: null,
  checkbox: false,
  queryParam: undefined,
};
