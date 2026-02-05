// Mock Config for tests that need workspace = process.cwd() (e.g. policy-violations)
jest.mock('./execution/config', () => {
  const actual = jest.requireActual('./execution/config')
  return {
    ...actual,
    Config: {
      getInstance: () => ({
        load: async () => ({
          llm: { provider: 'gemini', apiKey: 'test', model: {}, maxTokens: {} },
          tokenBudget: {},
          execution: {},
          workspace: {
            projectPath: process.cwd(),
            autoInit: false
          }
        }),
        getWorkspaceConfig: () => ({
          projectPath: process.cwd(),
          autoInit: false
        })
      })
    }
  }
})
