import React from 'react';
import { HashRouter, Route, Switch, Redirect } from 'react-router-dom';
import { hot } from 'react-hot-loader/root';
import { Container } from 'reactstrap';

import { getData, processResponse } from '../helpers/http';
import { getApiUrl, repoEndpoint } from '../helpers/url';
import ErrorMessages from '../shared/ErrorMessages';

import { endpoints } from './constants';
import GraphsView from './graphs/GraphsView';
import AlertsView from './alerts/AlertsView';
import HealthView from './health/HealthView';
import CompareView from './compare/CompareView';
import CompareSelectorView from './compare/CompareSelectorView';
import CompareSubtestsView from './compare/CompareSubtestsView';
import CompareSubtestDistributionView from './compare/CompareSubtestDistributionView';
import Navigation from './Navigation';

class App extends React.Component {
  constructor(props) {
    super(props);

    // store alerts and compare view data so the API's won't be
    // called again when navigating back from related views.
    this.state = {
      projects: [],
      frameworks: [],
      platforms: [],
      user: {},
      errorMessages: [],
      compareData: [],
    };
  }

  async componentDidMount() {
    const [projects, frameworks] = await Promise.all([
      getData(getApiUrl(repoEndpoint)),
      getData(getApiUrl(endpoints.frameworks)),
    ]);

    const errorMessages = [];
    const updates = {
      ...processResponse(projects, 'projects', errorMessages),
      ...processResponse(frameworks, 'frameworks', errorMessages),
    };

    this.setState(updates);
  }

  updateAppState = state => {
    this.setState(state);
  };

  render() {
    const {
      user,
      projects,
      frameworks,
      platforms,
      errorMessages,
      compareData,
    } = this.state;

    return (
      <HashRouter>
        <Navigation
          user={user}
          setUser={user => this.setState({ user })}
          notify={message => this.setState({ errorMessages: [message] })}
        />
        {projects.length > 0 && frameworks.length > 0 && (
          <main className="pt-5">
            <Switch>
              <Route
                exact
                path="/alerts"
                render={props => (
                  <AlertsView
                    {...props}
                    user={user}
                    projects={projects}
                    frameworks={frameworks}
                  />
                )}
              />
              <Route
                path="/alerts?id=:id&status=:status&framework=:framework&filter=:filter&hideImprovements=:hideImprovements&hideDwnToInv=:hideDwnToInv&page=:page"
                render={props => (
                  <AlertsView
                    {...props}
                    user={user}
                    projects={projects}
                    frameworks={frameworks}
                  />
                )}
              />
              <Route
                path="/graphs"
                render={props => (
                  <GraphsView
                    {...props}
                    user={user}
                    projects={projects}
                    frameworks={frameworks}
                  />
                )}
              />
              <Route
                path="/graphs?timerange=:timerange&series=:series&highlightedRevisions=:highlightedRevisions&highlightAlerts=:highlightAlerts&zoom=:zoom&selected=:selected"
                render={props => (
                  <GraphsView
                    {...props}
                    user={user}
                    projects={projects}
                    frameworks={frameworks}
                  />
                )}
              />
              <Route
                path="/comparechooser"
                render={props => (
                  <CompareSelectorView
                    {...props}
                    user={user}
                    projects={projects}
                    frameworks={frameworks}
                  />
                )}
              />
              <Route
                path="/comparechooser?originalProject=:originalProject&originalRevision=:originalRevision&newProject=:newProject&newRevision=:newRevision"
                render={props => (
                  <CompareSelectorView
                    {...props}
                    user={user}
                    projects={projects}
                    frameworks={frameworks}
                  />
                )}
              />
              <Route
                path="/compare"
                render={props => (
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
                path="/compare?originalProject=:originalProject&originalRevision=:originalRevison&newProject=:newProject&newRevision=:newRevision&framework=:framework&showOnlyComparable=:showOnlyComparable&showOnlyImportant=:showOnlyImportant&showOnlyConfident=:showOnlyConfident&selectedTimeRange=:selectedTimeRange&showOnlyNoise=:showOnlyNoise"
                render={props => (
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
                path="/comparesubtest"
                render={props => (
                  <CompareSubtestsView
                    {...props}
                    user={user}
                    projects={projects}
                    frameworks={frameworks}
                  />
                )}
              />
              <Route
                path="/comparesubtest?originalProject=:originalProject&originalRevision=:originalRevision&newProject=:newProject&newRevision=:newRevision&originalSignature=:originalSignature&newSignature=:newSignature&framework=:framework&showOnlyComparable=:showOnlyComparable&showOnlyImportant=:showOnlyImportant&showOnlyConfident=:showOnlyConfident&selectedTimeRange=:selectedTimeRange&showOnlyNoise=:showOnlyNoise"
                render={props => (
                  <CompareSubtestsView
                    {...props}
                    user={user}
                    projects={projects}
                    frameworks={frameworks}
                  />
                )}
              />
              <Route
                path="/comparesubtestdistribution"
                render={props => (
                  <CompareSubtestDistributionView
                    {...props}
                    user={user}
                    projects={projects}
                    frameworks={frameworks}
                  />
                )}
              />
              <Route
                path="/comparesubtestdistribution?originalProject=:originalProject&newProject=:newProject&originalRevision=:originalRevision&newRevision=:newRevision&originalSubtestSignature=:originalSubtestSignature&newSubtestSignature=:newSubtestSignature"
                render={props => (
                  <CompareSubtestDistributionView
                    {...props}
                    user={user}
                    projects={projects}
                    frameworks={frameworks}
                  />
                )}
              />
              <Route
                path="/health"
                render={props => (
                  <HealthView
                    {...props}
                    projects={projects}
                    frameworks={frameworks}
                    platforms={platforms}
                    updateAppState={this.updateAppState}
                  />
                )}
              />
              <Route
                path="/health?framework=:framework"
                render={props => (
                  <HealthView
                    {...props}
                    projects={projects}
                    frameworks={frameworks}
                    platforms={platforms}
                    updateAppState={this.updateAppState}
                  />
                )}
              />
              <Redirect from="/" to="/alerts?hideDwnToInv=1" />
            </Switch>
          </main>
        )}
        {errorMessages.length > 0 && (
          <Container className="pt-5 max-width-default">
            <ErrorMessages errorMessages={errorMessages} />
          </Container>
        )}
      </HashRouter>
    );
  }
}

export default hot(App);
