const React = require('react');

// generic react-native-maps mock component for safe rendering on web
const MockComponent = (props) => {
  return React.createElement('div', props, props.children);
};

module.exports = {
  default: MockComponent,
  Marker: MockComponent,
  Circle: MockComponent,
  Callout: MockComponent,
  Polygon: MockComponent,
  Polyline: MockComponent,
};
