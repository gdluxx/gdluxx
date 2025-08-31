export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: unknown) => boolean;
}

export type ValidationSchema = Record<string, ValidationRule>;

export const validateInput = (data: Record<string, unknown>, schema: ValidationSchema): void => {
  const errors: string[] = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }

    if (value !== undefined && value !== null) {
      const strValue = String(value);

      if (rules.minLength && strValue.length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }

      if (rules.maxLength && strValue.length > rules.maxLength) {
        errors.push(`${field} must be no more than ${rules.maxLength} characters`);
      }

      if (rules.pattern && !rules.pattern.test(strValue)) {
        errors.push(`${field} format is invalid`);
      }

      if (rules.custom && !rules.custom(value)) {
        errors.push(`${field} is invalid`);
      }
    }
  }

  if (errors.length > 0) {
    const error = new Error(errors.join(', '));
    error.name = 'ValidationError';
    throw error;
  }
};

export const sanitizeInput = (input: string): string => {
  const dangerous = [';', '|', '&', '`', '$', '(', ')', '<', '>', '"', "'"];
  let sanitized = input.trim();

  for (const char of dangerous) {
    sanitized = sanitized.replace(new RegExp(`\\${char}`, 'g'), '');
  }

  return sanitized;
};

export const sanitizeSiteConfigInput = (input: string): string => {
  const dangerous = [';', '|', '&', '`', '$', '(', ')', '<', '>', '"', "'", '\\', '\n', '\r', '\t'];
  let sanitized = input.trim();

  for (const char of dangerous) {
    const escapedChar = char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    sanitized = sanitized.replace(new RegExp(escapedChar, 'g'), '');
  }

  // Remove control characters except space
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ');

  return sanitized;
};

export const sanitizeDomainPattern = (pattern: string): string => {
  let sanitized = pattern.trim().toLowerCase();

  sanitized = sanitized.replace(/[^a-z0-9.\-*]/g, '');

  sanitized = sanitized.replace(/\.{2,}/g, '.');

  if (!sanitized.startsWith('*.')) {
    sanitized = sanitized.replace(/^\.+/, '');
  }
  sanitized = sanitized.replace(/\.+$/, '');

  return sanitized;
};

export const validateNestedObject = (data: unknown, schema: ValidationSchema, path = ''): void => {
  if (typeof data !== 'object' || data === null) {
    const error = new Error(`${path || 'data'} must be an object`);
    error.name = 'ValidationError';
    throw error;
  }

  validateInput(data as Record<string, unknown>, schema);
};

export const validateRequestRate = (
  requests: Map<string, number[]>,
  clientId: string,
  maxRequests = 100,
  windowMs = 60000, // 1 minute
): boolean => {
  const now = Date.now();
  const clientRequests = requests.get(clientId) || [];

  // Remove old requests outside the window
  const validRequests = clientRequests.filter((time) => now - time < windowMs);

  // Check if under limit
  if (validRequests.length >= maxRequests) {
    return false;
  }

  // Add current request
  validRequests.push(now);
  requests.set(clientId, validRequests);

  return true;
};

export const validateConfigArray = (
  configs: unknown[],
  maxLength = 50,
  validator?: (item: unknown) => boolean,
): boolean => {
  if (!Array.isArray(configs)) {
    return false;
  }

  if (configs.length > maxLength) {
    return false;
  }

  if (validator) {
    return configs.every(validator);
  }

  return true;
};
