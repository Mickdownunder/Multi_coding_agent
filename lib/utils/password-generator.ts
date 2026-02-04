export interface PasswordOptions {
  length: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
}

/**
 * Generates a random password based on provided options.
 * Ensures at least one character from each selected set is included.
 */
export function generatePassword(options: PasswordOptions): string {
  const charset = {
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '!@#$%^&*()_+~`|}{[]:;?><,./-='
  };

  let availableChars = '';
  const guaranteedChars: string[] = [];

  if (options.includeUppercase) {
    availableChars += charset.uppercase;
    guaranteedChars.push(charset.uppercase[Math.floor(Math.random() * charset.uppercase.length)]);
  }
  if (options.includeLowercase) {
    availableChars += charset.lowercase;
    guaranteedChars.push(charset.lowercase[Math.floor(Math.random() * charset.lowercase.length)]);
  }
  if (options.includeNumbers) {
    availableChars += charset.numbers;
    guaranteedChars.push(charset.numbers[Math.floor(Math.random() * charset.numbers.length)]);
  }
  if (options.includeSymbols) {
    availableChars += charset.symbols;
    guaranteedChars.push(charset.symbols[Math.floor(Math.random() * charset.symbols.length)]);
  }

  if (availableChars === '') {
    throw new Error('At least one character set must be selected');
  }

  if (options.length < guaranteedChars.length) {
    throw new Error(`Length must be at least ${guaranteedChars.length} to include all selected character types`);
  }

  let password = '';
  const remainingLength = options.length - guaranteedChars.length;
  
  for (let i = 0; i < remainingLength; i++) {
    const randomIndex = Math.floor(Math.random() * availableChars.length);
    password += availableChars[randomIndex];
  }

  // Combine guaranteed characters and the rest of the generated string
  const finalPasswordArray = [...guaranteedChars, ...password.split('')];
  
  // Fisher-Yates shuffle to ensure guaranteed characters aren't always at the start
  for (let i = finalPasswordArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [finalPasswordArray[i], finalPasswordArray[j]] = [finalPasswordArray[j], finalPasswordArray[i]];
  }

  return finalPasswordArray.join('');
}