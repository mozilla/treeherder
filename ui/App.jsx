import React from 'react';
import { Route, Switch, BrowserRouter } from 'react-router-dom';
import { hot } from 'react-hot-loader/root';

// import IntermittentFailuresApp from './intermittent-failures/App';

const App = () => (
  <BrowserRouter>
    <div>
      <Switch>
        <Route exact path="/">
          <Home />
        </Route>
        <Route exact path="/test">
          <div>hello!</div>
        </Route>
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
