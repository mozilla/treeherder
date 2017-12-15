import { combineReducers } from "redux";
import { fetchData, updateDates, updateTree, updateBugDetails } from "./reducers";

const rootReducer = combineReducers({
  bugsData: fetchData("BUGS"),
  bugDetailsData: fetchData("BUG_DETAILS"),
  bugsGraphData: fetchData("BUGS_GRAPHS"),
  bugDetailsGraphData: fetchData("BUG_DETAILS_GRAPHS"),
  dates: updateDates("BUGS"),
  bugDetailsDates: updateDates("BUG_DETAILS"),
  mainTree: updateTree("BUGS"),
  bugDetailsTree: updateTree("BUG_DETAILS"),
  bugDetails: updateBugDetails("BUG_DETAILS"),
  bugzilla: fetchData("BUGZILLA"),
  bugzillaBugDetails: fetchData("BUGZILLA_BUG_DETAILS")
});

export default rootReducer;
