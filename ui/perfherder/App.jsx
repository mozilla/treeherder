import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { hot } from 'react-hot-loader/root';
import { Container } from 'reactstrap';

import { getData, processResponse } from '../helpers/http';
import { getApiUrl, repoEndpoint } from '../helpers/url';
import InfraCompareView from '../infra-compare/InfraCompare';
import ErrorMessages from '../shared/ErrorMessages';

import { endpoints } from './perf-helpers/constants';
import GraphsView from './graphs/GraphsView';
import AlertsView from './alerts/AlertsView';
import TestsView from './tests/TestsView';
import CompareView from './compare/CompareView';
import CompareSelectorView from './compare/CompareSelectorView';
import CompareSubtestsView from './compare/CompareSubtestsView';
import CompareSubtestDistributionView from './compare/CompareSubtestDistributionView';
import Navigation from './Navigation';

import '../css/react-table.css';
import '../css/perf.css';

class App extends React.Component {
  constructor(props) {
    super(props);

    // store alerts and compare view data so the API's won't be
    // called again when navigating back from related views.
    this.state = {
      projects: [],
      frameworks: [],
      platforms: [],
      performanceTags: [],
      user: {},
      errorMessages: [],
      compareData: [],
    };
  }

  async componentDidMount() {
    const [projects, frameworks, performanceTags] = await Promise.all([
      getData(getApiUrl(repoEndpoint)),
      getData(getApiUrl(endpoints.frameworks)),
      getData(getApiUrl(endpoints.performanceTags)),
    ]);

    const errorMessages = [];
    const updates = {
      ...processResponse(projects, 'projects', errorMessages),
      ...processResponse(frameworks, 'frameworks', errorMessages),
      ...processResponse(performanceTags, 'performanceTags', errorMessages),
    };

    this.setState(updates);
  }

  updateAppState = (state) => {
    this.setState(state);
  };

  render() {
    const {
      user,
      projects,
      frameworks,
      performanceTags,
      platforms,
      errorMessages,
      compareData,
    } = this.state;
    const { path } = this.props.match;

    return (
      <React.Fragment>
        <Navigation
          user={user}
          setUser={(user) => this.setState({ user })}
          notify={(message) => this.setState({ errorMessages: [message] })}
        />
        {projects.length > 0 &&
          frameworks.length > 0 &&
          performanceTags.length > 0 && (
            <main className="pt-5">
              {errorMessages.length > 0 && (
                <Container className="pt-5 max-width-default">
                  <ErrorMessages errorMessages={errorMessages} />
                </Container>
              )}
              <Routes>
                <Route
                  path="alerts"
                  render={(props) => (
                    <AlertsView
                      {...props}
                      user={user}
                      projects={projects}
                      frameworks={frameworks}
                      performanceTags={performanceTags}
                    />
                  )}
                />
                <Route
                  path="graphs"
                  render={(props) => (
                    <GraphsView
                      {...props}
                      user={user}
                      projects={projects}
                      frameworks={frameworks}
                    />
                  )}
                />
                <Route
                  path="comparechooser"
                  render={(props) => (
                    <CompareSelectorView
                      {...props}
                      user={user}
                      projects={projects}
                      frameworks={frameworks}
                    />
                  )}
                />
                <Route
                  path="compare"
                  render={(props) => (
                    <CompareView
                      {...props}
                      user={user}
                      projects={projects}
                      frameworks={frameworks}
                      compareData={compareData}
                      updateAppState={this.updateAppState}
                    />
                  )}
                />
                <Route
                  path="infracompare"
                  render={(props) => (
                    <InfraCompareView
                      {...props}
                      user={user}
                      projects={projects}
                      frameworks={frameworks}
                      compareData={compareData}
                      updateAppState={this.updateAppState}
                    />
                  )}
                />
                <Route
                  path="comparesubtest"
                  render={(props) => (
                    <CompareSubtestsView
                      {...props}
                      user={user}
                      projects={projects}
                      frameworks={frameworks}
                    />
                  )}
                />
                <Route
                  path="comparesubtestdistribution"
                  render={(props) => (
                    <CompareSubtestDistributionView
                      {...props}
                      user={user}
                      projects={projects}
                      frameworks={frameworks}
                    />
                  )}
                />
                <Route
                  path="tests"
                  render={(props) => (
                    <TestsView
                      {...props}
                      projects={projects}
                      frameworks={frameworks}
                      platforms={platforms}
                      updateAppState={this.updateAppState}
                    />
                  )}
                />
                <Navigate
                  replace
                  from={`${path}/`}
                  to={`${path}/alerts?hideDwnToInv=1&page=1`}
                />
              </Routes>
            </main>
          )}
      </React.Fragment>
    );
  }
}

export default hot(App);
