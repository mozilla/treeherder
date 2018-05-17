
const uri = "https://treestatus.mozilla-releng.net/trees/";

export default class TreeStatusModel {
  static getTreeStatusName(name) {
    // The thunderbird names in TreeStatus don't match what
    // we use, so translate them.  pretty hacky, yes...
    // TODO: Move these to the repository fixture in the service.
    return name.includes("comm-") && name !== "try-comm-central" ?
      `${name}-thunderbird"` : name;
  }

  // the inverse of getTreeStatusName.  Seems like overhead to put this one
  // line here, but it keeps the logic to do/undo all in one place.
  static getRepoName(name) {
    return name.replace("-thunderbird", "");
  }

  static get(repoName) {
    return fetch(`${uri}${TreeStatusModel.getTreeStatusName(repoName)}`)
      .then(resp => resp.json());
  }
}
