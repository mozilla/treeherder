import { OIDCCredentialAgent, Queue } from 'taskcluster-client-web';

import { loginRootUrl, getUserSessionUrl, tcAuthCallbackUrl } from './url';

// 1) check for credentials that haven't expired in localStorage - userCredentials
// 2) if they have expired, window.open the taskcluster-auth route
// 3) in that component navigate to the <rootUrl>oauth/authorize to get code
// 4) check for the code in that component, which is the redirect_uri
// 5) if we have the code, fetch the token
// 6) when we validate the token, store the credentials

const taskcluster = (() => {
  let credentialAgent = null;
  let fetchingCredentials = false;

  const verifyCredentials = (
    rootUrl = 'https://hassan.taskcluster-dev.net/',
  ) => {
    const userCredentials = localStorage.getItem('userCredentials');

    if (fetchingCredentials) {
      // in case a tc action is triggered multiple times in parallel, we
      // only want to open one window for the authorization redirect
      return;
    }
    if (!userCredentials) {
      fetchingCredentials = true;
      console.log(fetchingCredentials);
      window.open(`${tcAuthCallbackUrl}?rootUrl=${rootUrl}`, '_blank');
      // } else {
      //   fetchingCredentials = false;
    }
    fetchingCredentials = false;
    // TODO create custom messages if they are null - "must verify credentials, try action again"
    return userCredentials[rootUrl];
  };

  // Create an OIDC credential agent if it doesn't exist.
  const tcAgent = () => {
    if (credentialAgent) {
      return credentialAgent;
    }

    const userSession = localStorage.getItem('userSession');
    const oidcProvider = 'mozilla-auth0';

    if (userSession) {
      credentialAgent = new OIDCCredentialAgent({
        accessToken: JSON.parse(userSession).accessToken,
        oidcProvider,
        url: getUserSessionUrl(oidcProvider),
        rootUrl: loginRootUrl,
      });
    }

    return credentialAgent;
  };

  return {
    getAgent: verifyCredentials,
    // When the access token is refreshed, simply update it on the credential agent
    getQueue: () =>
      new Queue({
        credentialAgent: tcAgent(),
        rootUrl: loginRootUrl,
      }),
  };
})();

export const getAction = (actionArray, actionName) => {
  const action = actionArray.find(result => result.name === actionName);

  if (!action) {
    throw Error(
      `'${actionName}' action is not available for this task. Available: ${actionArray
        .map(act => act.name)
        .join(', ')}`,
    );
  }

  return action;
};

export default taskcluster;
