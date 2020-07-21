import React from 'react';
import { Route, Switch, BrowserRouter } from 'react-router-dom';
import { hot } from 'react-hot-loader/root';

import IntermittentFailuresApp from './intermittent-failures/App';

// TODO
// Move user state to here and pass to all other apps

const App = () => (
  <BrowserRouter>
    <div>
      <Switch>
        <Route exact path="/">
          <Home />
        </Route>
        <Route
          path="/intermittent-failures"
          render={(props) => <IntermittentFailuresApp {...props} />}
        />
      </Switch>
    </div>
  </BrowserRouter>
);

function Home() {
  return (
    <div>
      <h2>Home</h2>
    </div>
  );
}

export default hot(App);
