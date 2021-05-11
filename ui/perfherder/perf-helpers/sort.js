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
    sortByValue: (value) => (a, b) => a[value] - b[value],
  },
  [tableSort.descending]: {
    sortByString: (value) => (a, b) => b[value].localeCompare(a[value]),
    sortByStrFirstElement: (value) => (a, b) =>
      b.series_signature[value][0].localeCompare(a.series_signature[value][0]),
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

export const sort = (sortValue, sortType, data, componentName) => {
  let validData = [];
  const nullData = [];
  if (componentName === 'CompareTable') {
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
  const sortByStringColumns = ['title', 'name'];
  const { sortByString, sortByValue, sortByStrFirstElement } = sortTypes[
    sortType
  ];
  let doSort = sortByStringColumns.includes(sortValue)
    ? sortByString
    : sortByValue;
  if (sortValue === 'tags') {
    doSort = sortByStrFirstElement;
  }
  if (validData.length) {
    data = validData.sort(doSort(sortValue));
    data = data.concat(nullData);
  }

  return data;
};
