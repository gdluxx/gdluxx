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
