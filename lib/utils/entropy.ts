import { Buffer } from 'buffer';

/**
 * Calculates the Shannon entropy of a given string or Buffer asynchronously.
 * Entropy is a measure of the unpredictability or randomness of the data.
 * 
 * @param data - The input string or Buffer to analyze
 * @returns A promise that resolves to the entropy value (bits per byte)
 */
export async function calculateEntropy(data: string | Buffer): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      if (!data || data.length === 0) {
        return resolve(0);
      }

      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const len = buffer.length;
      const frequencies: Record<number, number> = {};

      // Count occurrences of each byte
      for (let i = 0; i < len; i++) {
        const byte = buffer[i];
        frequencies[byte] = (frequencies[byte] || 0) + 1;
      }

      let entropy = 0;
      const log2 = Math.log(2);

      // Calculate Shannon entropy: H(X) = -Σ P(xi) * log2(P(xi))
      for (const byte in frequencies) {
        const p = frequencies[byte] / len;
        entropy -= p * (Math.log(p) / log2);
      }

      resolve(entropy);
    } catch (error) {
      console.error('Error in calculateEntropy:', error);
      reject(new Error(error instanceof Error ? error.message : 'Failed to calculate entropy'));
    }
  });
}

/**
 * Helper to determine if data is likely compressed or encrypted based on entropy.
 * High entropy (close to 8 for byte data) suggests high randomness.
 */
export async function isHighEntropy(data: string | Buffer, threshold = 7.5): Promise<boolean> {
  try {
    const entropy = await calculateEntropy(data);
    return entropy >= threshold;
  } catch (error) {
    return false;
  }
}
