import * as d3 from "d3";

// data is passed as a prop and target is updated via a ref in graph.jsx
export const graphOneSpecs = {
  title: "Orange Count per Push",
  data: [],
  width: 700,
  height: 300,
  right: 40,
  interpolate: d3.curveLinear,
  color: "#dd6602",
  target: "",
  x_accessor: "date",
  y_accessor: "value"
};

export const graphTwoSpecs = {
  data: [],
  width: 700,
  height: 300,
  right: 40,
  interpolate: d3.curveLinear,
  color: ["blue", "green"],
  target: "",
  x_accessor: "date",
  y_accessor: "value",
  legend: ["Orange Count", "Push Count"],
  legend_target: ".legend"
};

export const bugzillaDomain = "https://bugzilla.mozilla.org/";

export const bugsEndpoint = "api/failures/";

export const bugDetailsEndpoint = "api/failuresbybug/";

export const graphsEndpoint = "api/failurecount/";
