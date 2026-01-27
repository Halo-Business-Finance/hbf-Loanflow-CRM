// Comprehensive input validation utilities for Edge Functions
// CRITICAL: All user input MUST pass through these validators before database operations

// Email validation with strict limits
export const validateEmail = (email: unknown): { valid: boolean; sanitized: string; error?: string } => {
  if (typeof email !== 'string') {
    return { valid: false, sanitized: '', error: 'Email must be a string' };
  }
  
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(trimmed)) {
    return { valid: false, sanitized: '', error: 'Invalid email format' };
  }
  
  if (trimmed.length > 254) {
    return { valid: false, sanitized: '', error: 'Email too long (max 254 characters)' };
  }
  
  return { valid: true, sanitized: trimmed };
};

// Phone number validation with format sanitization
export const validatePhone = (phone: unknown): { valid: boolean; sanitized: string; error?: string } => {
  if (phone === null || phone === undefined || phone === '') {
    return { valid: true, sanitized: '' }; // Phone is optional
  }
  
  if (typeof phone !== 'string') {
    return { valid: false, sanitized: '', error: 'Phone must be a string' };
  }
  
  // Remove all non-digit characters except + (for international)
  const sanitized = phone.replace(/[^\d+\-\s()]/g, '').trim();
  const digitsOnly = sanitized.replace(/\D/g, '');
  
  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    return { valid: false, sanitized: '', error: 'Phone must be 10-15 digits' };
  }
  
  if (sanitized.length > 20) {
    return { valid: false, sanitized: '', error: 'Phone too long (max 20 characters with formatting)' };
  }
  
  return { valid: true, sanitized: sanitized.slice(0, 20) };
};

// Name validation (first/last names)
export const validateName = (name: unknown, fieldName: string = 'Name'): { valid: boolean; sanitized: string; error?: string } => {
  if (name === null || name === undefined || name === '') {
    return { valid: true, sanitized: '' }; // Names can be optional
  }
  
  if (typeof name !== 'string') {
    return { valid: false, sanitized: '', error: `${fieldName} must be a string` };
  }
  
  const trimmed = name.trim();
  
  // Only allow letters, spaces, hyphens, apostrophes (prevent XSS/injection)
  const nameRegex = /^[a-zA-Z\s'\-]+$/;
  if (!nameRegex.test(trimmed)) {
    return { valid: false, sanitized: '', error: `${fieldName} contains invalid characters` };
  }
  
  if (trimmed.length > 100) {
    return { valid: false, sanitized: '', error: `${fieldName} too long (max 100 characters)` };
  }
  
  return { valid: true, sanitized: trimmed.slice(0, 100) };
};

// Generic text validation with XSS protection
export const validateText = (text: unknown, fieldName: string = 'Text', maxLength: number = 1000): { valid: boolean; sanitized: string; error?: string } => {
  if (text === null || text === undefined || text === '') {
    return { valid: true, sanitized: '' }; // Text fields can be optional
  }
  
  if (typeof text !== 'string') {
    return { valid: false, sanitized: '', error: `${fieldName} must be a string` };
  }
  
  const trimmed = text.trim();
  
  // Check for potential XSS patterns
  const dangerousPatterns = [/<script/i, /javascript:/i, /on\w+\s*=/i, /<iframe/i];
  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, sanitized: '', error: `${fieldName} contains potentially dangerous content` };
    }
  }
  
  if (trimmed.length > maxLength) {
    return { valid: false, sanitized: '', error: `${fieldName} too long (max ${maxLength} characters)` };
  }
  
  return { valid: true, sanitized: trimmed.slice(0, maxLength) };
};

// Password validation with strength requirements
export const validatePassword = (password: unknown): { valid: boolean; error?: string } => {
  if (typeof password !== 'string') {
    return { valid: false, error: 'Password must be a string' };
  }
  
  if (password.length < 12) {
    return { valid: false, error: 'Password must be at least 12 characters' };
  }
  
  if (password.length > 128) {
    return { valid: false, error: 'Password too long (max 128 characters)' };
  }
  
  // Check for uppercase, lowercase, number, special character
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecial) {
    return { 
      valid: false, 
      error: 'Password must include uppercase, lowercase, number, and special character' 
    };
  }
  
  return { valid: true };
};

// UUID validation
export const validateUUID = (uuid: unknown, fieldName: string = 'ID'): { valid: boolean; sanitized: string; error?: string } => {
  if (typeof uuid !== 'string') {
    return { valid: false, sanitized: '', error: `${fieldName} must be a string` };
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid)) {
    return { valid: false, sanitized: '', error: `Invalid ${fieldName} format` };
  }
  
  return { valid: true, sanitized: uuid.toLowerCase() };
};

// Validate user creation input
export interface UserCreationInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  state?: string;
}

export const validateUserCreation = (input: any): { valid: boolean; sanitized?: UserCreationInput; errors: string[] } => {
  const errors: string[] = [];
  const sanitized: any = {};
  
  // Validate email (required)
  const emailResult = validateEmail(input.email);
  if (!emailResult.valid) {
    errors.push(emailResult.error!);
  } else {
    sanitized.email = emailResult.sanitized;
  }
  
  // Validate password (required)
  const passwordResult = validatePassword(input.password);
  if (!passwordResult.valid) {
    errors.push(passwordResult.error!);
  } else {
    sanitized.password = input.password; // Don't sanitize password
  }
  
  // Validate optional fields
  const firstNameResult = validateName(input.firstName, 'First name');
  if (!firstNameResult.valid) {
    errors.push(firstNameResult.error!);
  } else {
    sanitized.firstName = firstNameResult.sanitized;
  }
  
  const lastNameResult = validateName(input.lastName, 'Last name');
  if (!lastNameResult.valid) {
    errors.push(lastNameResult.error!);
  } else {
    sanitized.lastName = lastNameResult.sanitized;
  }
  
  const phoneResult = validatePhone(input.phone);
  if (!phoneResult.valid) {
    errors.push(phoneResult.error!);
  } else {
    sanitized.phone = phoneResult.sanitized;
  }
  
  const cityResult = validateText(input.city, 'City', 100);
  if (!cityResult.valid) {
    errors.push(cityResult.error!);
  } else {
    sanitized.city = cityResult.sanitized;
  }
  
  const stateResult = validateText(input.state, 'State', 50);
  if (!stateResult.valid) {
    errors.push(stateResult.error!);
  } else {
    sanitized.state = stateResult.sanitized;
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return { valid: true, sanitized, errors: [] };
};
