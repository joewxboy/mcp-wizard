import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { DiscoveryPage } from './pages/DiscoveryPage';
import { WizardPage } from './pages/WizardPage';
import { ConfigurationsPage } from './pages/ConfigurationsPage';
import { ConfigurationDetailPage } from './pages/ConfigurationDetailPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/discovery" replace />} />
      <Route path="/discovery" element={<DiscoveryPage />} />
      <Route path="/wizard" element={<WizardPage />} />
      <Route path="/configurations" element={<ConfigurationsPage />} />
      <Route path="/configurations/:id" element={<ConfigurationDetailPage />} />
      {/* Catch all route */}
      <Route path="*" element={<Navigate to="/discovery" replace />} />
    </Routes>
  );
};