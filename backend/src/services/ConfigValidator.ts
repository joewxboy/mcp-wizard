import { z } from 'zod';

// Configuration validation schemas
export const CreateConfigSchema = z.object({
  serverId: z.string().min(1, 'Server ID is required'),
  name: z.string().min(1, 'Configuration name is required').max(100, 'Name too long'),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  secrets: z.record(z.string()).optional(),
  targetClient: z.enum(['claude-desktop', 'custom']).optional().default('claude-desktop'),
  customFormat: z.string().optional(),
});

export const UpdateConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  secrets: z.record(z.string()).optional(),
  targetClient: z.enum(['claude-desktop', 'custom']).optional(),
  customFormat: z.string().optional(),
  enabled: z.boolean().optional(),
});

export const ConfigIdSchema = z.object({
  id: z.string().min(1, 'Configuration ID is required'),
});

// Export types inferred from schemas
export type CreateConfigInput = z.infer<typeof CreateConfigSchema>;
export type UpdateConfigInput = z.infer<typeof UpdateConfigSchema>;
export type ConfigIdInput = z.infer<typeof ConfigIdSchema>;

// Validation helper functions
export class ConfigValidator {
  static validateCreateConfig(data: unknown) {
    return CreateConfigSchema.safeParse(data);
  }

  static validateUpdateConfig(data: unknown) {
    return UpdateConfigSchema.safeParse(data);
  }

  static validateConfigId(data: unknown) {
    return ConfigIdSchema.safeParse(data);
  }

  static validateEnvironmentVariables(env: Record<string, string>) {
    const errors: string[] = [];

    for (const [key, value] of Object.entries(env)) {
      // Validate environment variable names (should match pattern)
      if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
        errors.push(`Invalid environment variable name: ${key}`);
      }

      // Check for potentially dangerous values
      if (value.includes('rm ') || value.includes('del ') || value.includes('format ')) {
        errors.push(`Potentially dangerous value for ${key}`);
      }
    }

    return errors;
  }

  static validateCommand(command: string) {
    const errors: string[] = [];

    // Check for dangerous commands
    const dangerousCommands = ['rm', 'del', 'format', 'fdisk', 'mkfs', 'dd'];
    const commandLower = command.toLowerCase();

    for (const dangerous of dangerousCommands) {
      if (commandLower.includes(dangerous)) {
        errors.push(`Potentially dangerous command: ${command}`);
        break;
      }
    }

    // Check command length
    if (command.length > 500) {
      errors.push('Command too long (max 500 characters)');
    }

    return errors;
  }

  static validateArguments(args: string[]) {
    const errors: string[] = [];

    // Check total arguments length
    const totalLength = args.join(' ').length;
    if (totalLength > 2000) {
      errors.push('Arguments too long (max 2000 characters total)');
    }

    // Check for dangerous arguments
    const dangerousArgs = ['-rf', '--force', '/dev', 'C:\\'];
    for (const arg of args) {
      for (const dangerous of dangerousArgs) {
        if (arg.includes(dangerous)) {
          errors.push(`Potentially dangerous argument: ${arg}`);
          break;
        }
      }
    }

    return errors;
  }

  static validateSecrets(secrets: Record<string, string>) {
    const errors: string[] = [];

    for (const [key, value] of Object.entries(secrets)) {
      // Validate secret key names
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        errors.push(`Invalid secret key name: ${key}`);
      }

      // Check secret value length
      if (value.length > 1000) {
        errors.push(`Secret value too long for ${key} (max 1000 characters)`);
      }

      // Check for empty values
      if (!value.trim()) {
        errors.push(`Empty secret value for ${key}`);
      }
    }

    return errors;
  }
}