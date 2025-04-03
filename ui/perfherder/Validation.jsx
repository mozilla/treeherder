import React from 'react';
import PropTypes from 'prop-types';
import { Container } from 'reactstrap';

import { parseQueryParams, createQueryParams } from '../helpers/url';
import PushModel from '../models/push';
import ErrorMessages from '../shared/ErrorMessages';
import LoadingSpinner from '../shared/LoadingSpinner';

import { summaryStatusMap } from './perf-helpers/constants';

const withValidation = ({ requiredParams }, verifyRevisions = true) => (
  WrappedComponent,
) => {
  class Validation extends React.Component {
    constructor(props) {
      super(props);

      this.state = {
        originalProject: null,
        newProject: null,
        originalRevision: null,
        originalHash: null,
        newRevision: null,
        newHash: null,
        originalSignature: null,
        newSignature: null,
        errorMessages: [],
        originalResultSet: null,
        newResultSet: null,
        selectedTimeRange: null,
        framework: null,
        validationComplete: false,
      };
    }

    async componentDidMount() {
      this.validateParams(parseQueryParams(this.props.history.location.search));
    }

    componentDidUpdate(prevProps) {
      const { history } = this.props;

      // Using location instead of history requires an extra click when
      // using the back button to go back to previous location
      if (history.location.search !== prevProps.history.location.search) {
        // delete from state params the ones
        this.validateParams(parseQueryParams(history.location.search));
      }
    }

    updateParams = (params, paramsToBeRemoved = []) => {
      const { history, location } = this.props;

      const newParams = {
        ...parseQueryParams(location.search),
        ...params,
      };
      if (paramsToBeRemoved.length !== 0)
        paramsToBeRemoved.forEach((param) => {
          delete newParams[param];
        });
      const queryString = createQueryParams(newParams);
      history.push({ search: queryString });
    };

    errorMessage = (param, value) => `${param} ${value} is not valid`;

    findParam = (param, value, list, errors) => {
      const valid = list.find((item) => item.name || item === value);

      if (valid === undefined) {
        errors.push(this.errorMessage(param, value));
      }
      return errors;
    };

    async checkRevisions(params) {
      let findOriginalRevision = params.originalRevision;
      let findNewRevision = params.newRevision;
      if (params.newRevision == null && params.newHash) {
        const newRevision = await PushModel.get_commit_from_hash({
          repo: params.newProject,
          hash: params.newHash,
        });
        findNewRevision = newRevision.data.revision;
        params.newRevision = findNewRevision;
      }
      if (params.originalRevision == null && params.originalHash) {
        const originalRevision = await PushModel.get_commit_from_hash({
          repo: params.originalProject,
          hash: params.originalHash,
        });
        findOriginalRevision = originalRevision.data.revision;
        params.originalRevision = findOriginalRevision;
      }
      if (!findOriginalRevision && !params.originalHash) {
        const newResultResponse = await this.verifyRevision(
          params.newProject,
          findNewRevision,
          'newResultSet',
        );
        return this.setState({
          ...params,
          ...newResultResponse,
          validationComplete: true,
        });
      }
      const [newResultResponse, origResultResponse] = await Promise.all([
        this.verifyRevision(params.newProject, findNewRevision, 'newResultSet'),
        this.verifyRevision(
          params.originalProject,
          findOriginalRevision,
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
        return {
          errorMessages: [`No results found for revision ${revision}`],
        };
      }

      return { [resultSetName]: data.results[0] };
    }

    validateParams(params) {
      const { projects, frameworks } = this.props;
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
      this.setState(
        {
          ...params,
          validationComplete: true,
        },
        this.updateParams({ ...params }),
      );
    }

    render() {
      const updateParams = { updateParams: this.updateParams };
      const removeParams = { removeParams: this.removeParams };
      const validatedProps = {
        ...this.state,
        ...updateParams,
        ...removeParams,
      };
      const { validationComplete, errorMessages } = this.state;

      return (
        <React.Fragment>
          {!validationComplete && errorMessages.length === 0 && (
            <LoadingSpinner />
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
    location: PropTypes.shape({}).isRequired,
    history: PropTypes.shape({}).isRequired,
  };

  return Validation;
};

export default withValidation;
