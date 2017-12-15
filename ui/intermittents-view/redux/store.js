import { createStore, applyMiddleware } from "redux";
import thunk from "redux-thunk";
import rootReducer from "./root_reducer";

const store = createStore(rootReducer, applyMiddleware(thunk));

export default store;
