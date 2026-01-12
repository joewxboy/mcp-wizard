import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState, AppDispatch } from '../store';
import { createConfig } from '../store/slices/configSlice';

import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Checkbox } from '../components/ui/Checkbox';
import { ErrorMessage } from '../components/ui/ErrorMessage';

interface FormData {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  transport: 'stdio' | 'sse';
  params: Record<string, unknown>;
}

export const WizardPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { selectedServer } = useSelector((state: RootState) => state.research);
  const { isLoading, error } = useSelector((state: RootState) => state.config);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    command: '',
    args: [],
    env: {},
    transport: 'stdio',
    params: {},
  });

  const [validationErrors, setValidationErrors] = useState<Partial<Record<string, string>>>({});

  // Initialize form with server template
  useEffect(() => {
    if (selectedServer) {
      setFormData({
        name: `${selectedServer.name} Config`,
        command: selectedServer.configTemplate.command,
        args: selectedServer.configTemplate.args || [],
        env: selectedServer.configTemplate.env || {},
        transport: selectedServer.configTemplate.transport || 'stdio',
        params: {},
      });
    }
  }, [selectedServer]);

  // Redirect if no server selected
  useEffect(() => {
    if (!selectedServer) {
      navigate('/discovery');
    }
  }, [selectedServer, navigate]);

  if (!selectedServer) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuration Wizard</h1>
          <p className="text-gray-600">No server selected. Redirecting to discovery...</p>
        </div>
      </div>
    );
  }

  const handleInputChange = (field: keyof FormData, value: FormData[keyof FormData]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleArgChange = (index: number, value: string) => {
    const newArgs = [...formData.args];
    newArgs[index] = value;
    handleInputChange('args', newArgs);
  };

  const addArg = () => {
    handleInputChange('args', [...formData.args, '']);
  };

  const removeArg = (index: number) => {
    const newArgs = formData.args.filter((_, i) => i !== index);
    handleInputChange('args', newArgs);
  };

  const handleEnvChange = (key: string, value: string) => {
    const newEnv = { ...formData.env, [key]: value };
    handleInputChange('env', newEnv);
  };

  const removeEnv = (key: string) => {
    const newEnv = { ...formData.env };
    delete newEnv[key];
    handleInputChange('env', newEnv);
  };

  const handleParamChange = (key: string, value: string | number | boolean) => {
    const newParams = { ...formData.params, [key]: value };
    handleInputChange('params', newParams);
    // Clear validation error for this param
    if (validationErrors[key]) {
      setValidationErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Configuration name is required';
    }

    if (!formData.command.trim()) {
      errors.command = 'Command is required';
    }

    // Validate required parameters
    selectedServer.requiredParams.forEach((param) => {
      const value = formData.params[param.key];
      if (value === undefined || value === null || value === '') {
        errors[param.key] = `${param.key} is required`;
      }
    });

    // Validate optional parameters if provided
    selectedServer.optionalParams.forEach((param) => {
      const value = formData.params[param.key];
      if (value !== undefined && value !== null && value !== '') {
        // Add validation logic based on param type if needed
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      // Prepare the configuration data
      const filteredArgs = formData.args.filter((arg) => arg.trim() !== '');
      const filteredEnv = Object.fromEntries(
        Object.entries(formData.env).filter(([_, value]) => value.trim() !== ''),
      );

      // Add param values to env vars (for now, we can extend this logic later)
      const paramEnv: Record<string, string> = {};
      Object.entries(formData.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          paramEnv[key] = String(value);
        }
      });

      const configData = {
        serverId: selectedServer.id,
        name: formData.name,
        command: formData.command,
        args: filteredArgs,
        env: { ...filteredEnv, ...paramEnv },
        targetClient: 'claude-desktop' as const,
        customFormat: undefined,
        secrets: {}, // Will be handled separately for sensitive data
      };

      const result = await dispatch(createConfig(configData)).unwrap();

      // Navigate to the created configuration
      navigate(`/configurations/${result.id}`);
    } catch (error) {
      // Error is handled by the slice
    }
  };

  const transportOptions = [
    { value: 'stdio', label: 'Standard I/O', description: 'Communicates via stdin/stdout' },
    { value: 'sse', label: 'Server-Sent Events', description: 'Communicates via HTTP SSE' },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuration Wizard</h1>
        <p className="text-gray-600 mb-4">
          Configure {selectedServer.name} for use with MCP clients
        </p>
        <p className="text-sm text-gray-500">
          Version {selectedServer.version} • {selectedServer.author}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="max-w-4xl mx-auto">
          <div className="space-y-6">
            {/* Basic Configuration */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Configuration</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Configuration Name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  error={validationErrors.name}
                  helperText="A descriptive name for this configuration"
                  required
                />

                <Select
                  label="Transport Type"
                  value={formData.transport}
                  onChange={(e) =>
                    handleInputChange('transport', e.target.value as 'stdio' | 'sse')
                  }
                  options={transportOptions}
                  helperText="How the MCP client communicates with this server"
                />
              </div>

              <Input
                label="Command"
                value={formData.command}
                onChange={(e) => handleInputChange('command', e.target.value)}
                error={validationErrors.command}
                helperText="The command to run the MCP server"
                required
                fullWidth
              />
            </div>

            {/* Arguments */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Arguments</h2>
              {selectedServer.configTemplate.args &&
              selectedServer.configTemplate.args.length > 0 ? (
                <p className="text-sm text-gray-600 mb-4">
                  Default arguments from server:{' '}
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                    {selectedServer.configTemplate.args.join(' ')}
                  </code>
                </p>
              ) : (
                <p className="text-sm text-gray-600 mb-4">
                  No default arguments specified by the server.
                </p>
              )}
              <div className="space-y-2">
                {formData.args.map((arg, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={arg}
                      onChange={(e) => handleArgChange(index, e.target.value)}
                      placeholder={`Argument ${index + 1}`}
                      fullWidth
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeArg(index)}
                      className="shrink-0"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addArg}>
                  Add Argument
                </Button>
              </div>
            </div>

            {/* Environment Variables */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Environment Variables</h2>
              {selectedServer.configTemplate.env &&
              Object.keys(selectedServer.configTemplate.env).length > 0 ? (
                <div className="text-sm text-gray-600 mb-4">
                  <p className="mb-2">Default environment variables from server:</p>
                  <div className="bg-gray-50 p-3 rounded border">
                    {Object.entries(selectedServer.configTemplate.env).map(([key, value]) => (
                      <div key={key} className="font-mono text-xs">
                        <span className="font-semibold">{key}</span>={value}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600 mb-4">
                  No default environment variables specified by the server.
                </p>
              )}
              <div className="space-y-2">
                {Object.entries(formData.env).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Input
                      value={key}
                      onChange={(e) => {
                        const newEnv = { ...formData.env };
                        delete newEnv[key];
                        newEnv[e.target.value] = value;
                        handleInputChange('env', newEnv);
                      }}
                      placeholder="Variable name"
                      className="w-1/3"
                    />
                    <Input
                      value={value}
                      onChange={(e) => handleEnvChange(key, e.target.value)}
                      placeholder="Variable value"
                      fullWidth
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeEnv(key)}
                      className="shrink-0"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleEnvChange(`VAR_${Object.keys(formData.env).length + 1}`, '')}
                >
                  Add Environment Variable
                </Button>
              </div>
            </div>

            {/* Required Parameters */}
            {selectedServer.requiredParams.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Required Parameters</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedServer.requiredParams.map((param) => (
                    <div key={param.key}>
                      {param.type === 'boolean' ? (
                        <Checkbox
                          label={param.description}
                          checked={Boolean(formData.params[param.key] ?? param.default ?? false)}
                          onChange={(e) => handleParamChange(param.key, e.target.checked)}
                          error={validationErrors[param.key]}
                          required
                        />
                      ) : param.type === 'number' ? (
                        <Input
                          label={param.description}
                          type="number"
                          value={
                            typeof formData.params[param.key] === 'number'
                              ? (formData.params[param.key] as number)
                              : typeof param.default === 'number'
                                ? param.default
                                : ''
                          }
                          onChange={(e) => handleParamChange(param.key, Number(e.target.value))}
                          error={validationErrors[param.key]}
                          required
                        />
                      ) : (
                        <Input
                          label={param.description}
                          value={
                            typeof formData.params[param.key] === 'string'
                              ? (formData.params[param.key] as string)
                              : typeof param.default === 'string'
                                ? param.default
                                : ''
                          }
                          onChange={(e) => handleParamChange(param.key, e.target.value)}
                          error={validationErrors[param.key]}
                          required
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Optional Parameters */}
            {selectedServer.optionalParams.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Optional Parameters</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedServer.optionalParams.map((param) => (
                    <div key={param.key}>
                      {param.type === 'boolean' ? (
                        <Checkbox
                          label={param.description}
                          checked={Boolean(formData.params[param.key] ?? param.default ?? false)}
                          onChange={(e) => handleParamChange(param.key, e.target.checked)}
                        />
                      ) : param.type === 'number' ? (
                        <Input
                          label={param.description}
                          type="number"
                          value={
                            typeof formData.params[param.key] === 'number'
                              ? (formData.params[param.key] as number)
                              : typeof param.default === 'number'
                                ? param.default
                                : ''
                          }
                          onChange={(e) => handleParamChange(param.key, Number(e.target.value))}
                        />
                      ) : (
                        <Input
                          label={param.description}
                          value={
                            typeof formData.params[param.key] === 'string'
                              ? (formData.params[param.key] as string)
                              : typeof param.default === 'string'
                                ? param.default
                                : ''
                          }
                          onChange={(e) => handleParamChange(param.key, e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && <ErrorMessage title="Configuration Error" message={error} />}

            {/* Submit Buttons */}
            <div className="flex justify-end gap-4 pt-6 border-t">
              <Button type="button" variant="outline" onClick={() => navigate('/discovery')}>
                Cancel
              </Button>
              <Button type="submit" loading={isLoading}>
                {isLoading ? 'Creating Configuration...' : 'Create Configuration'}
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
};
