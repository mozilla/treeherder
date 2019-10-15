import { OIDCCredentialAgent, Queue } from 'taskcluster-client-web';

import { loginRootUrl, getUserSessionUrl, createQueryParams, loginCallbackUrl } from './url';

const taskcluster = (() => {
  let credentialAgent = null;

  const getAuthToken = (rootUrl=loginRootUrl) => {
    const params = {
      client_id: 'treeherder-localhost',
      response_type: 'code',
      // redirect_uri: `${window.location.protocol}//${window.location.host}${loginCallbackUrl}`,
      redirect_uri: 'http://localhost:5000',
      scope: 'treeherder',
      state: '99',
    }
    // `${rootUrl}/login/oauth/authorize`
    window.open(`https://hassan.taskcluster-dev.net/login/oauth/authorize${createQueryParams(params)}`);
  }

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
    getAgent: getAuthToken,
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
      `'${actionName}' action is not available for this task.  Available: ${actionArray
        .map(act => act.name)
        .join(', ')}`,
    );
  }

  return action;
};

export default taskcluster;
