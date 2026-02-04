export interface PasswordOptions {
  /** The length of the password to generate */
  length: number;
  /** Whether to include uppercase letters (A-Z) */
  includeUppercase: boolean;
  /** Whether to include lowercase letters (a-z) */
  includeLowercase: boolean;
  /** Whether to include numbers (0-9) */
  includeNumbers: boolean;
  /** Whether to include special symbols (!@#$%^&*) */
  includeSymbols: boolean;
  /** Whether to exclude characters that look similar (e.g., i, l, 1, L, o, 0, O) */
  excludeSimilarCharacters?: boolean;
  /** If true, ensures at least one character from every selected category is present */
  strict?: boolean;
}

export type PasswordStrength = 'weak' | 'medium' | 'strong' | 'very-strong';

export interface PasswordResult {
  /** The generated password string */
  password: string;
  /** A categorical assessment of the password's strength */
  strength: PasswordStrength;
  /** The calculated entropy of the password in bits */
  entropy: number;
  /** ISO timestamp of when the password was generated */
  timestamp: string;
}