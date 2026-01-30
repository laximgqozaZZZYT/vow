# AI Coach Guardrails - Tasks

## Implementation Tasks

- [x] 1. Create aiCoachSpec.ts with spec definitions
  - [x] 1.1 Define AI_COACH_ROLE constant
  - [x] 1.2 Define AI_COACH_GUARDRAILS constant
  - [x] 1.3 Define AI_COACH_CONVERSATION_GUIDELINES constant
  - [x] 1.4 Define AI_COACH_HABIT_GUIDELINES constant
  - [x] 1.5 Define AI_COACH_RESPONSE_FORMAT constant
  - [x] 1.6 Implement buildCoachSystemPrompt() function

- [x] 2. Implement guardrail utility functions
  - [x] 2.1 Implement isWithinScope() function
  - [x] 2.2 Implement needsClarification() function
  - [x] 2.3 Implement shouldProceedWithoutClarification() function

- [x] 3. Integrate guardrails into AICoachService
  - [x] 3.1 Import spec functions into aiCoachService.ts
  - [x] 3.2 Add scope check at the beginning of chat()
  - [x] 3.3 Add clarification logic to chat()
  - [x] 3.4 Update system prompt to use buildCoachSystemPrompt()

- [x] 4. Build and deploy
  - [x] 4.1 Build backend
  - [x] 4.2 Build Lambda package
  - [x] 4.3 Deploy to development environment

- [ ] 5. Testing (optional)
  - [ ] 5.1 Test out-of-scope queries
  - [ ] 5.2 Test clarification flow
  - [ ] 5.3 Test "proceed without clarification" flow
