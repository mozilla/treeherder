
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileAlt,
  faStar as faStarRegular,
} from '@fortawesome/free-regular-svg-icons';
import { faStar as faStarSolid } from '@fortawesome/free-solid-svg-icons';

import ShortcutTable from '../shared/ShortcutTable';
import logviewerIconHelp from '../img/logviewerIconHelp.svg';

const notations = [
  {
    text: '+n',
    classes: 'btn-green ug-btn-comment',
    explanation: 'Collapsed job count',
  },
  {
    text: 'Th()',
    classes: 'btn-dkgray ug-btn-comment',
    explanation: 'Wrapped job group',
  },
  {
    classes: 'btn-orange-classified ug-btn-comment',
    icon: faStarRegular,
    explanation: 'Hollow asterisk, auto-classified',
  },
  {
    classes: 'btn-orange-classified ug-btn-comment',
    icon: faStarSolid,
    explanation: 'Asterisk, classified',
  },
  {
    classes: 'btn-ltgray ug-btn-bg',
    explanation: 'Light gray, pending',
  },
  {
    classes: 'btn-dkgray ug-btn-bg',
    explanation: 'Gray, running',
  },
  {
    classes: 'btn-green ug-btn-bg',
    explanation: 'Green, success',
  },
  {
    classes: 'btn-orange ug-btn-orange',
    explanation: 'Orange, tests failed',
  },
  {
    classes: 'btn-purple ug-btn-purple',
    explanation: 'Purple, infrastructure exception',
  },
  {
    classes: 'btn-red ug-btn-red',
    explanation: 'Red, build error',
  },
  {
    classes: 'btn-dkblue ug-btn-bg',
    explanation: 'Dark blue, build restarted',
  },
  {
    classes: 'btn-pink ug-btn-bg',
    explanation: 'Pink, build cancelled',
  },
  {
    classes: 'btn-yellow ug-btn-yellow',
    explanation: 'Yellow, unknown',
  },
  {
    classes: 'btn-unscheduled ug-btn-bg',
    explanation: 'Turquoise, unscheduled',
  },
  {
    classes: 'btn-ltblue ug-btn ug-btn-bg',
    explanation: 'Light blue, superseded',
  },
];

const UserGuideBody = function UserGuideBody() {
  return (
    <div className="card-body">
      <div className="row">
        <div className="col-6">
          <div className="card">
            <div className="card-header">
              <h3>Job notation</h3>
            </div>
            <div className="card-body">
              <table id="legend-other">
                <tbody>
                  {notations.map(({ classes, icon, explanation, text }) => (
                    <tr key={classes}>
                      <th>
                        <button
                          type="button"
                          className={`btn ug-btn ${classes}`}
                        >
                          {text || 'Th'}
                          {icon && (
                            <FontAwesomeIcon
                              icon={icon}
                              className="classified-icon"
                              title="Classified"
                            />
                          )}
                        </button>
                      </th>
                      <td>{explanation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-6">
          <ShortcutTable />
        </div>

        <div className="col-6">
          <div className="card">
            <div className="card-header">
              <h3>Copy values on hover</h3>
            </div>
            <div className="card-body panel-spacing">
              <table id="shortcuts">
                <tbody>
                  <tr>
                    <td>
                      <kbd>ctrl/cmd</kbd>
                      <kbd>c</kbd>
                    </td>
                    <td>
                      Copy job details
                      <img
                        src={logviewerIconHelp}
                        id="ug-logviewer-icon"
                        className="mx-1"
                        alt=""
                      />
                      logviewer url on hover
                    </td>
                  </tr>

                  <tr>
                    <td>
                      <kbd>ctrl/cmd</kbd>
                      <kbd>c</kbd>
                    </td>
                    <td>
                      Copy job details
                      <FontAwesomeIcon
                        icon={faFileAlt}
                        size="lg"
                        id="ug-raw-log-icon"
                        className="mx-1"
                      />
                      raw log url on hover
                    </td>
                  </tr>

                  <tr>
                    <td>
                      <kbd>ctrl/cmd</kbd>
                      <kbd>c</kbd>
                    </td>
                    <td>
                      Copy job details{' '}
                      <span className="small">
                        <strong>Job:</strong>
                        <span id="ug-job-name">name</span>
                      </span>{' '}
                      as raw text on hover
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h3>URL Query String Parameters</h3>
            </div>
            <div className="card-body panel-spacing">
              <table id="queryparams">
                <tbody>
                  <tr>
                    <td>
                      <span className="queryparam">nojobs</span>
                    </td>
                    <td>Load pushes without loading any job results.</td>
                    <td>
                      <span className="queryparam">&nojobs</span>
                    </td>
                  </tr>

                  <tr>
                    <td>
                      <span className="queryparam">fromchange</span>
                    </td>
                    <td>Specify the earliest revision in the push range.</td>
                    <td>
                      <span className="queryparam">
                        &fromchange=a12ca6c8b89b
                      </span>
                    </td>
                  </tr>

                  <tr>
                    <td>
                      <span className="queryparam">tochange</span>
                    </td>
                    <td>Specify the latest revision in the push range.</td>
                    <td>
                      <span className="queryparam">&tochange=3215c7fc090b</span>
                    </td>
                  </tr>

                  <tr>
                    <td>
                      <span className="queryparam">startdate</span>
                    </td>
                    <td>
                      <span>Specify the earliest </span>
                      <span className="queryparam">YYYY-MM-DD</span>
                      <span> date in the push range.</span>
                    </td>
                    <td>
                      <span className="queryparam">&startdate=YYYY-MM-DD</span>
                    </td>
                  </tr>

                  <tr>
                    <td>
                      <span className="queryparam">enddate</span>
                    </td>
                    <td>
                      <span>Specify the latest </span>
                      <span className="queryparam">YYYY-MM-DD</span>
                      <span> date in the push range.</span>
                    </td>
                    <td>
                      <span className="queryparam">&enddate=YYYY-MM-DD</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserGuideBody;
