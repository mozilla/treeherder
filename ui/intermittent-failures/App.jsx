import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
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
        <Routes>
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
                setUser={(user) => this.setState({ user })}
                notify={(message) =>
                  this.setState({ errorMessages: [message] })
                }
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
              />
            )}
          />
          <Route
            path="bugdetails"
            render={(props) => <BugDetailsView {...props} />}
          />
          <Route
            path="bugdetails?startday=:startday&endday=:endday&tree=:tree&failurehash=:failurehash&bug=bug"
            render={(props) => <BugDetailsView {...props} />}
          />
          <Navigate replace from={`${path}/`} to={`${path}/main`} />
        </Routes>
      </main>
    );
  }
}

export default hot(IntermittentFailuresApp);
