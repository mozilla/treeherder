import React from 'react';
import PropTypes from 'prop-types';
import Ajv from 'ajv';
import jsonSchemaDefaults from 'json-schema-defaults';
import keyBy from 'lodash/keyBy';
import jsyaml from 'js-yaml';
import tcLibUrls from 'taskcluster-lib-urls';
import { Button, Dropdown, Form, Modal, ButtonGroup } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckSquare } from '@fortawesome/free-regular-svg-icons';

import { formatTaskclusterError } from '../helpers/errorMessage';
import TaskclusterModel from '../models/taskcluster';
import DropdownMenuItems from '../shared/DropdownMenuItems';
import { checkRootUrl } from '../taskcluster-auth-callback/constants';

import { notify } from '../shared/stores/notificationStore';
import { usePushesStore } from '../shared/stores/pushesStore';
import SimpleTooltip from '../shared/SimpleTooltip';

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
      payloadView: 'yaml',
    };
  }

  async componentDidMount() {
    const { pushId, job = null, decisionTaskMap, currentRepo } = this.props;
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
      this.setState({ selectedAction, payloadView: 'yaml' });
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
    const { currentRepo } = this.props;

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

  onFormFieldChange = (fieldName, type, value) => {
    const { payload } = this.state;
    try {
      const parsedPayload = jsyaml.load(payload) || {};
      
      if (type === 'integer') {
        parsedPayload[fieldName] = value === '' ? '' : parseInt(value, 10);
      } else if (type === 'boolean') {
        parsedPayload[fieldName] = value === 'true';
      }

      this.onChangePayload(jsyaml.dump(parsedPayload));
    } catch (_e) {
      notify(`Cannot update form: Invalid YAML in Raw view.`, 'danger');
    }
  };

  renderPayloadForm() {
    const { selectedAction, payload } = this.state;
    const properties = selectedAction?.schema?.properties;
    
    if (!properties) return null;

    let parsedPayload = {};
    try {
      parsedPayload = jsyaml.load(payload) || {};
    } catch (_e) {
      return (
        <div className="text-danger p-3 border rounded">
          Invalid YAML detected. Please fix errors in the Raw YAML view before using the form.
        </div>
      );
    }

    return (
      <div className="p-3 border rounded" style={{ backgroundColor: '#f8f9fa' }}>
        {Object.entries(properties).map(([key, prop]) => {
          const isBool = prop.type === 'boolean';
          const isInt = prop.type === 'integer';
          
          const isEmpty = parsedPayload[key] === '' || parsedPayload[key] === undefined || parsedPayload[key] === null || Number.isNaN(parsedPayload[key]);          
          const value = !isEmpty ? parsedPayload[key] : (parsedPayload[key] === '' ? '' : prop.default);

          const label = prop.title || key;
          const rangeLabel = isInt && prop.minimum !== undefined && prop.maximum !== undefined 
            ? ` (${prop.minimum}-${prop.maximum})` 
            : '';
          const fullLabelText = `${label}${rangeLabel}`;

          return (
            <Form.Group key={key} className="d-flex align-items-center mb-3">
              <Form.Label className="w-50 fw-bold mb-0" style={{ cursor: prop.description ? 'help' : 'default' }}>
                {prop.description ? (
                  <SimpleTooltip 
                    text={fullLabelText} 
                    tooltipText={prop.description} 
                    placement="top" 
                  />
                ) : (
                  fullLabelText
                )}
              </Form.Label>
              <div className="w-50">
                {isBool ? (
                  <Form.Control
                    as="select"
                    value={String(value) === 'true' ? 'true' : 'false'}
                    onChange={(e) => this.onFormFieldChange(key, 'boolean', e.target.value)}
                  >
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </Form.Control>
                ) : isInt ? (
                  <React.Fragment>
                    <Form.Control
                      type="number"
                      min={prop.minimum ?? 0}
                      max={prop.maximum}
                      value={value}
                      isInvalid={isEmpty}
                      onChange={(e) => {
                        let sanitizedValue = e.target.value.replace(/\D/g, '');
                        
                        if (sanitizedValue !== '' && prop.maximum !== undefined && parseInt(sanitizedValue, 10) > prop.maximum) {
                          sanitizedValue = prop.maximum.toString();
                        }
                        
                        this.onFormFieldChange(key, 'integer', sanitizedValue);
                      }}
                      onBlur={(e) => {
                        const fallback = prop.default !== undefined 
                          ? prop.default.toString() 
                          : (prop.minimum !== undefined ? prop.minimum.toString() : '0');

                        if (e.target.value === '') {
                          this.onFormFieldChange(key, 'integer', fallback);
                        } else {
                          const numVal = parseInt(e.target.value, 10);
                          if (prop.minimum !== undefined && numVal < prop.minimum) {
                            this.onFormFieldChange(key, 'integer', prop.minimum.toString());
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        const isControlKey = ['Backspace', 'Tab', 'Enter', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key);
                        const isShortcut = e.ctrlKey || e.metaKey;
                        const isNumber = /^[0-9]$/.test(e.key);

                        if (!isControlKey && !isShortcut && !isNumber) {
                          e.preventDefault();
                        }
                      }}
                    />
                    <Form.Control.Feedback type="invalid">
                      This field cannot be empty.
                    </Form.Control.Feedback>
                  </React.Fragment>
                ) : null}
              </div>
            </Form.Group>
          );
        })}
      </div>
    );
  }

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
                <Form.Label htmlFor="action-select-input">Action</Form.Label>
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
                      options={Object.keys(actions).sort()}
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
                      <div className="d-flex justify-content-between align-items-end mb-2 w-100" style={{ minHeight: '31px' }}>
                        <Form.Label htmlFor="payload-textarea" className="mb-0 fw-bold">
                          Payload
                        </Form.Label>
                        
                        {['backfill', 'retrigger'].includes(selectedAction.name) && (
                          <ButtonGroup size="sm">
                            <Button
                              variant={this.state.payloadView === 'yaml' ? 'primary' : 'outline-primary'}
                              onClick={() => this.setState({ payloadView: 'yaml' })}
                            >
                              Raw YAML
                            </Button>
                            <Button
                              variant={this.state.payloadView === 'form' ? 'primary' : 'outline-primary'}
                              onClick={() => this.setState({ payloadView: 'form' })}
                            >
                              Form
                            </Button>
                          </ButtonGroup>
                        )}
                      </div>

                      {['backfill', 'retrigger'].includes(selectedAction.name) && this.state.payloadView === 'form' ? (
                        this.renderPayloadForm()
                      ) : (
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
                      )}
                    </div>
                    <div className="col-s-12 col-md-6 form-group">
                      <div className="d-flex align-items-end mb-2 w-100" style={{ minHeight: '31px' }}>
                        <Form.Label htmlFor="schema-textarea" className="mb-0 fw-bold w-100">
                          Schema
                        </Form.Label>
                      </div>
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
              className="me-1"
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
  toggle: PropTypes.func.isRequired,
  decisionTaskMap: PropTypes.shape({}).isRequired,
  job: PropTypes.shape({}),
  currentRepo: PropTypes.shape({}).isRequired,
};

// Wrapper to inject Zustand state into class component
function CustomJobActionsWrapper(props) {
  const decisionTaskMap = usePushesStore((state) => state.decisionTaskMap);
  return <CustomJobActions {...props} decisionTaskMap={decisionTaskMap} />;
}

export default CustomJobActionsWrapper;
