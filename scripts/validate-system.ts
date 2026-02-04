import { execSync } from 'child_process';

/**
 * This script runs comprehensive checks to ensure the codebase is free of type errors
 * and builds correctly. It is intended to be used by the VERIFY agent or manually
 * before deployment.
 */
async function validateSystem() {
  console.log('🚀 Starting system validation...');

  try {
    // 1. Type Check
    // --noEmit ensures we only check types without generating files
    console.log('\n🔍 Running TypeScript check (tsc)...');
    execSync('npx tsc --noEmit', { stdio: 'inherit' });
    console.log('✅ TypeScript check passed.');

    // 2. Next.js Build Check
    // This ensures all pages, components, and API routes are valid for production
    console.log('\n🏗️ Running Next.js build...');
    execSync('npx next build', { stdio: 'inherit' });
    console.log('✅ Build successful.');

    console.log('\n✨ Zero errors found. System is healthy!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Validation failed. Please fix the errors above.');
    process.exit(1);
  }
}

validateSystem();