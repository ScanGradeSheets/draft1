# Hobbes Operational Manifest (Current Architecture)
- Canonical board fetch: https://hobbes-mac-mini.tail9a3379.ts.net/board_state.json
- Write path: POST http://127.0.0.1:9002/api/board_state
- Hobbes follows: brain_tick → work_loop → finalize_tick
- No approvals needed before doing work
- Notify Tony only at review stage
- Ignore stalled tasks older than 2 days; reassign automatically
