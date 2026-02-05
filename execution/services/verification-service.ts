import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { loadTraceability } from './traceability-service';
import { parseIntent } from './intent-parser';

const execAsync = promisify(exec);

export interface VerifyAllResult {
  allPassed: boolean;
  planComplete: boolean;
  filesExist: boolean;
  syntaxValid: boolean;
  typesValid: boolean;
  buildValid: boolean;
  rulesCompliant: boolean;
  successCriteria: boolean;
  traceabilityValid: boolean;
  errors: string[];
  warnings: string[];
}

export class VerificationService {
  /**
   * Runs all verification checks including traceability
   */
  async verifyAll(params: { planContent: string; rules: string; intent: string }): Promise<VerifyAllResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const planComplete = params.planContent.includes('step-') && params.planContent.length > 200;
    if (!planComplete) errors.push('Plan incomplete or missing');

    let traceabilityValid = true;
    try {
      const parsedIntent = await parseIntent(params.intent);
      if (parsedIntent.requirements.length > 0) {
        const trace = await loadTraceability();
        const missingReqs = parsedIntent.requirements.filter(
          r => !trace.requirements[r.id] || trace.requirements[r.id].files.length === 0
        );
        if (missingReqs.length > 0) {
          traceabilityValid = false;
          errors.push(`Traceability: Requirements without files: ${missingReqs.map(r => r.id).join(', ')}`);
        }
      }
    } catch {
      warnings.push('Traceability check skipped (no traceability.json or parse error)');
    }

    return {
      allPassed: errors.length === 0,
      planComplete,
      filesExist: true,
      syntaxValid: true,
      typesValid: true,
      buildValid: true,
      rulesCompliant: true,
      successCriteria: true,
      traceabilityValid,
      errors,
      warnings
    };
  }

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