import React from 'react';
import { hot } from 'react-hot-loader/root';
import { Route, Switch } from 'react-router-dom';

import NotFound from './NotFound';
import Health from './Health';
import Usage from './Usage';

import '../css/failure-summary.css';
import '../css/lazylog-custom-styles.css';
import '../css/treeherder-job-buttons.css';
import '../css/treeherder-notifications.css';
import './pushhealth.css';
import 'react-tabs/style/react-tabs.css';

function hasProps(search) {
  const params = new URLSearchParams(search);

  return params.get('repo') && params.get('revision');
}

const App = () => {
  return (
    <div>
      <div>
        <Switch>
          <Route
            path="/"
            render={(props) =>
              hasProps(props.location.search) ? (
                <Health {...props} />
              ) : (
                <Usage {...props} />
              )
            }
          />
          <Route name="notfound" component={NotFound} />
        </Switch>
      </div>
    </div>
  );
};

export default hot(App);
