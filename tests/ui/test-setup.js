// Entry point for Jest tests
import { configure } from 'enzyme/build';
import Adapter from 'enzyme-adapter-react-16/build';
import 'jest-dom/extend-expect';

configure({ adapter: new Adapter() });
