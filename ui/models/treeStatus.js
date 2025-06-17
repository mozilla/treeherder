import { thHosts } from '../helpers/constants';

const repoMap = new Map(
  Object.entries({
    autoland: 'firefox-autoland',
    'mozilla-central': 'firefox-main',
    'mozilla-beta': 'firefox-beta',
    'mozilla-release': 'firefox-release',
  }),
);

let _treeStatusApiUrl;
let _treeStatusUiUrl;
for (const [hostPrettyName, config] of Object.entries(thHosts)) {
  if (config.host === window.location.hostname) {
    _treeStatusApiUrl = thHosts[hostPrettyName]?.treestatus?.apiUrl;
    _treeStatusUiUrl = thHosts[hostPrettyName]?.treestatus?.uiUrl;
  }
}
if (_treeStatusApiUrl === undefined) {
  _treeStatusApiUrl = thHosts.default.treestatus.apiUrl;
}
if (_treeStatusUiUrl === undefined) {
  _treeStatusUiUrl = thHosts.default.treestatus.uiUrl;
}

export function treeStatusUiUrl() {
  return _treeStatusUiUrl;
}

const apiUrl = `${_treeStatusApiUrl}trees/`;

export default class TreeStatusModel {
  static get(repoName) {
    let repoNameGit = repoName;
    if (repoMap.has(repoName)) {
      repoNameGit = repoMap.get(repoName);
    } else if (repoName.includes('-esr')) {
      repoNameGit = `firefox-esr${repoName.split('-esr')[1]}`;
    }
    return fetch(`${apiUrl}${repoNameGit}`)
      .then(async (resp) => {
        if (resp.ok) {
          return resp.json();
        }

        if (resp.status === 404) {
          return Promise.resolve({
            result: {
              status: 'unsupported',
              message_of_the_day: '',
              reason: '',
              tree: repoNameGit,
            },
          });
        }
        throw new Error(await resp.text());
      })
      .catch((reason) =>
        Promise.resolve({
          result: {
            status: 'error',
            message_of_the_day: `Unable to connect to the ${apiUrl} API`,
            reason: reason.toString(),
            tree: repoNameGit,
          },
        }),
      );
  }
}
