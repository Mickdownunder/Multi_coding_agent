import { FileService } from '../execution/services/file-service'
import { PolicyViolationError } from '../execution/services/file-validator'
import { join } from 'path'
import { unlink } from 'fs/promises'

const TEST_DIR = join(process.cwd(), 'test-files')

describe('Hard Policy Enforcement', () => {
  let fileService: FileService

  beforeEach(() => {
    fileService = new FileService()
  })

  afterEach(async () => {
    // Clean up test files
    try {
      await unlink(join(TEST_DIR, 'test-next-document.tsx'))
    } catch {}
    try {
      await unlink(join(TEST_DIR, 'test-any-type.ts'))
    } catch {}
    try {
      await unlink(join(TEST_DIR, 'test-eval.ts'))
    } catch {}
  })

  describe('Forbidden Imports', () => {
    it('should block next/document import in regular files', async () => {
      const filePath = join(TEST_DIR, 'test-next-document.tsx')
      const content = `import Document from 'next/document'

export default function Test() {
  return <div>Test</div>
}`

      const err = await fileService.createFile(filePath, content).catch(e => e)
      expect(err).toBeInstanceOf(PolicyViolationError)
      expect(err.violations?.some((v: string) => v.includes('next/document')) || err.message?.includes('next/document')).toBe(true)
    })

    it('should allow next/document import in _document.tsx', async () => {
      const filePath = join(TEST_DIR, 'app/_document.tsx')
      const content = `import Document from 'next/document'

export default class MyDocument extends Document {
  render() {
    return <html><body>Test</body></html>
  }
}`

      // Should not throw
      await expect(
        fileService.createFile(filePath, content)
      ).resolves.not.toThrow()
    })
  })

  describe('Forbidden Types', () => {
    it('should block any type usage', async () => {
      const filePath = join(TEST_DIR, 'test-any-type.ts')
      const content = `function test(value: any): any {
  return value
}`

      await expect(
        fileService.createFile(filePath, content)
      ).rejects.toThrow(PolicyViolationError)

      await expect(
        fileService.createFile(filePath, content)
      ).rejects.toThrow('any')
    })

    it('should allow any with eslint-disable comment', async () => {
      const filePath = join(TEST_DIR, 'test-any-type.ts')
      const content = `// eslint-disable
function test(value: any): any {
  return value
}`

      // Should not throw
      await expect(
        fileService.createFile(filePath, content)
      ).resolves.not.toThrow()
    })
  })

  describe('Security Rules', () => {
    it('should block eval() usage', async () => {
      const filePath = join(TEST_DIR, 'test-eval.ts')
      const content = `function test() {
  eval('console.log("test")')
}`

      await expect(
        fileService.createFile(filePath, content)
      ).rejects.toThrow(PolicyViolationError)

      await expect(
        fileService.createFile(filePath, content)
      ).rejects.toThrow('eval')
    })

    it('should block hardcoded API keys', async () => {
      const filePath = join(TEST_DIR, 'test-api-key.ts')
      const content = `const API_KEY = 'sk-1234567890abcdef'
const SECRET = 'my-secret-key'`

      await expect(
        fileService.createFile(filePath, content)
      ).rejects.toThrow(PolicyViolationError)
    })
  })

  describe('PolicyViolationError Properties', () => {
    it('should include filePath, violationType, and suggestedFix', async () => {
      const filePath = join(TEST_DIR, 'test-violation.ts')
      const content = `import Document from 'next/document'`

      try {
        await fileService.createFile(filePath, content)
        fail('Should have thrown PolicyViolationError')
      } catch (error) {
        expect(error).toBeInstanceOf(PolicyViolationError)
        const policyError = error as PolicyViolationError
        expect(policyError.filePath).toBe(filePath)
        expect(policyError.violationType).toBe('forbidden-import')
        expect(policyError.suggestedFix).toContain('_document.tsx')
      }
    })
  })

  describe('File Modification', () => {
    it('should block modification that introduces policy violation', async () => {
      const filePath = join(TEST_DIR, 'test-modify.ts')
      const validContent = `function test(value: string): string {
  return value
}`

      // Create valid file first
      await fileService.createFile(filePath, validContent)

      // Try to modify with policy violation
      const invalidContent = `function test(value: any): any {
  return value
}`

      await expect(
        fileService.modifyFile(filePath, invalidContent)
      ).rejects.toThrow(PolicyViolationError)
    })
  })
})
