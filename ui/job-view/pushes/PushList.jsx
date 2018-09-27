import React from 'react';
import PropTypes from 'prop-types';
import isEqual from 'lodash/isEqual';

import { thDefaultRepo, thEvents, thMaxPushFetchSize } from '../../helpers/constants';
import { reloadOnChangeParameters } from '../../helpers/filter';
import { findJobInstance } from '../../helpers/job';
import {
  getAllUrlParams,
  getQueryString,
  getUrlParam,
  setLocation,
  setUrlParam,
} from '../../helpers/location';
import { parseQueryParams } from '../../helpers/url';
import ErrorBoundary from '../../shared/ErrorBoundary';
import Push from './Push';
import PushLoadErrors from './PushLoadErrors';
import { withTheme } from '../context/Theme';

class PushList extends React.Component {
  constructor(props) {
    super(props);
    const { $injector, repoName } = this.props;

    this.$rootScope = $injector.get('$rootScope');
    this.thNotify = $injector.get('thNotify');
    this.ThResultSetStore = $injector.get('ThResultSetStore');

    this.ThResultSetStore.initRepository(repoName);

    this.skipNextPageReload = false;

    this.state = {
      pushList: [],
      loadingPushes: true,
      jobsReady: false,
      notificationSupported: 'Notification' in window,
      cachedReloadTriggerParams: this.getNewReloadTriggerParams(),
    };

    // get our first set of resultsets
    const fromchange = getUrlParam('fromchange');
    // If we have a ``fromchange`` url param.  We don't want to limit ourselves
    // to the default of 10 pushes on the first load.
    this.ThResultSetStore.fetchPushes(
      fromchange ? thMaxPushFetchSize : this.ThResultSetStore.defaultPushCount);
  }

  componentWillMount() {
    this.getNextPushes = this.getNextPushes.bind(this);
    this.handleUrlChanges = this.handleUrlChanges.bind(this);
    this.updateUrlFromchange = this.updateUrlFromchange.bind(this);

    this.pushesLoadedUnlisten = this.$rootScope.$on(thEvents.pushesLoaded, () => {
      const pushList = this.ThResultSetStore.getPushArray();
      this.setState({ pushList, loadingPushes: false });
    });

    this.jobsLoadedUnlisten = this.$rootScope.$on(thEvents.jobsLoaded, () => {
      const pushList = [...this.ThResultSetStore.getPushArray()];

      this.setState({ pushList, jobsReady: true });
    });

    this.jobsClassifiedUnlisten = this.$rootScope.$on(
      thEvents.jobsClassified, (ev, { jobs }) => {
        Object.values(jobs).forEach((job) => {
          findJobInstance(job.id).props.job.failure_classification_id = job.failure_classification_id;
        });
        this.setState({ pushList: [...this.state.pushList] });
      },
    );
    window.addEventListener('hashchange', this.handleUrlChanges, false);
  }

  componentWillUnmount() {
    this.pushesLoadedUnlisten();
    this.jobsLoadedUnlisten();
    this.jobsLoadedUnlisten();
    this.jobsClassifiedUnlisten();
    window.removeEventListener('hashchange', this.handleUrlChanges, false);
  }

  getNextPushes(count) {
    const params = getAllUrlParams();

    this.setState({ loadingPushes: true });
    if (params.has('revision')) {
      // We are viewing a single revision, but the user has asked for more.
      // So we must replace the ``revision`` param with ``tochange``, which
      // will make it just the top of the range.  We will also then get a new
      // ``fromchange`` param after the fetch.
      this.skipNextPageReload = true;
      const revision = params.get('revision');
      params.delete('revision');
      params.set('tochange', revision);
      setLocation(params);
    } else if (params.has('startdate')) {
      // We are fetching more pushes, so we don't want to limit ourselves by
      // ``startdate``.  And after the fetch, ``startdate`` will be invalid,
      // and will be replaced on the location bar by ``fromchange``.
      this.skipNextPageReload = true;
      setUrlParam('startdate', null);
    }
    this.ThResultSetStore.fetchPushes(count).then(this.updateUrlFromchange);
  }

