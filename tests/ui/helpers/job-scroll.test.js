import {
  findGroupInstance,
  findJobElement,
  scrollJobIntoView,
  scrollToElement,
} from '../../../ui/helpers/job';
import {
  registerJobGroup,
  clearJobGroupRegistry,
} from '../../../ui/hooks/useJobGroupRegistry';
import { getGroupMapKey } from '../../../ui/helpers/aggregateId';

const rect = ({ top, bottom }) => ({
  top,
  bottom,
  left: 0,
  right: 10,
  width: 10,
  height: bottom - top,
});

const makeElement = (tag, bounds) => {
  const el = document.createElement(tag);
  el.getBoundingClientRect = () => rect(bounds);
  el.scrollIntoView = jest.fn();
  return el;
};

describe('scrollToElement', () => {
  let container;

  beforeEach(() => {
    // Mirror the job view: #th-global-content is the scrolling element and
    // the details panel takes the space below it.
    container = makeElement('div', { top: 100, bottom: 900 });
    container.id = 'th-global-content';
    container.style.overflowY = 'scroll';
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('does not scroll when the element is already within the scroll container', () => {
    const el = makeElement('button', { top: 400, bottom: 420 });
    container.appendChild(el);

    scrollToElement(el);

    expect(el.scrollIntoView).not.toHaveBeenCalled();
  });

  it('scrolls when the element is below the visible part of the container', () => {
    // Below the container's bottom edge, i.e. hidden behind the details panel
    // even though it is within the window's height.
    const el = makeElement('button', { top: 950, bottom: 970 });
    container.appendChild(el);

    scrollToElement(el);

    expect(el.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
  });

  it('scrolls when the element is above the visible part of the container', () => {
    const el = makeElement('button', { top: 20, bottom: 40 });
    container.appendChild(el);

    scrollToElement(el);

    expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('falls back to the window viewport when there is no scroll container', () => {
    const el = makeElement('button', {
      top: window.innerHeight + 50,
      bottom: window.innerHeight + 70,
    });
    document.body.appendChild(el);

    scrollToElement(el);

    expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
    el.remove();
  });
});

describe('findJobElement', () => {
  it('finds the job button inside the push list by job id', () => {
    const pushList = document.createElement('div');
    pushList.id = 'push-list';
    const button = document.createElement('button');
    button.setAttribute('data-job-id', '42');
    pushList.appendChild(button);
    document.body.appendChild(pushList);

    expect(findJobElement(42)).toBe(button);
    expect(findJobElement(43)).toBeNull();

    pushList.remove();
  });
});

describe('scrollJobIntoView', () => {
  const job = {
    id: 42,
    push_id: 7,
    job_group_symbol: 'M',
    tier: 1,
    platform: 'linux64',
    platform_option: 'opt',
  };
  let pushList;

  beforeEach(() => {
    pushList = document.createElement('div');
    pushList.id = 'push-list';
    document.body.appendChild(pushList);
  });

  afterEach(() => {
    pushList.remove();
  });

  it('scrolls to the job button when it is rendered', () => {
    const groupEl = makeElement('span', { top: 2000, bottom: 2020 });
    groupEl.setAttribute('data-group-key', getGroupMapKey(7, 'M', 1, 'linux64', 'opt'));
    const button = makeElement('button', { top: 2000, bottom: 2020 });
    button.setAttribute('data-job-id', '42');
    groupEl.appendChild(button);
    pushList.appendChild(groupEl);

    scrollJobIntoView(job);

    expect(button.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(groupEl.scrollIntoView).not.toHaveBeenCalled();
  });

  it('falls back to the group when the button is rolled up into a count', () => {
    const groupEl = makeElement('span', { top: 2000, bottom: 2020 });
    groupEl.setAttribute('data-group-key', getGroupMapKey(7, 'M', 1, 'linux64', 'opt'));
    pushList.appendChild(groupEl);

    scrollJobIntoView(job);

    expect(groupEl.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('does nothing when neither the button nor the group is rendered', () => {
    expect(() => scrollJobIntoView(job)).not.toThrow();
  });
});

describe('findGroupInstance', () => {
  const job = {
    push_id: 7,
    job_group_symbol: 'M',
    tier: 1,
    platform: 'linux64',
    platform_option: 'opt',
  };

  beforeEach(() => {
    clearJobGroupRegistry();
  });

  it('returns the registered group instance for the job', () => {
    const instance = { setExpanded: jest.fn() };
    registerJobGroup(getGroupMapKey(7, 'M', 1, 'linux64', 'opt'), instance);

    expect(findGroupInstance(job)).toBe(instance);
  });

  it('returns undefined when the group is not registered', () => {
    expect(findGroupInstance(job)).toBeUndefined();
  });
});
