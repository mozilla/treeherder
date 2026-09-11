import { render, cleanup, fireEvent } from '@testing-library/react';

import KeyboardShortcuts from '../../../ui/job-view/KeyboardShortcuts';

// Fire a keydown the way react-hot-keys / hotkeys-js expects (needs keyCode).
const pressKeyDown = (key, keyCode) =>
  fireEvent.keyDown(document.body, { key, keyCode, which: keyCode });

const renderShortcuts = (filterModel) =>
  render(
    <KeyboardShortcuts
      filterModel={filterModel}
      showOnScreenShortcuts={jest.fn()}
    >
      <div key="child">child</div>
    </KeyboardShortcuts>,
  );

describe('KeyboardShortcuts', () => {
  afterEach(cleanup);

  // The 'i' shortcut maps to filterModel.toggleInProgress(), which makes it a
  // convenient probe for whether the handler actually fired.
  const makeFilterModel = () => ({
    toggleInProgress: jest.fn(),
    removeFilter: jest.fn(),
    toggleClassifiedFailures: jest.fn(),
    toggleUnscheduledResultStatus: jest.fn(),
    toggleUnclassifiedFailures: jest.fn(),
  });

  it('fires a shortcut handler on keydown', () => {
    const filterModel = makeFilterModel();
    renderShortcuts(filterModel);

    pressKeyDown('i', 73);
    fireEvent.keyUp(document.body, { key: 'i', keyCode: 73, which: 73 });

    expect(filterModel.toggleInProgress).toHaveBeenCalledTimes(1);
  });

  // Regression: react-hot-keys keeps an `isKeyDown` latch that is only cleared
  // by a keyup on document.body. Shortcuts that open a new tab (l, shift+l, g)
  // steal the keyup, leaving the latch stuck `true` so the NEXT shortcut is
  // swallowed and must be pressed twice. Losing focus (window blur) must clear
  // the latch so the next shortcut works on the first press.
  it('recovers after a lost keyup when the window loses focus', () => {
    const filterModel = makeFilterModel();
    renderShortcuts(filterModel);

    // First shortcut fires, but its keyup is "lost" (went to a new tab), so the
    // latch stays set.
    pressKeyDown('i', 73);
    expect(filterModel.toggleInProgress).toHaveBeenCalledTimes(1);

    // Without recovery, this second press is swallowed by the stuck latch.
    pressKeyDown('i', 73);
    expect(filterModel.toggleInProgress).toHaveBeenCalledTimes(1);

    // The tab regains focus after the window blurred; the blur handler should
    // have cleared the latch.
    fireEvent.blur(window);

    pressKeyDown('i', 73);
    expect(filterModel.toggleInProgress).toHaveBeenCalledTimes(2);
  });
});
