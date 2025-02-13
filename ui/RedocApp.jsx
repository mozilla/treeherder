import React from 'react';
import { RedocStandalone } from 'redoc';

const App = (props) => {
  return (
    <RedocStandalone specUrl="/api/schema/?format=openapi-json" {...props} />
  );
};

export default App;
