import React from 'react';
import { Card } from '../components/ui/Card';

export const WizardPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuration Wizard</h1>
        <p className="text-gray-600">
          Step-by-step wizard to create MCP server configurations
        </p>
      </div>

      <Card className="max-w-2xl mx-auto">
        <div className="text-center py-12">
          <p className="text-gray-600">Wizard implementation coming soon...</p>
        </div>
      </Card>
    </div>
  );
};