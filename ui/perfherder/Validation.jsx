import React from 'react';
import PropTypes from 'prop-types';
import { Container } from 'reactstrap';

import {
  parseQueryParams,
  createQueryParams,
  updateQueryParams,
} from '../helpers/url';
import PushModel from '../models/push';
import ErrorMessages from '../shared/ErrorMessages';
import LoadingSpinner from '../shared/LoadingSpinner';

import { summaryStatusMap } from './constants';

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
        newRevision: null,
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
      this.validateParams(parseQueryParams(this.props.location.search));
    }

    shouldComponentUpdate(prevProps) {
      const { location } = this.props;

      return location.hash === prevProps.location.hash;
    }

    componentDidUpdate(prevProps) {
      const { location } = this.props;

      if (location.search !== prevProps.location.search) {
        // delete from state params the ones
        this.validateParams(parseQueryParams(location.search));
      }
    }

    updateParams = (params) => {
      const { location, history } = this.props;
      const newParams = { ...parseQueryParams(location.search), ...params };
      const queryString = createQueryParams(newParams);

      updateQueryParams(queryString, history, location);
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
      const validatedProps = {
        ...this.state,
        ...updateParams,
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
  };

  return Validation;
};

export default withValidation;
