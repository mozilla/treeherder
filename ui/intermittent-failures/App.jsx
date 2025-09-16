import React from 'react';
import { Route, Switch, Redirect } from 'react-router-dom';
import { Container } from 'reactstrap';
import { hot } from 'react-hot-loader/root';

import ErrorMessages from '../shared/ErrorMessages';

import MainView from './MainView';
import BugDetailsView from './BugDetailsView';

import '../css/react-table.css';
import '../css/intermittent-failures.css';
import '../css/treeherder-base.css';

class IntermittentFailuresApp extends React.Component {
  constructor(props) {
    super(props);

    // keep track of the mainviews graph and table data so the API won't be
    // called again when navigating back from bugdetailsview.
    this.state = {
      graphData: null,
      tableData: null,
      user: {},
      errorMessages: [],
    };
  }

  updateAppState = (state) => {
    this.setState(state);
  };

  setUser = (user) => {
    this.setState({ user });
  };

  notify = (message) => {
    this.setState({ errorMessages: [message] });
  };

  render() {
    const { user, graphData, tableData, errorMessages } = this.state;
    const { path } = this.props.match;
    return (
      <main>
        {errorMessages.length > 0 && (
          <Container className="pt-5 max-width-default">
            <ErrorMessages errorMessages={errorMessages} />
          </Container>
        )}
        <Switch>
          <Route
            exact
            path={`${path}/main`}
            render={(props) => (
              <MainView
                {...props}
                mainGraphData={graphData}
                mainTableData={tableData}
                updateAppState={this.updateAppState}
                user={user}
                setUser={this.setUser}
                notify={this.notify}
              />
            )}
          />
          <Route
            path={`${path}/main?startday=:startday&endday=:endday&tree=:tree`}
            render={(props) => (
              <MainView
                {...props}
                mainGraphData={graphData}
                mainTableData={tableData}
                updateAppState={this.updateAppState}
                user={user}
                setUser={this.setUser}
                notify={this.notify}
              />
            )}
          />
          <Route
            path={`${path}/bugdetails`}
            render={(props) => (
              <BugDetailsView
                {...props}
                user={user}
                setUser={this.setUser}
                notify={this.notify}
              />
            )}
          />
          <Route
            path={`${path}/bugdetails?startday=:startday&endday=:endday&tree=:tree&bug=bug`}
            render={(props) => (
              <BugDetailsView
                {...props}
                user={user}
                setUser={this.setUser}
                notify={this.notify}
              />
            )}
          />
          <Redirect from={`${path}/`} to={`${path}/main`} />
        </Switch>
      </main>
    );
  }
}

export default hot(IntermittentFailuresApp);
