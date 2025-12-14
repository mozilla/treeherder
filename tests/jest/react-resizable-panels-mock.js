// Mock for react-resizable-panels in Jest tests
import React from 'react';

export const PanelGroup = React.forwardRef(
  ({ children, direction, onLayout, ...props }, ref) => {
    React.useImperativeHandle(ref, () => ({
      setLayout: () => {},
      getLayout: () => [],
    }));
    return React.createElement(
      'div',
      { ...props, className: 'mock-panel-group' },
      children,
    );
  },
);

export const Panel = React.forwardRef(
  ({ children, defaultSize, minSize, ...props }, ref) => {
    React.useImperativeHandle(ref, () => ({
      collapse: () => {},
      expand: () => {},
      getCollapsed: () => false,
      getSize: () => defaultSize || 50,
      resize: () => {},
    }));
    return React.createElement(
      'div',
      { ...props, className: 'mock-panel' },
      children,
    );
  },
);

export const PanelResizeHandle = React.forwardRef(
  ({ className, ...props }, ref) =>
    React.createElement('div', {
      ...props,
      ref,
      className: `mock-panel-resize-handle ${className || ''}`,
    }),
);
