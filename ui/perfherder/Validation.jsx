import React from 'react';
import PropTypes from 'prop-types';
import { Container } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';

import { getData, processResponse } from '../helpers/http';
import { getApiUrl, repoEndpoint } from '../helpers/url';
import PushModel from '../models/push';
import ErrorMessages from '../shared/ErrorMessages';

import { endpoints, summaryStatusMap } from './constants';

// TODO once we switch to react-router
// 1) use context in this HOC to share state between compare views, by wrapping router component in it;
//    advantages include:
//    * no need to check historical location.state to determine if user has navigated to compare or comparesubtest
//      views from a previous view (thus params have already been validated and resultsets stored in state)
//    * if user navigates to compareview from compareChooser and decides to change a project via query params
//      to a different project, projects will already be stored in state so no fetching data again to validate
//

const withValidation = (
  requiredParams,
  verifyRevisions = true,
) => WrappedComponent => {
  class Validation extends React.Component {
    constructor(props) {
      super(props);

      // TODO change $stateParams to location.state once we switch to react-router
      this.state = {
        originalProject: null,
        newProject: null,
        originalRevision: null,
        newRevision: null,
        originalSignature: null,
        newSignature: null,
        errorMessages: [],
        projects: [],
        originalResultSet: null,
        newResultSet: null,
        selectedTimeRange: null,
        framework: null,
        frameworks: [],
        // TODO reset if validateParams method is called from another component
        validationComplete: false,
      };
    }

    async componentDidMount() {
      const { $stateParams } = this.props;
      const [projects, frameworks] = await Promise.all([
        getData(getApiUrl(repoEndpoint)),
        getData(getApiUrl(endpoints.frameworks)),
      ]);

      const updates = {
        ...processResponse(projects, 'projects'),
        ...processResponse(frameworks, 'frameworks'),
      };
      this.setState(updates, () => this.validateParams($stateParams));
    }

    updateParams = param => {
      const { $state } = this.props;
      const { transitionTo, current } = $state;
      transitionTo(current.name, param, {
        inherit: true,
        notify: false,
      });
    };

    errorMessage = (param, value) => `${param} ${value} is not valid`;

    findParam = (param, value, list, errors) => {
      const valid = list.find(item => item.name || item === value);

      if (valid === undefined) {
        errors.push(this.errorMessage(param, value));
      }
      return errors;
    };

    async checkRevisions(params) {
      if (!params.originalRevision) {
        const newResultResponse = await this.verifyRevision(
          params.newProject,
          params.newRevision,
          'newResultSet',
        );
        return this.setState({
          ...params,
          ...newResultResponse,
          validationComplete: true,
        });
      }
      const [newResultResponse, origResultResponse] = await Promise.all([
        this.verifyRevision(
          params.newProject,
          params.newRevision,
          'newResultSet',
        ),
        this.verifyRevision(
          params.originalProject,
          params.originalRevision,
          'originalResultSet',
        ),
      ]);

      this.setState({
        ...params,
        ...newResultResponse,
        ...origResultResponse,
        validationComplete: true,
      });
    }

    async verifyRevision(project, revision, resultSetName) {
      const { data, failureStatus } = await PushModel.getList({
        repo: project,
        commit_revision: revision,
      });

      if (failureStatus) {
        return {
          errorMessages: [`Error fetching revision ${revision}: ${data}`],
        };
      }
      if (!data.results.length) {
        return { errorMessages: [`No results found for revision ${revision}`] };
      }

      return { [resultSetName]: data.results[0] };
    }

    validateParams(params) {
      const { projects, frameworks } = this.state;
      let errors = [];

      for (const [param, value] of Object.entries(params)) {
        if (!value && requiredParams.has(param)) {
          errors.push(`${param} is required`);
          continue;
        }

        if (value === 'undefined') {
          errors.push(this.errorMessage(param, value));
          continue;
        }

        if (param.indexOf('Project') !== -1 && projects.length) {
          errors = this.findParam(param, value, projects, errors);
        }

        if (param === 'framework' && value && frameworks.length) {
          errors = this.findParam(param, value, frameworks, errors);
        }

        if (param === 'status' && value) {
          errors = this.findParam(
            param,
            parseInt(value, 10),
            Object.values(summaryStatusMap),
            errors,
          );
        }
      }

      if (errors.length) {
        return this.setState({ errorMessages: errors });
      }
      if (verifyRevisions) {
        return this.checkRevisions(params);
      }
      this.setState({
        ...params,
        validationComplete: true,
      });
    }

    render() {
      const updateParams = { updateParams: this.updateParams };
      const validatedProps = {
        ...this.state,
        ...updateParams,
      };
      const { validationComplete, errorMessages } = this.state;

      return (
        <React.Fragment>
          {!validationComplete && errorMessages.length === 0 && (
            <div className="loading">
              <FontAwesomeIcon
                icon={faCog}
                size="4x"
                spin
                title="loading page, please wait"
              />
            </div>
          )}

          {errorMessages.length > 0 && (
            <Container className="pt-5 max-width-default">
              <ErrorMessages errorMessages={errorMessages} />
            </Container>
          )}

          {validationComplete && !errorMessages.length && (
            <WrappedComponent validated={validatedProps} {...this.props} />
          )}
        </React.Fragment>
      );
    }
  }

  Validation.propTypes = {
    $stateParams: PropTypes.shape({}).isRequired,
    $state: PropTypes.shape({
      transitionTo: PropTypes.func,
      current: PropTypes.shape({}),
    }).isRequired,
  };

  return Validation;
};

export default withValidation;
