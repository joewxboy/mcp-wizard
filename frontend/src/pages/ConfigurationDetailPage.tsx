import React from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';

export const ConfigurationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuration Details</h1>
        <p className="text-gray-600">
          Configuration ID: {id}
        </p>
      </div>

      <Card className="max-w-2xl mx-auto">
        <div className="text-center py-12">
          <p className="text-gray-600">Configuration details coming soon...</p>
        </div>
      </Card>
    </div>
  );
};