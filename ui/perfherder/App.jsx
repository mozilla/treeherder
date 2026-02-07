import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { Container } from 'react-bootstrap';

import { getData, processResponse } from '../helpers/http';
import { getApiUrl, repoEndpoint } from '../helpers/url';
import InfraCompareView from '../infra-compare/InfraCompare';
import ErrorMessages from '../shared/ErrorMessages';

import { endpoints } from './perf-helpers/constants';
import GraphsView from './graphs/GraphsView';
import AlertsView from './alerts/AlertsView';
import TestsView from './tests/TestsView';
import Navigation from './Navigation';

import '../css/react-table.css';
import '../css/perf.css';

const App = () => {
  const [projects, setProjects] = useState([]);
  const [frameworks, setFrameworks] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [performanceTags, setPerformanceTags] = useState([]);
  const [user, setUser] = useState({});
  const [errorMessages, setErrorMessages] = useState([]);
  const [compareData, setCompareData] = useState([]);

  const updateAppState = useCallback((state) => {
    if (state.projects !== undefined) setProjects(state.projects);
    if (state.frameworks !== undefined) setFrameworks(state.frameworks);
    if (state.platforms !== undefined) setPlatforms(state.platforms);
    if (state.performanceTags !== undefined)
      setPerformanceTags(state.performanceTags);
    if (state.user !== undefined) setUser(state.user);
    if (state.errorMessages !== undefined)
      setErrorMessages(state.errorMessages);
    if (state.compareData !== undefined) setCompareData(state.compareData);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const [
        projectsResp,
        frameworksResp,
        performanceTagsResp,
      ] = await Promise.all([
        getData(getApiUrl(repoEndpoint)),
        getData(getApiUrl(endpoints.frameworks)),
        getData(getApiUrl(endpoints.performanceTags)),
      ]);

      const errors = [];
      const updates = {
        ...processResponse(projectsResp, 'projects', errors),
        ...processResponse(frameworksResp, 'frameworks', errors),
        ...processResponse(performanceTagsResp, 'performanceTags', errors),
      };

      updateAppState({ ...updates, errorMessages: errors });
    };

    fetchData();
  }, [updateAppState]);

  const notify = useCallback((message) => {
    setErrorMessages([message]);
  }, []);

  const dataLoaded =
    projects.length > 0 && frameworks.length > 0 && performanceTags.length > 0;

  return (
    <React.Fragment>
      <Navigation user={user} setUser={setUser} notify={notify} />
      {dataLoaded && (
        <main id="perf-main">
          {errorMessages.length > 0 && (
            <Container className="pt-6 max-width-default">
              <ErrorMessages errorMessages={errorMessages} />
            </Container>
          )}
          <Routes>
            <Route
              path="alerts/*"
              element={
                <AlertsView
                  user={user}
                  projects={projects}
                  frameworks={frameworks}
                  performanceTags={performanceTags}
                />
              }
            />
            <Route
              path="graphs/*"
              element={
                <GraphsView
                  user={user}
                  projects={projects}
                  frameworks={frameworks}
                />
              }
            />
            <Route
              path="infracompare/*"
              element={
                <InfraCompareView
                  user={user}
                  projects={projects}
                  frameworks={frameworks}
                  compareData={compareData}
                  updateAppState={updateAppState}
                />
              }
            />
            <Route
              path="tests/*"
              element={
                <TestsView
                  projects={projects}
                  frameworks={frameworks}
                  platforms={platforms}
                  updateAppState={updateAppState}
                />
              }
            />
            <Route
              path="/"
              element={<Navigate to="alerts?hideDwnToInv=1&page=1" replace />}
            />
          </Routes>
        </main>
      )}
    </React.Fragment>
  );
};

export default App;
