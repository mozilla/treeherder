// Entry point for Jest tests
import { configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';
import 'jest-dom/extend-expect';

configure({ adapter: new Adapter() });
