const uri = 'https://treestatus.mozilla-releng.net/trees/';

export default class TreeStatusModel {
  static getTreeStatusName(name) {
    // The thunderbird names in TreeStatus don't match what
    // we use, so translate them.  pretty hacky, yes...
    // TODO: Move these to the repository fixture in the service.
    return name.includes('comm-') && name !== 'try-comm-central' ?
      `${name}-thunderbird` : name;
  }

  static get(repoName) {
    return fetch(`${uri}${TreeStatusModel.getTreeStatusName(repoName)}`)
      .then((resp) => {
        if (resp.ok) {
          return resp.json();
        } else if (resp.status === 404) {
          return Promise.resolve({
            result: {
              status: 'unsupported',
              message_of_the_day: `${repoName} is not listed on <a href="https://mozilla-releng.net/treestatus">TreeStatus</a>`,
              reason: '',
              tree: repoName,
            },
          });
        }
        throw new Error(resp.statusText);
      })
      .catch(reason => (
        Promise.resolve({
          result: {
            status: 'error',
            message_of_the_day: 'Unable to connect to the <a href="https://mozilla-releng.net/treestatus">TreeStatus</a> API',
            reason,
            tree: repoName,
          },
        })
      ));
  }
}
