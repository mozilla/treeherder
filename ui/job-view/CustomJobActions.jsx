import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import Ajv from 'ajv';
import jsonSchemaDefaults from 'json-schema-defaults';
import keyBy from 'lodash/keyBy';
import jsyaml from 'js-yaml';
import tcLibUrls from 'taskcluster-lib-urls';
import { Button, Dropdown, Form, Modal } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckSquare } from '@fortawesome/free-regular-svg-icons';

import { formatTaskclusterError } from '../helpers/errorMessage';
import TaskclusterModel from '../models/taskcluster';
import DropdownMenuItems from '../shared/DropdownMenuItems';
import { checkRootUrl } from '../taskcluster-auth-callback/constants';

import { notify } from './redux/stores/notifications';

class CustomJobActions extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      ajv: new Ajv({ validateFormats: false, verbose: true, allErrors: true }),
      decisionTaskId: null,
      originalTaskId: null,
      originalTask: null,
      validate: null,
      actions: null,
      selectedAction: {},
      schema: '',
      payload: '',
      dropdownOpen: false,
    };
  }

  async componentDidMount() {
    const { pushId, job, notify, decisionTaskMap, currentRepo } = this.props;
    const { id: decisionTaskId } = decisionTaskMap[pushId];

    TaskclusterModel.load(decisionTaskId, job, currentRepo).then((results) => {
      const {
        originalTask,
        originalTaskId,
        staticActionVariables,
        actions,
      } = results;

      if (actions.length) {
        const mappedActions = keyBy(actions, 'name');
        const selectedAction = actions[0];

        this.setState(
          {
            originalTask,
            originalTaskId,
            actions: mappedActions,
            staticActionVariables,
            selectedAction,
          },
          () => this.updateSelectedAction(selectedAction),
        );
      } else {
        notify(
          `No actions for task ${decisionTaskId}.  The task may be expired.`,
          'danger',
          {
            sticky: true,
          },
        );
      }
    });
    this.setState({ decisionTaskId });
  }

  onChangeAction = (actionName) => {
    const { actions } = this.state;
    const selectedAction = actions[actionName];

    if (actionName) {
      this.setState({ selectedAction });
      this.updateSelectedAction(selectedAction);
    }
  };

  onChangePayload(payload) {
    this.setState({ payload });
  }

  toggleDropdown = () => {
    this.setState((prevState) => ({ dropdownOpen: !prevState.dropdownOpen }));
  };

  updateSelectedAction = (action) => {
    const { ajv } = this.state;

    if (action.schema) {
      this.setState({
        schema: jsyaml.dump(action.schema),
        payload: jsyaml.dump(jsonSchemaDefaults(action.schema)),
        validate: ajv.compile(action.schema),
      });
    } else {
      this.setState({ schema: null, payload: null, validate: null });
    }
  };

  triggerAction = () => {
    this.setState({ triggering: true });
    const {
      ajv,
      validate,
      payload,
      decisionTaskId,
      originalTaskId,
      originalTask,
      selectedAction: action,
      staticActionVariables,
    } = this.state;
    const { notify, currentRepo } = this.props;

    let input = null;
    if (validate && payload) {
      try {
        input = jsyaml.load(payload);
      } catch (e) {
        this.setState({ triggering: false });
        notify(`YAML Error: ${e.message}`, 'danger');
        return;
      }
      const valid = validate(input);
      if (!valid) {
        this.setState({ triggering: false });
        notify(ajv.errorsText(validate.errors), 'danger');
        return;
      }
    }

    TaskclusterModel.submit({
      action,
      decisionTaskId,
      taskId: originalTaskId,
      task: originalTask,
      input,
      staticActionVariables,
      currentRepo,
    }).then(
      (taskId) => {
        this.setState({ triggering: false }, this.close);
        let message = 'Custom action request sent successfully:';
        let url = tcLibUrls.ui(
          checkRootUrl(currentRepo.tc_root_url),
          `/tasks/${taskId}`,
        );

        // For the time being, we are redirecting specific actions to
        // specific urls that are different than usual. At this time, we are
        // only directing loaner tasks to the loaner UI in the tools site.
        // It is possible that we may make this a part of the spec later.
        const loaners = [
          'docker-worker-linux-loaner',
          'generic-worker-windows-loaner',
        ];
        if (loaners.includes(action.name)) {
          message = 'Visit Taskcluster site to access loaner:';
          url = `${url}/connect`;
        }
        notify(message, 'success', { linkText: 'Open in Taskcluster', url });
        this.close();
      },
      (e) => {
        notify(formatTaskclusterError(e), 'danger', { sticky: true });
        this.setState({ triggering: false }, this.close);
      },
    );
  };

  close = () => {
    // prevent closing of dialog while we're triggering
    const { triggering } = this.state;
    const { toggle } = this.props;

    if (!triggering) {
      toggle();
    }
  };

  render() {
    const { toggle } = this.props;
    const { triggering, selectedAction, schema, actions, payload } = this.state;
    const isOpen = true;

    return (
      <Modal show={isOpen} onHide={this.close} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Custom Taskcluster Job Actions</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!actions && (
            <div>
              <p className="blink"> Getting available actions...</p>
            </div>
          )}
          {!!actions && (
            <div>
              <div className="form-group">
                <Form.Label for="action-select-input">Action</Form.Label>
                <Dropdown
                  show={this.state.dropdownOpen}
                  onToggle={this.toggleDropdown}
                  aria-describedby="selectedActionHelp"
                  className="mb-1"
                  id="action-select-input"
                >
                  <Dropdown.Toggle>{selectedAction.name}</Dropdown.Toggle>
                  <Dropdown.Menu>
                    <DropdownMenuItems
                      selectedItem={selectedAction.name}
                      updateData={this.onChangeAction}
                      options={Object.keys(actions)}
                    />
                  </Dropdown.Menu>
                </Dropdown>
                <p id="selectedActionHelp" className="help-block">
                  {selectedAction.description}
                </p>
                {selectedAction.kind === 'hook' && (
                  <p>
                    This action triggers hook&nbsp;
                    <code>
                      {selectedAction.hookGroupId}/{selectedAction.hookId}
                    </code>
                  </p>
                )}
              </div>
              <div className="row">
                {!!selectedAction.schema && (
                  <React.Fragment>
                    <div className="col-s-12 col-md-6 form-group">
                      <Form.Label for="payload-textarea" className="w-100">
                        Payload
                      </Form.Label>
                      <textarea
                        id="payload-textarea"
                        value={payload}
                        className="form-control pre"
                        rows="10"
                        onChange={(evt) =>
                          this.onChangePayload(evt.target.value)
                        }
                        spellCheck="false"
                      />
                    </div>
                    <div className="col-s-12 col-md-6 form-group">
                      <Form.Label for="schema-textarea" className="w-100">
                        Schema
                      </Form.Label>
                      <textarea
                        id="schema-textarea"
                        className="form-control pre"
                        rows="10"
                        readOnly
                        value={schema}
                      />
                    </div>
                  </React.Fragment>
                )}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="darker-info"
            className={triggering ? 'disabled' : ''}
            onClick={this.triggerAction}
            title="Trigger this action"
          >
            <FontAwesomeIcon
              icon={faCheckSquare}
              className="mr-1"
              title="Check"
            />
            <span>{triggering ? 'Triggering' : 'Trigger'}</span>
          </Button>
          <Button variant="secondary" onClick={toggle}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }
}

CustomJobActions.propTypes = {
  pushId: PropTypes.number.isRequired,
  notify: PropTypes.func.isRequired,
  toggle: PropTypes.func.isRequired,
  decisionTaskMap: PropTypes.shape({}).isRequired,
  job: PropTypes.shape({}),
  currentRepo: PropTypes.shape({}).isRequired,
};

CustomJobActions.defaultProps = {
  job: null,
};

const mapStateToProps = ({ pushes: { decisionTaskMap } }) => ({
  decisionTaskMap,
});

export default connect(mapStateToProps, { notify })(CustomJobActions);
