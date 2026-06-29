import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { parseQueryParams, createQueryParams } from '../helpers/url';
import PushModel from '../models/push';

import { summaryStatusMap } from './perf-helpers/constants';

const initialState = {
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

const buildErrorMessage = (param, value) => `${param} ${value} is not valid`;

const findParam = (param, value, list, errors) => {
  const valid = list.find((item) => item.name || item === value);
  if (valid === undefined) {
    errors.push(buildErrorMessage(param, value));
  }
  return errors;
};

const verifyRevision = async (project, revision, resultSetName) => {
  const { data, failureStatus } = await PushModel.getList({
    repo: project,
    commit_revision: revision,
  });

  if (failureStatus) {
    return { errorMessages: [`Error fetching revision ${revision}: ${data}`] };
  }
  if (!data.results.length) {
    return { errorMessages: [`No results found for revision ${revision}`] };
  }
  return { [resultSetName]: data.results[0] };
};

const useValidation = ({
  requiredParams,
  verifyRevisions = true,
  projects = [],
  frameworks = [],
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState(initialState);

  const updateParams = useCallback(
    (params, paramsToBeRemoved = []) => {
      const newParams = {
        ...parseQueryParams(location.search),
        ...params,
      };
      paramsToBeRemoved.forEach((param) => {
        delete newParams[param];
      });
      navigate({ search: createQueryParams(newParams) });
    },
    [location.search, navigate],
  );

  // Keep the latest updateParams accessible inside the validation effect
  // without forcing it into the dep array (which would re-run on every
  // location change and fight with the hook's own navigate calls).
  const updateParamsRef = useRef(updateParams);
  updateParamsRef.current = updateParams;

  const projectsRef = useRef(projects);
  projectsRef.current = projects;
  const frameworksRef = useRef(frameworks);
  frameworksRef.current = frameworks;

  useEffect(() => {
    let cancelled = false;
    const params = parseQueryParams(location.search);
    let errors = [];

    for (const [param, value] of Object.entries(params)) {
      if (!value && requiredParams.has(param)) {
        errors.push(`${param} is required`);
        continue;
      }
      if (value === 'undefined') {
        errors.push(buildErrorMessage(param, value));
        continue;
      }
      if (param.indexOf('Project') !== -1 && projectsRef.current.length) {
        errors = findParam(param, value, projectsRef.current, errors);
      }
      if (param === 'framework' && value && frameworksRef.current.length) {
        errors = findParam(param, value, frameworksRef.current, errors);
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
      return undefined;
    }

    if (verifyRevisions) {
      (async () => {
        const responses = params.originalRevision
          ? await Promise.all([
              verifyRevision(
                params.newProject,
                params.newRevision,
                'newResultSet',
              ),
              verifyRevision(
                params.originalProject,
                params.originalRevision,
                'originalResultSet',
              ),
            ])
          : [
              await verifyRevision(
                params.newProject,
                params.newRevision,
                'newResultSet',
              ),
            ];

        if (cancelled) return;
        const merged = responses.reduce((acc, r) => ({ ...acc, ...r }), {});
        setState((prev) => ({
          ...prev,
          ...params,
          ...merged,
          validationComplete: true,
        }));
      })();
      return () => {
        cancelled = true;
      };
    }

    setState((prev) => ({
      ...prev,
      ...params,
      validationComplete: true,
    }));
    updateParamsRef.current({ ...params });
    return undefined;
  }, [location.search, requiredParams, verifyRevisions]);

  const { validationComplete, errorMessages } = state;
  const validated = { ...state, updateParams };

  return {
    validated,
    isLoading: !validationComplete && errorMessages.length === 0,
    errorMessages,
  };
};

export default useValidation;
