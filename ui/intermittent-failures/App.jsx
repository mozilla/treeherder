import React from 'react';
import { HashRouter, Route, Switch, Redirect } from 'react-router-dom';

import MainView from './MainView';
import BugDetailsView from './BugDetailsView';

class App extends React.Component {
    constructor(props) {
    super(props);
    this.updateAppState = this.updateAppState.bind(this);

    // keep track of the mainviews graph data so the API won't be
    // called again when navigating back from bugdetailsview;
    // table API will be called every time it mounts.
    this.state = { graphData: null };
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
                updateAppState={this.updateAppState}
              />)}
            />)
            (<Route
              path="/main?startday=:startday&endday=:endday&tree=:tree"
              render={props =>
                (<MainView
                  {...props}
                  mainGraphData={this.state.graphData}
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

export default App;
