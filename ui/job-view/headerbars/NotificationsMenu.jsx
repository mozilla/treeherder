import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell } from '@fortawesome/free-regular-svg-icons';
import {
  faBan,
  faCheck,
  faExclamationTriangle,
  faInfoCircle,
} from '@fortawesome/free-solid-svg-icons';
import {
  Button,
  DropdownMenu,
  DropdownItem,
  DropdownToggle,
  UncontrolledDropdown,
} from 'reactstrap';

import { shortDateFormat } from '../../helpers/display';
import { clearStoredNotifications } from '../redux/stores/notifications';

class NotificationsMenu extends React.Component {
  getIcon(severity) {
    // TODO: Move this and the usage in NotificationsList to a shared component.
    switch (severity) {
      case 'danger':
        return faBan;
      case 'warning':
        return faExclamationTriangle;
      case 'info':
        return faInfoCircle;
      case 'success':
        return faCheck;
    }
  }

  render() {
    const { storedNotifications, clearStoredNotifications } = this.props;

    return (
      <UncontrolledDropdown>
        <DropdownToggle className="btn-view-nav nav-menu-btn">
          <FontAwesomeIcon
            icon={faBell}
            className="lightgray"
            title="Recent notifications"
          />
        </DropdownToggle>
        <DropdownMenu id="notification-dropdown" right>
          <DropdownItem tag="a" title="Notifications" className="pl-0" header>
            Recent notifications
            {!!storedNotifications.length && (
              <Button
                size="xs"
                outline
                className="notification-dropdown-btn"
                title="Clear all notifications"
                onClick={clearStoredNotifications}
              >
                Clear all
              </Button>
            )}
          </DropdownItem>
          {storedNotifications.length ? (
            storedNotifications.map(notification => (
              <DropdownItem
                className="pl-0 notification-dropdown-line"
                key={`${notification.created}${notification.message}`}
              >
                <span
                  title={`${notification.message} ${notification.linkText}`}
                >
                  <FontAwesomeIcon
                    icon={this.getIcon(notification.severity)}
                    className={`text-${notification.severity}`}
                    title={notification.severity}
                  />
                  &nbsp;
                  <small className="text-muted">
                    {new Date(notification.created).toLocaleString(
                      'en-US',
                      shortDateFormat,
                    )}
                  </small>
                  &nbsp;{notification.message}&nbsp;
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    href={notification.url}
                  >
                    {notification.linkText}
                  </a>
                </span>
              </DropdownItem>
            ))
          ) : (
            <DropdownItem tag="a" className="pl-0">
              No recent notifications
            </DropdownItem>
          )}
        </DropdownMenu>
      </UncontrolledDropdown>
    );
  }
}

NotificationsMenu.propTypes = {
  storedNotifications: PropTypes.arrayOf(PropTypes.object).isRequired,
  clearStoredNotifications: PropTypes.func.isRequired,
};

const mapStateToProps = ({ notifications: { storedNotifications } }) => ({
  storedNotifications,
});

export default connect(mapStateToProps, { clearStoredNotifications })(
  NotificationsMenu,
);
