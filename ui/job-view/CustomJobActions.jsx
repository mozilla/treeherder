import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import Ajv from 'ajv';
import jsonSchemaDefaults from 'json-schema-defaults';
import keyBy from 'lodash/keyBy';
// js-yaml is missing the `browser` entry from the package definition,
// so we have to explicitly import the dist file otherwise we get the
// node version which pulls in a number of unwanted polyfills. See:
// https://github.com/nodeca/js-yaml/pull/462
import jsyaml from 'js-yaml/dist/js-yaml';
import tcLibUrls from 'taskcluster-lib-urls';
import {
  Button,
  DropdownToggle,
  Label,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  UncontrolledDropdown,
} from 'reactstrap';
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
      ajv: new Ajv({ format: 'full', verbose: true, allErrors: true }),
      decisionTaskId: null,
      originalTaskId: null,
      originalTask: null,
      validate: null,
      actions: null,
      selectedAction: {},
      schema: '',
      payload: '',
    };
  }

  async componentDidMount() {
    const { pushId, job, notify, decisionTaskMap, currentRepo } = this.props;
    const { id: decisionTaskId } = decisionTaskMap[pushId];

    TaskclusterModel.load(decisionTaskId, job, currentRepo).then(results => {
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

  onChangeAction = actionName => {
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

  updateSelectedAction = action => {
    const { ajv } = this.state;

    if (action.schema) {
      this.setState({
        schema: jsyaml.safeDump(action.schema),
        payload: jsyaml.safeDump(jsonSchemaDefaults(action.schema)),
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
        input = jsyaml.safeLoad(payload);
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
      taskId => {
        this.setState({ triggering: false });
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
      e => {
        notify(formatTaskclusterError(e), 'danger', { sticky: true });
        this.setState({ triggering: false });
        this.close();
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
    const { isLoggedIn, toggle } = this.props;
    const { triggering, selectedAction, schema, actions, payload } = this.state;
    const isOpen = true;

    return (
      <Modal isOpen={isOpen} toggle={this.close} size="lg">
        <ModalHeader toggle={this.close}>
          Custom Taskcluster Job Actions
        </ModalHeader>
        <ModalBody>
          {!actions && (
            <div>
              <p className="blink"> Getting available actions...</p>
            </div>
          )}
          {!!actions && (
            <div>
              <div className="form-group">
                <Label for="action-select-input">Action</Label>
                <UncontrolledDropdown
                  aria-describedby="selectedActionHelp"
                  className="mb-1"
                  id="action-select-input"
                >
                  <DropdownToggle caret outline>
                    {selectedAction.name}
                  </DropdownToggle>
                  <DropdownMenuItems
                    selectedItem={selectedAction.name}
                    updateData={this.onChangeAction}
                    options={Object.keys(actions)}
                  />
                </UncontrolledDropdown>
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
                      <Label for="payload-textarea" className="w-100">
                        Payload
                      </Label>
                      <textarea
                        id="payload-textarea"
                        value={payload}
                        className="form-control pre"
                        rows="10"
                        onChange={evt => this.onChangePayload(evt.target.value)}
                        spellCheck="false"
                      />
                    </div>
                    <div className="col-s-12 col-md-6 form-group">
                      <Label for="schema-textarea" className="w-100">
                        Schema
                      </Label>
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
        </ModalBody>
        <ModalFooter>
          {isLoggedIn ? (
            <Button
              color="darker-info"
              className={triggering ? 'disabled' : ''}
              onClick={this.triggerAction}
              title={isLoggedIn ? 'Trigger this action' : 'Not logged in'}
            >
              <FontAwesomeIcon
                icon={faCheckSquare}
                className="mr-1"
                title="Check"
              />
              <span>{triggering ? 'Triggering' : 'Trigger'}</span>
            </Button>
          ) : (
            <p className="help-block"> Custom actions require login </p>
          )}
          <Button color="secondary" onClick={toggle}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    );
  }
}

CustomJobActions.propTypes = {
  pushId: PropTypes.number.isRequired,
  isLoggedIn: PropTypes.bool.isRequired,
  notify: PropTypes.func.isRequired,
  toggle: PropTypes.func.isRequired,
  decisionTaskMap: PropTypes.object.isRequired,
  job: PropTypes.object,
  currentRepo: PropTypes.object.isRequired,
};

CustomJobActions.defaultProps = {
  job: null,
};

const mapStateToProps = ({ pushes: { decisionTaskMap } }) => ({
  decisionTaskMap,
});

export default connect(mapStateToProps, { notify })(CustomJobActions);
