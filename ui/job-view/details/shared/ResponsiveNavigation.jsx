import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Dropdown } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAngleDoubleRight } from '@fortawesome/free-solid-svg-icons';

const ResponsiveNavigation = ({
  children,
  className = '',
  ariaLabel = 'Navigation',
}) => {
  const [overflowItems, setOverflowItems] = useState([]);
  const [visibleItems, setVisibleItems] = useState(children);
  const containerRef = useRef(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const items = Array.from(container.querySelectorAll('.nav-item'));
      const containerWidth = container.offsetWidth;
      const dropdownButton = container.querySelector('.overflow-dropdown');
      const dropdownWidth = dropdownButton ? dropdownButton.offsetWidth : 50;

      let totalWidth = 0;
      let overflowIndex = -1;

      items.forEach((item, index) => {
        if (!item.classList.contains('overflow-dropdown')) {
          totalWidth += item.offsetWidth;
          // Check if this item would cause overflow (accounting for dropdown button space)
          if (
            totalWidth > containerWidth - dropdownWidth &&
            overflowIndex === -1
          ) {
            overflowIndex = index;
          }
        }
      });

      if (overflowIndex > -1) {
        const visible = React.Children.toArray(children).slice(
          0,
          overflowIndex,
        );
        const overflow = React.Children.toArray(children).slice(overflowIndex);
        setVisibleItems(visible);
        setOverflowItems(overflow);
        setShowDropdown(true);
      } else {
        setVisibleItems(children);
        setOverflowItems([]);
        setShowDropdown(false);
      }
    };

    // Initial check
    checkOverflow();

    // Check on resize
    const resizeObserver = new ResizeObserver(checkOverflow);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Cleanup
    return () => {
      resizeObserver.disconnect();
    };
  }, [children]);

  const renderOverflowItem = (item, index) => {
    // Clone the item and extract relevant content for dropdown
    if (React.isValidElement(item)) {
      const {
        children: content,
        onClick,
        title: itemTitle,
        'aria-label': ariaLabelProp,
      } = item.props;
      const title = itemTitle || ariaLabelProp || '';

      return (
        <Dropdown.Item
          key={`overflow-${index}`}
          onClick={onClick}
          title={title}
          className="py-2"
        >
          {typeof content === 'string' ? content : title || `Item ${index + 1}`}
        </Dropdown.Item>
      );
    }
    return null;
  };

  return (
    <div
      ref={containerRef}
      className={`responsive-navigation d-flex align-items-center ${className}`}
      role="navigation"
      aria-label={ariaLabel}
    >
      {React.Children.map(visibleItems, (child, index) =>
        React.cloneElement(child, {
          className: `${child.props.className || ''} nav-item`,
          key:
            child.key ||
            child.props.title ||
            child.props['aria-label'] ||
            `nav-item-${index}`,
        }),
      )}

      {showDropdown && overflowItems.length > 0 && (
        <Dropdown className="nav-item overflow-dropdown ms-auto">
          <Dropdown.Toggle
            variant="link"
            className="bg-transparent text-light border-0 p-2"
            title="More actions"
            aria-label="More navigation items"
          >
            <FontAwesomeIcon icon={faAngleDoubleRight} className="text-light" />
          </Dropdown.Toggle>
          <Dropdown.Menu align="end" className="overflow-menu">
            {overflowItems.map(renderOverflowItem)}
          </Dropdown.Menu>
        </Dropdown>
      )}
    </div>
  );
};

ResponsiveNavigation.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  ariaLabel: PropTypes.string,
};

export default ResponsiveNavigation;
