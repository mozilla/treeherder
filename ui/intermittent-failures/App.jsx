import React from 'react';
import { HashRouter, Route, Switch, Redirect } from 'react-router-dom';
import { hot } from 'react-hot-loader';

import MainView from './MainView';
import BugDetailsView from './BugDetailsView';

class App extends React.Component {
    constructor(props) {
    super(props);
    this.updateAppState = this.updateAppState.bind(this);

    // keep track of the mainviews graph and table data so the API won't be
    // called again when navigating back from bugdetailsview.
    this.state = {
        graphData: null,
        tableData: null,
      };
  }

  updateAppState(state) {
    this.setState(state);
  }

  render() {
    return (
      <HashRouter>
        <main>
          <Switch>
            (<Route
              exact
              path="/main"
              render={props =>
              (<MainView
                {...props}
                mainGraphData={this.state.graphData}
                mainTableData={this.state.tableData}
                updateAppState={this.updateAppState}
              />)}
            />)
            (<Route
              path="/main?startday=:startday&endday=:endday&tree=:tree"
              render={props =>
                (<MainView
                  {...props}
                  mainGraphData={this.state.graphData}
                  mainTableData={this.state.tableData}
                  updateAppState={this.updateAppState}
                />)}
            />)
            <Route path="/bugdetails" component={BugDetailsView} />
            <Route path="/bugdetails?startday=:startday&endday=:endday&tree=:tree&bug=bug" component={BugDetailsView} />
            <Redirect from="/" to="/main" />
          </Switch>
        </main>
      </HashRouter>
    );
  }
}

export default hot(module)(App);
