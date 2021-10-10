// Entry point for Jest tests
import { configure } from 'enzyme/build';
import Adapter from '@wojtekmaj/enzyme-adapter-react-17/build';
import '@testing-library/jest-dom/extend-expect';

configure({ adapter: new Adapter() });
