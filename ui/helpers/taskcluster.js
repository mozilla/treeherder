import { OIDCCredentialAgent, Queue } from 'taskcluster-client-web';

import { tcRootUrl, getUserSessionUrl } from './url';

const taskcluster = (() => {
  let credentialAgent = null;

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
        rootUrl: tcRootUrl,
      });
    }

    return credentialAgent;
  };

  return {
    getAgent: tcAgent,
    // When the access token is refreshed, simply update it on the credential agent
    getQueue: () =>
      new Queue({
        credentialAgent: tcAgent(),
        rootUrl: tcRootUrl,
      }),
    updateAgent: () => {
      const userSession = localStorage.getItem('userSession');

      if (userSession) {
        tcAgent().accessToken = JSON.parse(userSession).accessToken;
      } else {
        credentialAgent = null;
      }
    },
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
