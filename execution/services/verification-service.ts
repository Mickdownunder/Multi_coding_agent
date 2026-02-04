import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';

const execAsync = promisify(exec);

export class VerificationService {
  /**
   * Runs the playwright tests to verify UI functionality
   */
  async runUITests() {
    try {
      const { stdout, stderr } = await execAsync('npx playwright test tests/counter-functionality.spec.ts');
      return {
        success: true,
        output: stdout,
        error: stderr
      };
    } catch (error: any) {
      return {
        success: false,
        output: error.stdout,
        error: error.message
      };
    }
  }
}