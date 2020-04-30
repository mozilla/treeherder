import { getApiUrl } from '../helpers/url';

const uri = getApiUrl('/optioncollectionhash/');

export default class OptionCollectionModel {
  static getMap() {
    if (OptionCollectionModel.prototype.optionCollectionMap) {
      return Promise.resolve(
        OptionCollectionModel.prototype.optionCollectionMap,
      );
    }

    return fetch(uri).then((resp) =>
      resp.json().then((data) => {
        OptionCollectionModel.prototype.optionCollectionMap = data.reduce(
          (hashAcc, optColl) => ({
            ...hashAcc,
            [optColl.option_collection_hash]: optColl.options
              .map((opt) => opt.name)
              .sort()
              .join(),
          }),
          {},
        );
        return OptionCollectionModel.prototype.optionCollectionMap;
      }),
    );
  }
}
