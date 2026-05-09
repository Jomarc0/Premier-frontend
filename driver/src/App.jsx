import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PassengerDashboard from './passenger-dashboard';
import DriverLogin from './driver-login';
import DriverDashboard from './driver-dashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route index element={<PassengerDashboard />} />
        <Route path="/driver-login" element={<DriverLogin />} />
        <Route path="/driver-dashboard" element={<DriverDashboard />} />
        <Route path="*" element={<div className="p-20 text-red-500 font-bold">URL NOT FOUND</div>} />
      </Routes>
    </Router>
  );
} 

export default App;