import React from 'react';
import { hot } from 'react-hot-loader/root';
import { BrowserRouter, Route, Switch } from 'react-router-dom';

import NotFound from './NotFound';
import Health from './Health';

function hasProps(search) {
  const params = new URLSearchParams(search);

  return params.get('repo') && params.get('revision');
}

const App = () => {
  return (
    <BrowserRouter>
      <div>
        <div>
          <Switch>
            <Route
              exact
              path="/pushhealth.html"
              render={props =>
                hasProps(props.location.search) ? (
                  <Health {...props} />
                ) : (
                  <NotFound {...props} />
                )
              }
            />
            <Route name="notfound" component={NotFound} />
          </Switch>
        </div>
      </div>
    </BrowserRouter>
  );
};

export default hot(App);
