# Contributing to RetinaScan AI

## Branch Naming
- feature/your-feature-name
- fix/bug-description
- docs/what-you-documented

## Commit Message Format
Use clear, descriptive commit messages:
✅ "feat: add WhatsApp sharing modal with number validation"
✅ "fix: convert heatmap blob to Base64 before IndexedDB storage"
❌ "fixed stuff"
❌ "changes"

## Pull Request Rules
- Keep PRs small and focused on ONE feature or fix
- Write a PR description explaining: what you changed, why, and how to test it
- Example PR title: "feat: add dual-eye parallel inference using Promise.all()"

## Code Review Checklist
Before submitting a PR, verify:
- [ ] No unused imports
- [ ] All new functions have JSDoc comments
- [ ] No pixel sizes 224/400/1024 modified
- [ ] Tested offline mode works after changes
- [ ] No console.log left in production code (use console.warn for non-fatal issues)
