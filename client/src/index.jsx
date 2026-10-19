import React from 'react';
import ReactDOM from "react-dom/client";
import App from './App';

export const PROJECT_URL = "https://github.com/guslma/SpeedMonitor";
export const WEB_URL = PROJECT_URL;

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
