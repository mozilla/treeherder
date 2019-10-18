import { OIDCCredentialAgent, Queue } from 'taskcluster-client-web';
import debounce from 'lodash/debounce';

import { clientId, redirectURI } from '../taskcluster-auth-callback/constants';

import { loginRootUrl, getUserSessionUrl, createQueryParams } from './url';

const taskcluster = (() => {
  let credentialAgent = null;
  let _rootUrl = null;

  // from the MDN crypto.getRandomValues doc
  const secureRandom = () =>
    window.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967295;

  const generateNonce = () => {
    let value = '';
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i <= 20; i++) {
      value += characters.charAt(
        Math.floor(secureRandom() * characters.length),
      );
    }

    localStorage.setItem('requestState', value);
    return value;
  };

  const getAuthCode = debounce(
    () => {
      const nonce = generateNonce();
      localStorage.setItem('requestState', nonce);
      localStorage.setItem('tcRootUrl', _rootUrl);

      const params = {
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectURI,
        scope: 'treeherder',
        state: nonce,
      };

      window.open(
        `${_rootUrl}login/oauth/authorize${createQueryParams(params)}`,
        '_blank',
      );
    },
    300,
    {
      leading: true,
      trailing: false,
    },
  );

  const verifyCredentials = (
    rootUrl = 'https://hassan.taskcluster-dev.net/',
  ) => {
    const userCredentials = JSON.parse(localStorage.getItem('userCredentials'));
    _rootUrl = rootUrl;

    // TODO also verify credentials haven't expired - current staging instance sets
    // expiring to time of query: moment(userCredentials[rootUrl].expires).isAfter(moment()))
    if (!userCredentials[rootUrl]) {
      getAuthCode();
    }

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
