import React from 'react';
import {
  useRouteMatch,
  Route,
  Switch,
  Redirect,
  BrowserRouter,
} from 'react-router-dom';
import { Container } from 'reactstrap';
import { hot } from 'react-hot-loader/root';

import ErrorMessages from '../shared/ErrorMessages';

import MainView from './MainView';
import BugDetailsView from './BugDetailsView';

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
    const { path } = useRouteMatch();
    console.log(path);
    return (
      // <main>
      //   {errorMessages.length > 0 && (
      //     <Container className="pt-5 max-width-default">
      //       <ErrorMessages errorMessages={errorMessages} />
      //     </Container>
      //   )}
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
              setUser={(user) => this.setState({ user })}
              notify={(message) => this.setState({ errorMessages: [message] })}
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
        {/* <Route path="/bugdetails" component={BugDetailsView} />
            <Route
              path="/bugdetails?startday=:startday&endday=:endday&tree=:tree&bug=bug"
              component={BugDetailsView}
            /> */}
        <Redirect from={`${path}/`} to={`${path}/main`} />
      </Switch>
      // </main>
    );
  }
}

export default hot(IntermittentFailuresApp);
