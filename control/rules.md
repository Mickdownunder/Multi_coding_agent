# Rules

## Constraints

### Technology Stack
- **Primary**: TypeScript/JavaScript
- **Framework**: Next.js App Router (v16+)
- **Styling**: Tailwind CSS (preferred) or inline styles
- **No external APIs** without explicit approval
- **No databases** - use filesystem or in-memory storage
- **No authentication** - local development only
- **No websockets** - use polling for updates

### Code Quality
- **TypeScript strict mode**: All code must compile without errors
- **No `any` types**: Use proper TypeScript types
- **ESLint compliance**: Follow project linting rules
- **Error handling**: All async operations must have try/catch
- **File operations**: Always use atomic writes with backup/rollback

### File Structure
- **API routes**: `app/api/**/route.ts`
- **Components**: `app/components/**/*.tsx` or `components/**/*.tsx`
- **Types**: `types/**/*.ts`
- **Services**: `execution/services/**/*.ts`
- **Agents**: `execution/agents/**/*.ts`

### Git Workflow
- **Atomic commits**: Each logical change = one commit
- **Structured messages**: `type: description` (e.g., `feat: add user authentication`)
- **No force push**: Never force push to main/master
- **Checkpoints**: Create checkpoints before major changes

## Quality Standards

### Code Requirements
- ✅ Code must compile (`npm run build` succeeds)
- ✅ No TypeScript errors (`npx tsc --noEmit` passes)
- ✅ No runtime errors in console
- ✅ All imports resolve correctly
- ✅ No unused variables or imports

### Testing
- ✅ Critical paths should have tests
- ✅ Tests must pass before committing
- ✅ Use Playwright for E2E tests if needed

### Performance
- ✅ No unnecessary re-renders
- ✅ Efficient file I/O (batch operations when possible)
- ✅ Polling intervals: minimum 2 seconds
- ✅ Token usage: optimize context, use caching

### Security
- ✅ Never commit API keys or secrets
- ✅ Validate all user inputs
- ✅ Sanitize file paths (prevent directory traversal)
- ✅ Check file sizes before reading/writing

## Execution Rules

### State Machine
- **Valid transitions only**: PLAN → IMPLEMENT → VERIFY → DONE/FAIL
- **No skipping states**: Must go through each state sequentially
- **Terminal states**: DONE and FAIL require manual reset to PLAN

### Agent Behavior
- **File-based communication**: Agents communicate via files only
- **No direct agent-to-agent chat**: Use control files
- **Atomic operations**: Use file transactions for critical writes
- **Error recovery**: On error, transition to FAIL (not PLAN)

### Context Management
- **Smart context**: Only include relevant files
- **Cache aggressively**: Reuse context when possible
- **Batch operations**: Group related file reads/writes

### Token Budget
- **Respect limits**: Check budget before LLM calls
- **Optimize prompts**: Use templates, be concise
- **Model selection**: Use cheaper models when appropriate
- **Track usage**: Log all token consumption

## Development Guidelines

### Before Starting
1. Read `intent.md` carefully
2. Check `rules.md` for constraints
3. Review `plan.md` if it exists
4. Check Git status

### During Development
1. **Incremental commits**: Commit after each logical step
2. **Test frequently**: Build and test after major changes
3. **Check logs**: Monitor `control/execution.log`
4. **Respect dependencies**: Follow plan phase/group order

### After Completion
1. **Verify build**: `npm run build` must succeed
2. **Check types**: `npx tsc --noEmit` must pass
3. **Update progress**: Mark steps as complete in `progress.json`
4. **Write report**: Update `report.md` with results

## Error Handling

### On Failure
- **Log errors**: Write to `control/execution.log`
- **Set state to FAIL**: Don't retry indefinitely
- **Preserve context**: Don't delete files on error
- **User notification**: Clear error messages in UI

### Recovery
- **Check logs**: Review `control/execution.log`
- **Fix issues**: Address root cause
- **Reset state**: Manually set state to PLAN
- **Restart execution**: Use "Start Execution" button

## Prohibited Actions

❌ **Never**:
- Delete files without backup
- Force push to Git
- Skip verification steps
- Use `any` types
- Ignore TypeScript errors
- Commit API keys
- Create infinite loops
- Poll more than once per second
- Make unvalidated API calls
- Skip error handling

## Best Practices

✅ **Always**:
- Use TypeScript strict mode
- Validate inputs
- Handle errors gracefully
- Use atomic file operations
- Commit frequently with clear messages
- Test before committing
- Optimize token usage
- Follow the plan structure
- Respect state machine transitions
- Log important operations