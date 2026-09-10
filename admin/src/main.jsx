import { installSessionGuard } from './lib/sessionGuard';
import React from 'react';
import './polyfills';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import 'leaflet/dist/leaflet.css';
import { initPostHog } from './lib/posthog';

initPostHog();

installSessionGuard();

ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
);
