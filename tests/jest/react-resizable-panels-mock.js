// Mock for react-resizable-panels in Jest tests
import React from 'react';

export const PanelGroup = ({ children, direction, onLayout, ...props }) =>
  React.createElement(
    'div',
    { ...props, className: 'mock-panel-group' },
    children,
  );

export const Panel = ({ children, defaultSize, minSize, ...props }) =>
  React.createElement('div', { ...props, className: 'mock-panel' }, children);

export const PanelResizeHandle = ({ className, ...props }) =>
  React.createElement('div', {
    ...props,
    className: `mock-panel-resize-handle ${className || ''}`,
  });
