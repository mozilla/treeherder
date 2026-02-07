import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Container } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router';

import { parseQueryParams, createQueryParams } from '../helpers/url';
import PushModel from '../models/push';
import ErrorMessages from '../shared/ErrorMessages';
import LoadingSpinner from '../shared/LoadingSpinner';

import { summaryStatusMap } from './perf-helpers/constants';

const withValidation = ({ requiredParams }, verifyRevisions = true) => (
  WrappedComponent,
) => {
  const Validation = (props) => {
    const location = useLocation();
    const navigate = useNavigate();

    const [state, setState] = useState({
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
    });

    const errorMessage = useCallback(
      (param, value) => `${param} ${value} is not valid`,
      [],
    );

    const findParam = useCallback(
      (param, value, list, errors) => {
        const valid = list.find((item) => item.name || item === value);

        if (valid === undefined) {
          errors.push(errorMessage(param, value));
        }
        return errors;
      },
      [errorMessage],
    );

    const verifyRevision = useCallback(
      async (project, revision, resultSetName) => {
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
      },
      [],
    );

    const checkRevisions = useCallback(
      async (params) => {
        if (!params.originalRevision) {
          const newResultResponse = await verifyRevision(
            params.newProject,
            params.newRevision,
            'newResultSet',
          );
          setState((prev) => ({
            ...prev,
            ...params,
            ...newResultResponse,
            validationComplete: true,
          }));
          return;
        }
        const [newResultResponse, origResultResponse] = await Promise.all([
          verifyRevision(params.newProject, params.newRevision, 'newResultSet'),
          verifyRevision(
            params.originalProject,
            params.originalRevision,
            'originalResultSet',
          ),
        ]);

        setState((prev) => ({
          ...prev,
          ...params,
          ...newResultResponse,
          ...origResultResponse,
          validationComplete: true,
        }));
      },
      [verifyRevision],
    );

    const updateParams = useCallback(
      (params, paramsToBeRemoved = []) => {
        const newParams = {
          ...parseQueryParams(location.search),
          ...params,
        };
        if (paramsToBeRemoved.length !== 0)
          paramsToBeRemoved.forEach((param) => {
            delete newParams[param];
          });
        const queryString = createQueryParams(newParams);
        navigate({ search: queryString });
      },
      [location.search, navigate],
    );

    const validateParams = useCallback(
      (params) => {
        const { projects, frameworks } = props;
        let errors = [];

        for (const [param, value] of Object.entries(params)) {
          if (!value && requiredParams.has(param)) {
            errors.push(`${param} is required`);
            continue;
          }

          if (value === 'undefined') {
            errors.push(errorMessage(param, value));
            continue;
          }

          if (param.indexOf('Project') !== -1 && projects.length) {
            errors = findParam(param, value, projects, errors);
          }

          if (param === 'framework' && value && frameworks.length) {
            errors = findParam(param, value, frameworks, errors);
          }

          if (param === 'status' && value) {
            errors = findParam(
              param,
              parseInt(value, 10),
              Object.values(summaryStatusMap),
              errors,
            );
          }
        }

        if (errors.length) {
          setState((prev) => ({ ...prev, errorMessages: errors }));
          return;
        }
        if (verifyRevisions) {
          checkRevisions(params);
          return;
        }
        setState((prev) => ({
          ...prev,
          ...params,
          validationComplete: true,
        }));
        updateParams({ ...params });
      },
      [props, errorMessage, findParam, checkRevisions, updateParams],
    );

    // Initial validation on mount
    useEffect(() => {
      validateParams(parseQueryParams(location.search));
    }, []);

    // Re-validate on location change
    useEffect(() => {
      validateParams(parseQueryParams(location.search));
    }, [location.search]);

    const validatedProps = {
      ...state,
      updateParams,
    };
    const { validationComplete, errorMessages } = state;

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
          <WrappedComponent
            validated={validatedProps}
            location={location}
            navigate={navigate}
            {...props}
          />
        )}
      </React.Fragment>
    );
  };

  Validation.propTypes = {
    projects: PropTypes.arrayOf(PropTypes.shape({})),
    frameworks: PropTypes.arrayOf(PropTypes.shape({})),
  };

  Validation.defaultProps = {
    projects: [],
    frameworks: [],
  };

  return Validation;
};

export default withValidation;
