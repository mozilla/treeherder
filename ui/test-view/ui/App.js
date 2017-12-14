import React from 'react';
import { BrowserRouter, Route, Switch } from 'react-router-dom';
import Navigation from './Navigation';
import Groups from './Groups';
import NotFound from './NotFound';

function hasProps(search) {
  const params = new URLSearchParams(search);

  return params.get('repo') && params.get('revision');
}

const App = () => (
  <BrowserRouter>
    <div>
      <Navigation />
      <main>
        <Switch>
          <Route exact path="/testview.html" render={props => (hasProps(props.location.search) ?
            <Groups {...props} /> :
            <NotFound {...props} />)} />
          <Route name="search" path="?revision=:revision&repo=:repo" handler={Groups} />
          <Route name="notfound" component={NotFound} />
        </Switch>
      </main>
    </div>
  </BrowserRouter>
);

export default App;
