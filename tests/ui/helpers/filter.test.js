import { thAllResultStatuses } from '../../../ui/helpers/constants';
import { thDefaultFilterResultStatuses } from '../../../ui/helpers/filter';

describe('Filter constants', () => {
  it('thAllResultStatuses includes unscheduled', () => {
    expect(thAllResultStatuses).toContain('unscheduled');
  });

  it('thDefaultFilterResultStatuses does not include unscheduled', () => {
    expect(thDefaultFilterResultStatuses).not.toContain('unscheduled');
  });
});
