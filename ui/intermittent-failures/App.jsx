import React from 'react';
import { HashRouter, Route, Switch, Redirect } from 'react-router-dom';

import MainView from './MainView';
import BugDetailsView from './BugDetailsView';

function App() {
  return (
    <HashRouter>
      <main>
        <Switch>
          <Route exact path="/main" component={MainView} />
          <Route path="/main?startday=:startday&endday=:endday&tree=:tree" component={MainView} />
          <Route path="/bugdetails" component={BugDetailsView} />
          <Route path="/bugdetails?startday=:startday&endday=:endday&tree=:tree&bug=bug" component={BugDetailsView} />
          <Redirect from="/" to="/main" />
        </Switch>
      </main>
    </HashRouter>
  );
}

export default App;
