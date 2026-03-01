/**
 * Validation utilities — ported from supabase/functions/_shared/validation.ts
 */

const validateEmail = (email) => {
  if (typeof email !== 'string') return { valid: false, sanitized: '', error: 'Email must be a string' };
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return { valid: false, sanitized: '', error: 'Invalid email format' };
  if (trimmed.length > 254) return { valid: false, sanitized: '', error: 'Email too long (max 254 characters)' };
  return { valid: true, sanitized: trimmed };
};

const validatePhone = (phone) => {
  if (phone === null || phone === undefined || phone === '') return { valid: true, sanitized: '' };
  if (typeof phone !== 'string') return { valid: false, sanitized: '', error: 'Phone must be a string' };
  const sanitized = phone.replace(/[^\d+\-\s()]/g, '').trim();
  const digitsOnly = sanitized.replace(/\D/g, '');
  if (digitsOnly.length < 10 || digitsOnly.length > 15) return { valid: false, sanitized: '', error: 'Phone must be 10-15 digits' };
  if (sanitized.length > 20) return { valid: false, sanitized: '', error: 'Phone too long (max 20 characters with formatting)' };
  return { valid: true, sanitized: sanitized.slice(0, 20) };
};

const validateName = (name, fieldName = 'Name') => {
  if (name === null || name === undefined || name === '') return { valid: true, sanitized: '' };
  if (typeof name !== 'string') return { valid: false, sanitized: '', error: `${fieldName} must be a string` };
  const trimmed = name.trim();
  const nameRegex = /^[a-zA-Z\s'\-]+$/;
  if (!nameRegex.test(trimmed)) return { valid: false, sanitized: '', error: `${fieldName} contains invalid characters` };
  if (trimmed.length > 100) return { valid: false, sanitized: '', error: `${fieldName} too long (max 100 characters)` };
  return { valid: true, sanitized: trimmed.slice(0, 100) };
};

const validateText = (text, fieldName = 'Text', maxLength = 1000) => {
  if (text === null || text === undefined || text === '') return { valid: true, sanitized: '' };
  if (typeof text !== 'string') return { valid: false, sanitized: '', error: `${fieldName} must be a string` };
  const trimmed = text.trim();
  const dangerousPatterns = [/<script/i, /javascript:/i, /on\w+\s*=/i, /<iframe/i];
  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) return { valid: false, sanitized: '', error: `${fieldName} contains potentially dangerous content` };
  }
  if (trimmed.length > maxLength) return { valid: false, sanitized: '', error: `${fieldName} too long (max ${maxLength} characters)` };
  return { valid: true, sanitized: trimmed.slice(0, maxLength) };
};

const validatePassword = (password) => {
  if (typeof password !== 'string') return { valid: false, error: 'Password must be a string' };
  if (password.length < 12) return { valid: false, error: 'Password must be at least 12 characters' };
  if (password.length > 128) return { valid: false, error: 'Password too long (max 128 characters)' };
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecial) {
    return { valid: false, error: 'Password must include uppercase, lowercase, number, and special character' };
  }
  return { valid: true };
};

const validateUUID = (uuid, fieldName = 'ID') => {
  if (typeof uuid !== 'string') return { valid: false, sanitized: '', error: `${fieldName} must be a string` };
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid)) return { valid: false, sanitized: '', error: `Invalid ${fieldName} format` };
  return { valid: true, sanitized: uuid.toLowerCase() };
};

const validateUserCreation = (input) => {
  const errors = [];
  const sanitized = {};
  const emailResult = validateEmail(input.email);
  if (!emailResult.valid) errors.push(emailResult.error); else sanitized.email = emailResult.sanitized;
  const passwordResult = validatePassword(input.password);
  if (!passwordResult.valid) errors.push(passwordResult.error); else sanitized.password = input.password;
  const firstNameResult = validateName(input.firstName, 'First name');
  if (!firstNameResult.valid) errors.push(firstNameResult.error); else sanitized.firstName = firstNameResult.sanitized;
  const lastNameResult = validateName(input.lastName, 'Last name');
  if (!lastNameResult.valid) errors.push(lastNameResult.error); else sanitized.lastName = lastNameResult.sanitized;
  const phoneResult = validatePhone(input.phone);
  if (!phoneResult.valid) errors.push(phoneResult.error); else sanitized.phone = phoneResult.sanitized;
  const cityResult = validateText(input.city, 'City', 100);
  if (!cityResult.valid) errors.push(cityResult.error); else sanitized.city = cityResult.sanitized;
  const stateResult = validateText(input.state, 'State', 50);
  if (!stateResult.valid) errors.push(stateResult.error); else sanitized.state = stateResult.sanitized;
  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, sanitized, errors: [] };
};

const escapeHtml = (unsafe) => {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const sanitizeString = (input, maxLength = 1000) => {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, maxLength);
};

module.exports = {
  validateEmail, validatePhone, validateName, validateText,
  validatePassword, validateUUID, validateUserCreation,
  escapeHtml, sanitizeString,
};
