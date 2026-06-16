## 1. Behavior Coverage

- [x] 1.1 Add a failing `continueConversation`/`continueCreateStory` test where incomplete story setup causes Archivist to call `createQuestion` again.
- [x] 1.2 Assert the continuation stream includes the `createQuestion` tool call and the assistant message persists that tool call.
- [x] 1.3 Assert Weaver is not consumed/run in the same turn when Archivist asks a follow-up question.
- [x] 1.4 Add a failing multi-question continuation test where answering Q2 still sends Q1/A1 and Q2/A2 question context to Archivist.
- [x] 1.5 Assert non-`createQuestion` messages from the recent 10-message slice are not included in the question-context portion.
- [x] 1.6 Update the mock provider so repeated tool calls receive unique `toolCallId` values before adding multi-turn tool-call assertions.

## 2. Server Action Implementation

- [x] 2.1 Update `continueCreateStory` so Archivist uses `archivist.stream()` instead of `archivist.generate()`.
- [x] 2.2 Detect non-dynamic Archivist `createQuestion` tool calls from the Archivist stream result after the stream completes.
- [x] 2.3 When a question tool call exists, persist the Archivist stream result through the existing assistant-message save path and return the Archivist stream result to the caller.
- [x] 2.4 Keep the token usage behavior correct: short-circuit Archivist usage is accumulated only by `saveMessageWithTool`, while non-short-circuit Archivist usage is accumulated before Weaver persistence.
- [x] 2.5 Preserve the current Weaver path when Archivist does not call `createQuestion`.
- [x] 2.6 During incomplete story setup, query the 10 most recent chat messages with tool calls and filter assistant messages containing `createQuestion`.
- [x] 2.7 Build Archivist input from story/runtime/history plus filtered question messages converted with `toModelMessages()`, replacing the latest DB question message with the in-memory latest message whose unresolved question result is set to the current prompt.
- [x] 2.8 Ensure filtered question messages are converted in chronological order, and append the current prompt as a normal user message when no unresolved latest question exists.

## 3. Verification

- [x] 3.1 Run the targeted `lib/actions/llm.test.ts` tests from the project-supported test context.
- [x] 3.2 Run `bun lint --fix`.
- [x] 3.3 Run `bunx tsc --noEmit`.
