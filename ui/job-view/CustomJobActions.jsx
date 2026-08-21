import React from 'react';
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
      payloadObject: {},
      inputValues: {},
      dropdownOpen: false,
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
    const selectedAction = actions?.[actionName];

    if (actionName && selectedAction) {
      this.setState({ dropdownOpen: false });
      this.updateSelectedAction(selectedAction);
    }
  };

  toggleDropdown = (isOpen) => {
    this.setState((prevState) => ({
      dropdownOpen: typeof isOpen === 'boolean' ? isOpen : !prevState.dropdownOpen
    }));
  };

  updateSelectedAction = (action) => {
    const { ajv } = this.state;

    if (action?.schema) {
      let defaults = {};
      try {
        defaults = jsonSchemaDefaults(action.schema) || {};
      } catch (_e) {
        defaults = {};
      }

      const cleanPayloadObj = {};
      const initialInputValues = {};

      if (defaults && typeof defaults === 'object') {
        Object.entries(defaults).forEach(([key, val]) => {
          if (val !== '' && val !== null && val !== undefined) {
            cleanPayloadObj[key] = val;
            initialInputValues[key] =
              typeof val === 'object' ? JSON.stringify(val) : String(val);
          }
        });
      }

      this.setState({
        selectedAction: action,
        schema: jsyaml.dump(action.schema),
        payloadObject: cleanPayloadObj,
        inputValues: initialInputValues,
        payload: Object.keys(cleanPayloadObj).length ? jsyaml.dump(cleanPayloadObj) : '',
        validate: ajv.compile(action.schema),
      });
    } else {
      this.setState({
        selectedAction: action || {},
        schema: null,
        payloadObject: {},
        inputValues: {},
        payload: null,
        validate: null,
      });
    }
  };

  handlePropertyChange = (key, rawValue, propSchema = {}) => {
    const type = propSchema.type;
    const isEnum = Array.isArray(propSchema.enum);

    this.setState((prevState) => {
      const nextPayloadObj = { ...prevState.payloadObject };
      const nextInputValues = { ...prevState.inputValues };

      if (rawValue === '' || rawValue === null || rawValue === undefined) {
        delete nextPayloadObj[key];
        delete nextInputValues[key];
      } else if (isEnum) {
        const matchedEnum = propSchema.enum.find((opt) => String(opt) === rawValue);
        if (matchedEnum !== undefined) {
          nextPayloadObj[key] = matchedEnum;
          nextInputValues[key] = String(matchedEnum);
        } else {
          delete nextPayloadObj[key];
          delete nextInputValues[key];
        }
      } else if (type === 'number' || type === 'integer') {
        const allowNegative = propSchema.minimum === undefined || propSchema.minimum < 0;
        let sanitized = rawValue;

        if (type === 'integer') {
          sanitized = allowNegative
            ? rawValue.replace(/(?!^-)[^0-9]/g, '')
            : rawValue.replace(/[^0-9]/g, '');
        } else {
          sanitized = allowNegative
            ? rawValue.replace(/(?!^-)[^0-9.]/g, '')
            : rawValue.replace(/[^0-9.]/g, '');

          const parts = sanitized.split('.');
          if (parts.length > 2) {
            sanitized = `${parts[0]}.${parts.slice(1).join('')}`;
          }
        }

        if (sanitized !== '' && sanitized !== '-') {
          let numVal = Number(sanitized);

          if (!Number.isNaN(numVal)) {
            if (propSchema.maximum !== undefined && numVal > propSchema.maximum) {
              numVal = propSchema.maximum;
              sanitized = String(propSchema.maximum);
            }
            nextPayloadObj[key] = numVal;
          } else {
            delete nextPayloadObj[key];
          }
        } else {
          delete nextPayloadObj[key];
        }

        nextInputValues[key] = sanitized;
      } else if (type === 'boolean') {
        const boolVal = rawValue === 'true';
        nextPayloadObj[key] = boolVal;
        nextInputValues[key] = String(boolVal);
      } else {
        nextPayloadObj[key] = rawValue;
        nextInputValues[key] = rawValue;
      }

      const yamlPayload = Object.keys(nextPayloadObj).length > 0 ? jsyaml.dump(nextPayloadObj) : '';

      return {
        payloadObject: nextPayloadObj,
        inputValues: nextInputValues,
        payload: yamlPayload,
      };
    });
  };

  handleNumberBlur = (key, propSchema) => {
    const { inputValues } = this.state;
    const currentInput = inputValues[key];

    if (currentInput === undefined || currentInput === null || currentInput === '') {
      return;
    }

    let cleaned = currentInput;
    if (cleaned.endsWith('.')) {
      cleaned = cleaned.slice(0, -1);
    }
    if (cleaned === '-' || cleaned === '-.' || cleaned === '.') {
      cleaned = '';
    }

    if (cleaned === '') {
      this.handlePropertyChange(key, '', propSchema);
      return;
    }

    let numVal = Number(cleaned);
    if (!Number.isNaN(numVal)) {
      if (propSchema.minimum !== undefined && numVal < propSchema.minimum) {
        numVal = propSchema.minimum;
      }
      if (propSchema.maximum !== undefined && numVal > propSchema.maximum) {
        numVal = propSchema.maximum;
      }

      const targetValStr = String(numVal);
      if (targetValStr !== currentInput) {
        this.handlePropertyChange(key, targetValStr, propSchema);
      }
    } else {
      this.handlePropertyChange(key, '', propSchema);
    }
  };

  triggerAction = () => {
    this.setState({ triggering: true });
    const {
      ajv,
      validate,
      payloadObject,
      decisionTaskId,
      originalTaskId,
      originalTask,
      selectedAction: action,
      staticActionVariables,
    } = this.state;
    const { currentRepo } = this.props;

    const input = Object.keys(payloadObject).length > 0 ? payloadObject : null;

    if (validate) {
      const valid = validate(input || {});
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

  renderPropertyFields = () => {
    const { selectedAction, inputValues } = this.state;
    const properties = selectedAction?.schema?.properties;

    if (!properties || Object.keys(properties).length === 0) {
      return null;
    }

    return (
      <div className="mb-3 border p-3 rounded bg-light">
        <h6 className="fw-bold mb-3">Action Properties</h6>
        <div className="row">
          {Object.entries(properties).map(([propKey, propSchema]) => {
            const inputValue = inputValues[propKey] ?? '';
            const isNumber = propSchema.type === 'number' || propSchema.type === 'integer';
            const isBoolean = propSchema.type === 'boolean';
            const isEnum = Array.isArray(propSchema.enum);

            let rangeSuffix = '';
            if (propSchema.minimum !== undefined && propSchema.maximum !== undefined) {
              rangeSuffix = ` (${propSchema.minimum}-${propSchema.maximum})`;
            } else if (propSchema.minimum !== undefined) {
              rangeSuffix = ` (min: ${propSchema.minimum})`;
            } else if (propSchema.maximum !== undefined) {
              rangeSuffix = ` (max: ${propSchema.maximum})`;
            }

            const displayName = `${propKey}${rangeSuffix}`;

            const labelContent = propSchema.description ? (
              <SimpleTooltip text={displayName} tooltipText={propSchema.description} />
            ) : (
              <span>{displayName}</span>
            );

            return (
              <div className="col-md-6 form-group mb-3" key={propKey}>
                <Form.Label htmlFor={`property-${propKey}`} className="fw-semibold">
                  {labelContent}
                </Form.Label>

                {isEnum ? (
                  <Form.Select
                    id={`property-${propKey}`}
                    value={inputValue}
                    onChange={(e) =>
                      this.handlePropertyChange(propKey, e.target.value, propSchema)
                    }
                  >
                    <option value="">-- select an option --</option>
                    {propSchema.enum.map((opt) => (
                      <option key={opt} value={opt}>
                        {String(opt)}
                      </option>
                    ))}
                  </Form.Select>
                ) : isBoolean ? (
                  <Form.Select
                    id={`property-${propKey}`}
                    value={inputValue}
                    onChange={(e) =>
                      this.handlePropertyChange(propKey, e.target.value, propSchema)
                    }
                  >
                    <option value="">-- select boolean --</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </Form.Select>
                ) : isNumber ? (
                  <Form.Control
                    type="text"
                    inputMode={propSchema.type === 'integer' ? 'numeric' : 'decimal'}
                    id={`property-${propKey}`}
                    value={inputValue}
                    onBlur={() => this.handleNumberBlur(propKey, propSchema)}
                    onChange={(e) =>
                      this.handlePropertyChange(propKey, e.target.value, propSchema)
                    }
                  />
                ) : (
                  <Form.Control
                    type="text"
                    id={`property-${propKey}`}
                    value={inputValue}
                    onChange={(e) =>
                      this.handlePropertyChange(propKey, e.target.value, propSchema)
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
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

              {this.renderPropertyFields()}

              <div className="row">
                {!!selectedAction.schema && (
                  <React.Fragment>
                    <div className="col-s-12 col-md-6 form-group">
                      <Form.Label htmlFor="payload-textarea" className="w-100">
                        Payload
                      </Form.Label>
                      <textarea
                        id="payload-textarea"
                        value={payload || ''}
                        className="form-control pre"
                        rows="10"
                        readOnly
                        spellCheck="false"
                      />
                    </div>
                    <div className="col-s-12 col-md-6 form-group">
                      <Form.Label htmlFor="schema-textarea" className="w-100">
                        Schema
                      </Form.Label>
                      <textarea
                        id="schema-textarea"
                        className="form-control pre"
                        rows="10"
                        readOnly
                        value={schema || ''}
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
