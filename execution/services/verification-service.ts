import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface VerificationResult {
  success: boolean;
  output: string;
  error?: string;
}

export class VerificationService {
  /**
   * Runs TypeScript type checking
   */
  async runTypeCheck(): Promise<VerificationResult> {
    try {
      const { stdout } = await execAsync('npx tsc --noEmit');
      return { success: true, output: stdout || 'TypeScript check passed.' };
    } catch (error: any) {
      return {
        success: false,
        output: error.stdout || '',
        error: error.stderr || error.message
      };
    }
  }

  /**
   * Runs Next.js build check
   */
  async runBuildCheck(): Promise<VerificationResult> {
    try {
      const { stdout } = await execAsync('npx next build');
      return { success: true, output: stdout || 'Build successful.' };
    } catch (error: any) {
      return {
        success: false,
        output: error.stdout || '',
        error: error.stderr || error.message
      };
    }
  }

  /**
   * Runs all verification steps
   */
  async verifyAll(): Promise<{ types: VerificationResult; build: VerificationResult; allPassed: boolean }> {
    const types = await this.runTypeCheck();
    const build = await this.runBuildCheck();

    return {
      types,
      build,
      allPassed: types.success && build.success
    };
  }
}