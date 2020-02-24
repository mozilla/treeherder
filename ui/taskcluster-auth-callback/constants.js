import { tcAuthCallbackUrl } from '../helpers/url';

export const tcClientIdMap = {
  'https://treeherder.mozilla.org': 'production',
  'https://treeherder.allizom.org': 'stage',
  'https://treeherder-prototype.herokuapp.com': 'dev',
  'http://localhost:5000': 'localhost',
  'https://treeherder-taskcluster-staging.herokuapp.com': 'taskcluster-staging',
  'https://treeherder-prototype2.herokuapp.com': 'dev2',
};

export const clientId = `treeherder-${tcClientIdMap[window.location.origin]}`;

export const redirectURI = `${window.location.origin}${tcAuthCallbackUrl}`;

export const errorMessage = `There was a problem verifying your Taskcluster credentials. Please try again later.`;

export const prodFirefoxRootUrl = 'https://firefox-ci-tc.services.mozilla.com';

export const stagingFirefoxRootUrl =
  'https://stage.taskcluster.nonprod.cloudops.mozgcp.net';

export const checkRootUrl = rootUrl => {
  // we need this workaround for the treeherder-taskcluster-staging deployment since all repository fixtures
  // and the default login rootUrls are for https://firefox-ci-tc.services.mozilla.com
  if (
    rootUrl === prodFirefoxRootUrl &&
    clientId === 'treeherder-taskcluster-staging'
  ) {
    return stagingFirefoxRootUrl;
  }
  return rootUrl;
};