  getNewReloadTriggerParams() {
    const params = parseQueryParams(getQueryString());

    return reloadOnChangeParameters.reduce(
      (acc, prop) => (params[prop] ? { ...acc, [prop]: params[prop] } : acc), {});
  }

  // reload the page if certain params were changed in the URL.  For
  // others, such as filtering, just re-filter without reload.

  // the param ``skipNextPageReload`` will cause a single run through
  // this code to skip the page reloading even on a param that would
  // otherwise trigger a page reload.  This is useful for a param that
  // is being changed by code in a specific situation as opposed to when
  // the user manually edits the URL location bar.
  handleUrlChanges() {
    const { cachedReloadTriggerParams } = this.state;
    const newReloadTriggerParams = this.getNewReloadTriggerParams();
    // if we are just setting the repo to the default because none was
    // set initially, then don't reload the page.
    const defaulting = newReloadTriggerParams.repo === thDefaultRepo &&
      !cachedReloadTriggerParams.repo;

    if (!defaulting && cachedReloadTriggerParams &&
      !isEqual(newReloadTriggerParams, cachedReloadTriggerParams) &&
      !this.skipNextPageReload) {
      location.reload();
    } else {
      this.setState({ cachedReloadTriggerParams: newReloadTriggerParams });
    }

    this.skipNextPageReload = false;
  }

  updateUrlFromchange() {
    // since we fetched more pushes, we need to persist the
    // push state in the URL.
    const rsArray = this.ThResultSetStore.getPushArray();
    const updatedLastRevision = rsArray[rsArray.length - 1].revision;

    if (getUrlParam('fromchange') !== updatedLastRevision) {
      this.skipNextPageReload = true;
      setUrlParam('fromchange', updatedLastRevision);
    }
  }

  render() {
    const {
      $injector, user, repoName, revision, currentRepo, filterModel, globalContentClass,
    } = this.props;
    const { pushList, loadingPushes, jobsReady, notificationSupported } = this.state;
    const { isLoggedIn } = user;

    return (
      <div id="th-global-content" className={globalContentClass} data-job-clear-on-click>
        <span className="th-view-content" tabIndex={-1}>
          <div>
            {jobsReady && <span className="hidden ready" />}
            {repoName && pushList.map(push => (
              <ErrorBoundary
                errorClasses="pl-2 border-top border-bottom border-dark d-block"
                message={`Error on push with revision ${push.revision}: `}
                key={push.id}
              >
                <Push
                  push={push}
                  isLoggedIn={isLoggedIn || false}
                  currentRepo={currentRepo}
                  repoName={repoName}
                  filterModel={filterModel}
                  $injector={$injector}
                  notificationSupported={notificationSupported}
                />
              </ErrorBoundary>
            ))}
            {loadingPushes &&
              <div
                className="progress active progress-bar progress-bar-striped"
                role="progressbar"
              />
            }
            {pushList.length === 0 && !loadingPushes &&
              <PushLoadErrors
                loadingPushes={loadingPushes}
                currentRepo={currentRepo}
                repoName={repoName}
                revision={revision}
              />
            }
            <div className="card card-body get-next" data-job-clear-on-click>
              <span>get next:</span>
              <div className="btn-group">
                {[10, 20, 50].map(count => (
                  <div
                    className="btn btn-light-bordered"
                    onClick={() => (this.getNextPushes(count))}
                    key={count}
                  >{count}</div>
                ))}
              </div>
            </div>
          </div>
        </span>
      </div>
    );
  }
}

PushList.propTypes = {
  $injector: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
  user: PropTypes.object.isRequired,
  filterModel: PropTypes.object.isRequired,
  globalContentClass: PropTypes.string.isRequired,
  revision: PropTypes.string,
  currentRepo: PropTypes.object,
};

PushList.defaultProps = {
  revision: null,
  currentRepo: {},
};

export default withTheme(PushList);
