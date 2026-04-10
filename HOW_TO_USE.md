# How to use these files with Claude Code

## Setup (one time)
1. mkdir ai-frontdesk-agent
2. cd ai-frontdesk-agent
3. Copy CLAUDE.md into this folder
4. Copy PHASE_1.md into this folder
5. npm install -g @anthropic-ai/claude-code
6. claude

## Starting Phase 1
Paste this exact prompt into Claude Code:

---
Read CLAUDE.md and PHASE_1.md completely before writing any code.

Your job:
1. Build everything in PHASE_1.md in the exact file order listed
2. After each file, write its tests immediately
3. Run the tests: pytest tests/ -v
4. If tests fail, debug and fix WITHOUT asking me
5. Keep going until all tests in PHASE_1.md pass
6. For external APIs (Vapi, Twilio, Google), mock them in tests
7. At the end, tell me: what was built, test results, 
   and what needs a real API key to verify live

Do not ask me questions unless you hit something not covered in CLAUDE.md.
---

## Starting each new phase
1. Copy the phase file into your project folder
2. Update CLAUDE.md status section to show which phase you're on
3. Start a new Claude Code session: claude
4. Paste this prompt (change the phase number):

---
Read CLAUDE.md and PHASE_X.md completely.

CLAUDE.md shows current status. We are now on Phase X.
All previous phases are complete and tested.

Your job:
1. Build everything listed in PHASE_X.md
2. After each module, write tests and run them
3. Self-debug all failures — do not stop for permission
4. Run full test suite at end: pytest tests/ -v
5. Report: what was built, test results, any blockers

Do not rebuild Phase 1-X files unless they need updating 
for Phase X to work.
---

## test the validity of previous phases done by AI

Read AGENTS.md and PHASE_1.md fully.

I built Phase 1 completely. Audit the entire codebase against the spec:

1. Does every file in PHASE_1.md exist and do what it's supposed to?
2. Are there any security issues (unvalidated webhooks, unencrypted data, bare excepts)?
3. Are there gaps or shortcuts that will cause problems in later phases?
4. Run all tests: pytest tests/ -v — fix any failures
5. Give me a clear report: what matches spec, what's missing, what needs fixing

Do not rewrite things that work. Only fix real problems.


## If something breaks mid-phase
Paste this:

---
Read CLAUDE.md. We are on Phase X.

Something is broken. Here is the error:
[paste full error log]

Debug this:
1. Identify root cause
2. Fix it
3. Run the relevant test to confirm fix
4. Tell me what was wrong and what you changed
---

## After each phase completes
Update the status section in CLAUDE.md:
"Phase X — complete. [one line of what works]"
"Current phase: X+1"
