import React from 'react';
import { Card } from '../components/ui/Card';

export const ConfigurationsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Configurations</h1>
        <p className="text-gray-600">
          Manage your MCP server configurations
        </p>
      </div>

      <Card className="max-w-2xl mx-auto">
        <div className="text-center py-12">
          <p className="text-gray-600">Configuration management coming soon...</p>
        </div>
      </Card>
    </div>
  );
};