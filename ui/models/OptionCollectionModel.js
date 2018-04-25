import { getApiUrl } from '../helpers/urlHelper';

export default class ThOptionCollectionModel {
  constructor() {
    this.optionCollectionMap = null;
  }

  async loadMap() {
    const resp = await fetch(getApiUrl("/optioncollectionhash/"));
    const optionCollections = await resp.json();
    // return a map of option collection hashes to a string
    // representation of their contents
    // (e.g. 102210fe594ee9b33d82058545b1ed14f4c8206e -> opt)
    this.optionCollectionMap = optionCollections.reduce((acc, optColl) => (
      { [optColl.option_collection_hash]: [...new Set(optColl.options.map(opt => opt.name))].sort().join() }
    ), {});
    return this.optionCollectionMap;
  }

  async getMap() {
    return !this.optionCollectionMap ? this.loadMap() : this.optionCollectionMap;
  }
}
