import { curveLinear } from 'd3';

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
  y_accessor: 'value'
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
  legend_target: '.legend'
};
