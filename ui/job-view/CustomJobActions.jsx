import React from 'react';
import Select from 'react-select';
import PropTypes from 'prop-types';
import Ajv from 'ajv';
import jsonSchemaDefaults from 'json-schema-defaults';
import jsyaml from 'js-yaml';
import { slugid } from 'taskcluster-client-web';
import {
  Button, Modal, ModalHeader, ModalBody, ModalFooter,
} from 'reactstrap';

import { formatTaskclusterError } from '../helpers/errorMessage';
import TaskclusterModel from '../models/taskcluster';

export default class CustomJobActions extends React.Component {
  constructor(props) {
    super(props);

    this.taskclusterModel = new TaskclusterModel(props.notify);

    this.state = {
      ajv: new Ajv({ format: 'full', verbose: true, allErrors: true }),
      decisionTaskId: null,
      originalTaskId: null,
      originalTask: null,
      validate: null,
      actions: null,
      selectedActionOption: '',
      actionOptions: {},
      schema: '',
      payload: '',
    };
  }

  componentDidMount() {
    const { pushModel, pushId, job } = this.props;

    this.updateSelectedAction = this.updateSelectedAction.bind(this);
    this.onChangeAction = this.onChangeAction.bind(this);
    this.close = this.close.bind(this);
    this.triggerAction = this.triggerAction.bind(this);

    pushModel.getGeckoDecisionTaskId(pushId).then((decisionTaskId) => {
      this.taskclusterModel.load(decisionTaskId, job).then((results) => {
        const { originalTask, originalTaskId, staticActionVariables, actions } = results;
        const actionOptions = actions.map(action => ({ value: action, label: action.title }));

        this.setState({
          originalTask,
          originalTaskId,
          actions,
          staticActionVariables,
          actionOptions,
          selectedActionOption: actionOptions[0],
        }, () => this.updateSelectedAction(actions[0]));
      });
      this.setState({ decisionTaskId });
    });
  }

  onChangeAction(actionOption) {
    if (actionOption.value) {
      this.setState({ selectedActionOption: actionOption });
      this.updateSelectedAction(actionOption.value);
    }
  }

  onChangePayload(payload) {
    this.setState({ payload });
  }

  updateSelectedAction(action) {
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
  }

  triggerAction() {
    this.setState({ triggering: true });
    const {
      ajv, validate, payload, decisionTaskId, originalTaskId, originalTask,
      selectedActionOption, staticActionVariables,
    } = this.state;
    const { notify } = this.props;
    const action = selectedActionOption.value;

    let input = null;
    if (validate && payload) {
      try {
        input = jsyaml.safeLoad(payload);
      } catch (e) {
        this.setState({ triggering: false });
        notify.send(`YAML Error: ${e.message}`, 'danger');
        return;
      }
      const valid = validate(input);
      if (!valid) {
        this.setState({ triggering: false });
        notify.send(ajv.errorsText(validate.errors), 'danger');
        return;
      }
    }

    this.taskclusterModel.submit({
       action,
       actionTaskId: slugid(),
       decisionTaskId,
       taskId: originalTaskId,
       task: originalTask,
       input,
       staticActionVariables,
     }).then((taskId) => {
      this.setState({ triggering: false });
      let message = 'Custom action request sent successfully:';
      let url = `https://tools.taskcluster.net/tasks/${taskId}`;

      // For the time being, we are redirecting specific actions to
      // specific urls that are different than usual. At this time, we are
      // only directing loaner tasks to the loaner UI in the tools site.
      // It is possible that we may make this a part of the spec later.
      const loaners = ['docker-worker-linux-loaner', 'generic-worker-windows-loaner'];
      if (loaners.includes(action.name)) {
        message = 'Visit Taskcluster Tools site to access loaner:';
        url = `${url}/connect`;
      }
      notify.send(message, 'success', { linkText: 'Open in Taskcluster', url });
      this.close();
    }, (e) => {
      notify.send(formatTaskclusterError(e), 'danger', { sticky: true });
      this.setState({ triggering: false });
      this.close();
    });
  }

  close() {
    // prevent closing of dialog while we're triggering
    const { triggering } = this.state;
    const { toggle } = this.props;

    if (!triggering) {
      toggle();
    }
  }

  render() {
    const { isLoggedIn, toggle } = this.props;
    const {
      triggering, selectedActionOption, schema, actions, actionOptions, payload,
    } = this.state;
    const isOpen = true;
    const selectedAction = selectedActionOption.value;

    return (
      <Modal isOpen={isOpen} toggle={this.close} size="lg">
        <ModalHeader toggle={this.close}>Custom Taskcluster Job Actions</ModalHeader>
        <ModalBody>
          {!actions && <div>
            <p className="blink"> Getting available actions...</p>
          </div>}
          {!!actions && <div>
            <div className="form-group">
              <label>Action</label>
              <Select
                aria-describedby="selectedActionHelp"
                value={selectedActionOption}
                onChange={this.onChangeAction}
                options={actionOptions}
              />
              <p
                id="selectedActionHelp"
                className="help-block"
              >{selectedAction.description}</p>
              {selectedAction.kind === 'hook' && <p>This action triggers hook&nbsp;
                <code>{selectedAction.hookGroupId}/{selectedAction.hookId}</code>
              </p>}
            </div>
            <div className="row">
              {!!selectedAction.schema && <React.Fragment>
                <div className="col-s-12 col-md-6 form-group">
                  <label>Payload</label>
                  <textarea
                    value={payload}
                    className="form-control pre"
                    rows="10"
                    onChange={evt => this.onChangePayload(evt.target.value)}
                    spellCheck="false"
                  />
                </div>
                <div className="col-s-12 col-md-6 form-group">
                  <label>Schema</label>
                  <textarea
                    className="form-control pre"
                    rows="10"
                    readOnly
                    value={schema}
                  />
                </div>
              </React.Fragment>}
            </div>
          </div>}
        </ModalBody>
        <ModalFooter>
          {isLoggedIn ?
            <Button
              color="secondary"
              className={`btn btn-primary-soft ${triggering ? 'disabled' : ''}`}
              onClick={this.triggerAction}
              title={isLoggedIn ? 'Trigger this action' : 'Not logged in'}
            >
              <span className="fa fa-check-square-o" aria-hidden="true" />
              <span>{triggering ? 'Triggering' : 'Trigger'}</span>
            </Button> :
            <p className="help-block" > Custom actions require login </p>
          }
          <Button color="secondary" onClick={toggle}>Cancel</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

CustomJobActions.propTypes = {
  pushModel: PropTypes.object.isRequired,
  pushId: PropTypes.number.isRequired,
  isLoggedIn: PropTypes.bool.isRequired,
  notify: PropTypes.object.isRequired,
  toggle: PropTypes.func.isRequired,
  job: PropTypes.object,
};

CustomJobActions.defaultProps = {
  job: null,
};
