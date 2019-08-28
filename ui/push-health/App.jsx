import React from 'react';
import PropTypes from 'prop-types';
import { hot } from 'react-hot-loader/root';
import { BrowserRouter, Route, Switch } from 'react-router-dom';

import RepositoryModel from '../models/repository';
import { getRepo } from '../helpers/location';

import NotFound from './NotFound';
import Health from './Health';

function hasProps(search) {
  const params = new URLSearchParams(search);

  return params.get('repo') && params.get('revision');
}

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      currentRepo: null,
    };
  }

  componentDidMount() {
    const repoName = getRepo();

    if (repoName) {
      RepositoryModel.getList().then(repos => {
        const newRepo = repos.find(repo => repo.name === repoName);

        this.setState({ currentRepo: newRepo });
      });
    }
  }

  render() {
    const { currentRepo } = this.state;

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
                    <Health currentRepo={currentRepo} {...props} />
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
  }
}

App.propTypes = {
  location: PropTypes.object,
};

App.defaultProps = {
  location: null,
};

export default hot(App);
