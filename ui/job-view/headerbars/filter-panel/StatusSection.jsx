import PropTypes from 'prop-types';

import { thAllResultStatuses } from '../../../helpers/constants';
import { thFilterGroups } from '../../../helpers/filter';

import FilterPill from './FilterPill';

const statusPills = thAllResultStatuses.filter((rs) => rs !== 'runnable');

function StatusSection({ filterModel }) {
  const { resultStatus } = filterModel.urlParams;

  return (
    <div className="filter-panel-section" data-testid="status-section">
      <div className="filter-panel-label">Result status</div>
      <div className="filter-panel-row">
        {statusPills.map((status) => (
          <FilterPill
            key={status}
            label={status}
            isOn={resultStatus.includes(status)}
            onToggle={() => filterModel.toggleResultStatuses([status])}
          />
        ))}
      </div>
      <div className="filter-panel-row">
        <span className="filter-panel-hint">groups:</span>
        {['failures', 'in progress'].map((group) => (
          <FilterPill
            key={group}
            label={group}
            isOn={thFilterGroups[group].every((rs) => resultStatus.includes(rs))}
            onToggle={() => filterModel.toggleResultStatuses(thFilterGroups[group])}
            title={`Toggle all ${group} statuses`}
          />
        ))}
      </div>
    </div>
  );
}

StatusSection.propTypes = {
  filterModel: PropTypes.shape({}).isRequired,
};

export default StatusSection;
