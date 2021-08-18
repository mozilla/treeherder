import { tcAuthCallbackUrl } from '../helpers/url';

export const tcClientIdMap = {
  'https://treeherder.mozilla.org': 'production',
  'https://treeherder.allizom.org': 'stage',
  'https://treeherder-prototype.herokuapp.com': 'dev',
  'http://localhost:5000': 'localhost-5000',
  'http://localhost:8000': 'localhost-8000',
  'https://treeherder-taskcluster-staging.herokuapp.com': 'taskcluster-staging',
  'https://treeherder-prototype2.herokuapp.com': 'dev2',
};

export const clientId = `treeherder-${
  tcClientIdMap[window.location.origin]
}-client`;

export const redirectURI = `${window.location.origin}${tcAuthCallbackUrl}`;

export const errorMessage = 'Unable to retrieve your Taskcluster credentials.';

export const prodFirefoxRootUrl = 'https://firefox-ci-tc.services.mozilla.com';

export const stagingFirefoxRootUrl =
  'https://stage.taskcluster.nonprod.cloudops.mozgcp.net';

export const checkRootUrl = (rootUrl) => {
  // we need this workaround for the treeherder-taskcluster-staging deployment since all repository fixtures
  // and the default login rootUrls are for https://firefox-ci-tc.services.mozilla.com
  if (
    rootUrl === prodFirefoxRootUrl &&
    clientId === 'treeherder-taskcluster-staging-client'
  ) {
    return stagingFirefoxRootUrl;
  }
  return rootUrl;
};
