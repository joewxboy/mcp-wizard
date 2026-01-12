// MCP Server types
export interface MCPServer {
  id: string;
  name: string;
  description: string;
  source: 'github' | 'npm' | 'manual';
  sourceUrl: string;
  packageName?: string;
  version: string;
  author: string;
  license: string;
  tags: string[];

  // Extracted metadata
  readme: string;
  tools: ToolSchema[];
  resources: ResourceSchema[];
  prompts: PromptSchema[];

  // Configuration templates
  configTemplate: ConfigTemplate;
  requiredParams: ConfigParam[];
  optionalParams: ConfigParam[];

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastResearchedAt: Date;
  popularity: number;
  verified: boolean;
}

export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}

export interface ResourceSchema {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}

export interface PromptSchema {
  name: string;
  description: string;
  arguments?: PromptArgument[];
}

export interface PromptArgument {
  name: string;
  description: string;
  required?: boolean;
}

export interface ConfigTemplate {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  transport?: 'stdio' | 'sse';
}

export interface ConfigParam {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'path' | 'secret';
  description: string;
  required: boolean;
  default?: unknown;
  validation?: ValidationRule[];
}

export interface ValidationRule {
  type: 'min' | 'max' | 'pattern' | 'enum';
  value: unknown;
  message: string;
}

// User Configuration types
export interface UserConfig {
  id: string;
  userId: string;
  serverId: string;
  name: string;
  enabled: boolean;

  // Configuration values
  command: string;
  args: string[];
  env: Record<string, string>;

  // Sensitive data references (stored in keychain)
  secrets: SecretReference[];

  // Client format
  targetClient: 'claude-desktop' | 'custom';
  customFormat?: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface SecretReference {
  key: string;
  keychainId: string;
  description: string;
}

export interface ConfigVersion {
  id: string;
  configId: string;
  version: number;
  config: UserConfig;
  changeDescription: string;
  createdAt: Date;
  createdBy: string;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// JSON Schema types
export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  description?: string;
  items?: JSONSchema;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & Record<string, never>;

// Error types
export class ValidationError extends Error {
  constructor(
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}
