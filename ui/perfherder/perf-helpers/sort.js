export const sortTables = {
  alert: 'Alert',
  compare: 'Compare',
};

export const tableSort = {
  ascending: 'ascending',
  descending: 'descending',
  default: 'default',
};

export const sortTypes = {
  [tableSort.ascending]: {
    sortByString: (value) => (a, b) => a[value].localeCompare(b[value]),
    sortByStrFirstElement: (value) => (a, b) =>
      a.series_signature[value][0].localeCompare(b.series_signature[value][0]),
    sortBySeriesSignatureValue: (value) => (a, b) =>
      a.series_signature[value].localeCompare(b.series_signature[value]),
    sortByValue: (value) => (a, b) => a[value] - b[value],
  },
  [tableSort.descending]: {
    sortByString: (value) => (a, b) => b[value].localeCompare(a[value]),
    sortByStrFirstElement: (value) => (a, b) =>
      b.series_signature[value][0].localeCompare(a.series_signature[value][0]),
    sortBySeriesSignatureValue: (value) => (a, b) =>
      b.series_signature[value].localeCompare(a.series_signature[value]),
    sortByValue: (value) => (a, b) => b[value] - a[value],
  },
};

export const getNextSort = (currentSort) => {
  const { ascending, descending, default: defaultSort } = tableSort;
  const nextSort = {
    ascending: descending,
    descending: defaultSort,
    default: ascending,
  };

  return nextSort[currentSort];
};

export const sort = (sortValue, sortType, data, table) => {
  let validData = [];
  const nullData = [];
  if (table === sortTables.compare) {
    data.forEach((item) => {
      if (item[sortValue] || item[sortValue] === 0) {
        validData.push(item);
      } else {
        nullData.push(item);
      }
    });
  } else {
    validData = data;
  }
  const {
    sortByString,
    sortByValue,
    sortByStrFirstElement,
    sortBySeriesSignatureValue,
  } = sortTypes[sortType];

  const getSortType = {
    title: sortByString,
    name: sortByString,
    tags: sortByStrFirstElement,
    machine_platform: sortBySeriesSignatureValue,
    noise_profile: sortByString,
  };

  let doSort = getSortType[sortValue];
  if (doSort === undefined) doSort = sortByValue;

  if (validData.length) {
    data = validData.sort(doSort(sortValue));
    data = data.concat(nullData);
  }

  return data;
};

export const sortData = function sortData(data, sortBy, desc) {
  data.sort((a, b) => {
    const item1 = desc ? b[sortBy] : a[sortBy];
    const item2 = desc ? a[sortBy] : b[sortBy];

    if (item1 < item2) {
      return -1;
    }
    if (item1 > item2) {
      return 1;
    }
    return 0;
  });
  return data;
};
