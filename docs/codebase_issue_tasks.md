# Codebase issue tasks

## 1) Typo fix task
**Task:** In the CRM website finder prompt, replace the duplicated phrase `check check` with `check` so generated prompts are clean and professional.

**Why:** The typo appears directly in the prompt template used for AI calls.

**Acceptance criteria:**
- Prompt text reads: `Also check if they have active branches...`.
- No duplicate-word typo remains in that template.

## 2) Bug fix task
**Task:** Prevent website-finder jobs from being stuck in `RUNNING` when another job is already processing.

**Why:** `processJob` exits early whenever `isProcessing` is true. `startJob` still marks the new job as `RUNNING`, so concurrent starts can leave additional jobs in `RUNNING` without actual processing.

**Acceptance criteria:**
- Starting a second job while one is active does not leave it permanently `RUNNING`.
- Jobs are either queued, rejected with explicit state, or processed by per-job locking.
- Add logs/telemetry for skipped/queued jobs.

## 3) Documentation discrepancy task
**Task:** Update local setup docs so environment variables match runtime requirements.

**Why:** `README.md` currently documents only `GEMINI_API_KEY`, while the app initializes Supabase using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

**Acceptance criteria:**
- README `.env.local` section includes required Supabase variables.
- Optional variables are clearly labeled optional.
- Local startup instructions no longer imply Gemini key alone is sufficient.

## 4) Test improvement task
**Task:** Expand `supabase/functions/gemini-ai/test.ts` beyond unauthorized and OPTIONS-only checks.

**Why:** Current tests do not cover successful authorized requests, malformed JSON/body validation, or expected response payload structure.

**Acceptance criteria:**
- Add at least one authorized happy-path test.
- Add malformed-request test (invalid/missing payload).
- Assert response body shape and key headers where applicable.
