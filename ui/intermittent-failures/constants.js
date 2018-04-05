import { curveLinear, format } from 'd3';

// data is passed as a prop and target is updated via a ref in graph.jsx
export const graphOneSpecs = {
  title: 'Orange Count per Push',
  data: [],
  width: 700,
  height: 300,
  right: 40,
  interpolate: curveLinear,
  color: '#dd6602',
  target: '',
  x_accessor: 'date',
  y_accessor: 'value',
  // this is a temporary fix until a bug with the decimals attribute is fixed;
  // should be replaced with: decimals: 2
  y_mouseover: d => format('.2f')(d.value),
};

export const graphTwoSpecs = {
  data: [],
  width: 700,
  height: 300,
  right: 40,
  interpolate: curveLinear,
  color: ['blue', 'green'],
  target: '',
  x_accessor: 'date',
  y_accessor: 'value',
  legend: ['Orange Count', 'Push Count'],
  legend_target: '.legend',
};
