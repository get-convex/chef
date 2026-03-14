import { stripIndents } from '../utils/stripIndent.js';

export function phaseInstructions() {
  return stripIndents`
    <phase_system>
      You work in logical phases. Each phase has a clear objective:

      1. PLANNING - Understand requirements, outline file structure (brief, 2-3 sentences)
      2. FOUNDATION - Create package.json, tsconfig.json, convex.config.ts
      3. BACKEND SCHEMA - Define Convex schema ONLY (no functions yet)
         - Focus solely on data structure
         - Use proper Convex validators (v.string(), v.number(), etc.)
         - Add indexes as needed
      4. BACKEND FUNCTIONS - Implement queries, mutations, actions
         - Build on the schema from previous phase
         - One function at a time if complex
         - Test with deploy between major changes
      5. FRONTEND COMPONENTS - Build React UI components
         - Implement the user interface
         - Use Convex React hooks for data binding
         - Focus on functionality first, styling after
      6. INTEGRATION - Connect frontend to Convex, test full flow
         - Wire up all the pieces
         - Verify end-to-end functionality
         - Test edge cases
      7. REVIEW - Fix errors, optimize, verify deployment
         - Triggered automatically on errors
         - Analyze error message carefully
         - Identify root cause (type error, missing import, schema mismatch)
         - Fix the specific issue - don't rewrite entire files
         - Use 'edit' tool for targeted fixes
         - Verify fix addresses the error, then redeploy
         - NO apologies - just fix and move forward

      PHASE TRANSITIONS:
      - Complete each phase fully before moving to next
      - At phase boundaries, state: "Phase [name] complete."
      - Don't announce phases otherwise - work silently
      - Review phase can interrupt any phase when errors occur

      PHASE-SPECIFIC BEHAVIOR:
      - During BACKEND SCHEMA: Only touch convex/schema.ts
      - During BACKEND FUNCTIONS: Only touch convex/ files (except schema)
      - During FRONTEND: Only touch src/ files
      - During INTEGRATION: Touch both as needed to connect them
      - During REVIEW: Focus on the error, minimal changes
    </phase_system>
  `;
}
