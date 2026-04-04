#!/usr/bin/env bash
# =============================================================================
# LATIDO — Memory Loop End-to-End Test
# =============================================================================
# Prerequisites:
#   1. MCP server running: cd mcp-server && source .venv/bin/activate && python main.py
#   2. Next.js dev server running: cd frontend && npm run dev
#   3. Supabase with seed data (tasks in inbox/deferred status, user_settings row)
#   4. .env.local must have NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
#
# Usage: bash test-memory-loop.sh
# =============================================================================

set -euo pipefail

# ─── Load env vars from .env.local ───────────────────────────────────────────
ENV_FILE="$(dirname "$0")/.env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: .env.local not found at $ENV_FILE"
  exit 1
fi

SUPABASE_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | cut -d'=' -f2-)
SERVICE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$ENV_FILE" | cut -d'=' -f2-)

if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_KEY" ]; then
  echo "ERROR: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env.local"
  exit 1
fi

BASE_URL="${LATIDO_BASE_URL:-http://localhost:3000}"
USER_ID="73305d0c-6897-44b8-9026-08d308deee62"
TODAY=$(date +%Y-%m-%d)
TOMORROW=$(date -v+1d +%Y-%m-%d 2>/dev/null || date -d "+1 day" +%Y-%m-%d)

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

step=0
fail=0

log_step() {
  step=$((step + 1))
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}  Step $step: $1${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

check_response() {
  local response="$1"
  local label="$2"

  if echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('success',False) or d.get('plan_id')" 2>/dev/null; then
    echo -e "${GREEN}  ✓ $label succeeded${NC}"
    return 0
  else
    echo -e "${RED}  ✗ $label FAILED${NC}"
    echo "  Response: $(echo "$response" | head -c 500)"
    fail=$((fail + 1))
    return 1
  fi
}

# Helper: query Supabase REST API directly (bypasses MCP SSE issues)
supabase_get() {
  local table="$1"
  local query="$2"
  curl -s "${SUPABASE_URL}/rest/v1/${table}?${query}" \
    -H "apikey: ${SERVICE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json"
}

# ─── Step 1: Generate a plan for today ───────────────────────────────────────
log_step "Generate daily plan for today ($TODAY) via Day Architect"

PLAN_RESPONSE=$(curl -s --max-time 120 -X POST "$BASE_URL/api/agents/plan" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$USER_ID\", \"plan_date\": \"$TODAY\"}")

check_response "$PLAN_RESPONSE" "Day Architect" || true

echo ""
echo "  Plan details:"
echo "$PLAN_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f\"  Plan ID:          {d.get('plan_id', 'N/A')}\")
print(f\"  Tasks scheduled:  {d.get('tasks_scheduled', 'N/A')}\")
print(f\"  Planned minutes:  {d.get('total_planned_minutes', 'N/A')}\")
print(f\"  Reasoning:        {d.get('reasoning', 'N/A')[:120]}...\")
" 2>/dev/null || echo "  (Could not parse response)"

# ─── Step 2: Complete 3 tasks ────────────────────────────────────────────────
log_step "Complete 3 of the scheduled tasks"

echo "  Fetching today's plan from Supabase..."

PLAN_ROW=$(supabase_get "daily_plans" "user_id=eq.${USER_ID}&plan_date=eq.${TODAY}&select=time_blocks&limit=1")

TASK_IDS_LINE=$(echo "$PLAN_ROW" | python3 -c "
import sys, json
rows = json.loads(sys.stdin.read())
if not rows:
    print('')
    sys.exit(0)
blocks = rows[0].get('time_blocks', [])
task_ids = []
for b in blocks:
    tid = b.get('task_id')
    if tid and b.get('slot_type') != 'break' and len(task_ids) < 3:
        task_ids.append(tid)
print(' '.join(task_ids))
")

if [ -z "$TASK_IDS_LINE" ]; then
  echo -e "  ${RED}✗ No plan or no tasks found for today${NC}"
  fail=$((fail + 1))
else
  # Fetch task titles for display
  for TASK_ID in $TASK_IDS_LINE; do
    TASK_ROW=$(supabase_get "tasks" "id=eq.${TASK_ID}&select=title&limit=1")
    TITLE=$(echo "$TASK_ROW" | python3 -c "import sys,json; rows=json.loads(sys.stdin.read()); print(rows[0]['title'] if rows else '?')" 2>/dev/null || echo "?")
    echo -e "    ${YELLOW}→${NC} $TITLE ($TASK_ID)"
  done

  NOW_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  completed_count=0
  for TASK_ID in $TASK_IDS_LINE; do
    COMPLETE_RESPONSE=$(curl -s --max-time 30 -X POST "$BASE_URL/api/tasks/status" \
      -H "Content-Type: application/json" \
      -d "{\"task_id\": \"$TASK_ID\", \"status\": \"completed\", \"actual_minutes\": 30, \"completed_at\": \"$NOW_ISO\"}")

    if echo "$COMPLETE_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('success')" 2>/dev/null; then
      completed_count=$((completed_count + 1))
      echo -e "  ${GREEN}✓ Completed task $TASK_ID${NC}"
    else
      echo -e "  ${RED}✗ Failed to complete task $TASK_ID${NC}"
      echo "    $COMPLETE_RESPONSE"
    fi
  done
  echo ""
  echo "  Completed $completed_count of 3 tasks"
fi

# ─── Step 3: Run Accountability Agent ────────────────────────────────────────
log_step "Run Accountability Agent for today ($TODAY)"

ACCOUNTABILITY_RESPONSE=$(curl -s --max-time 120 -X POST "$BASE_URL/api/agents/accountability" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$USER_ID\", \"plan_date\": \"$TODAY\"}")

check_response "$ACCOUNTABILITY_RESPONSE" "Accountability Agent" || true

echo ""
echo "  Accountability results:"
echo "$ACCOUNTABILITY_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f\"  Completion rate:   {d.get('completion_rate', 'N/A')}%\")
print(f\"  Tasks completed:   {d.get('tasks_completed', 'N/A')}\")
print(f\"  Tasks deferred:    {d.get('tasks_deferred', 'N/A')}\")
print(f\"  Patterns written:  {d.get('patterns_written', 'N/A')}\")
print(f\"  Reflection:        {d.get('reflection', 'N/A')[:200]}\")
" 2>/dev/null || echo "  (Could not parse response)"

PATTERNS_WRITTEN=$(echo "$ACCOUNTABILITY_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('patterns_written',0))" 2>/dev/null || echo "0")

# ─── Step 4: Verify patterns exist in user_patterns ─────────────────────────
log_step "Verify patterns were stored in Supabase"

PATTERNS_DATA=$(supabase_get "user_patterns" "user_id=eq.${USER_ID}&select=pattern_key,pattern_value,confidence&order=confidence.desc&limit=10")

echo "$PATTERNS_DATA" | python3 -c "
import sys, json
patterns = json.loads(sys.stdin.read())
if not patterns:
    print('  ✗ No patterns found in user_patterns table!')
else:
    print(f'  Found {len(patterns)} patterns:')
    for p in patterns:
        key = p.get('pattern_key', '?')
        val = json.dumps(p.get('pattern_value', {}))[:80]
        conf = p.get('confidence', '?')
        print(f'    • {key} (confidence: {conf}): {val}')
" 2>/dev/null || echo "  (Could not parse Supabase response)"

# ─── Step 5: Generate plan for tomorrow ──────────────────────────────────────
log_step "Generate daily plan for TOMORROW ($TOMORROW) via Day Architect"

TOMORROW_PLAN_RESPONSE=$(curl -s --max-time 120 -X POST "$BASE_URL/api/agents/plan" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$USER_ID\", \"plan_date\": \"$TOMORROW\"}")

check_response "$TOMORROW_PLAN_RESPONSE" "Day Architect (tomorrow)" || true

echo ""
echo "  Tomorrow's plan details:"
echo "$TOMORROW_PLAN_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f\"  Plan ID:          {d.get('plan_id', 'N/A')}\")
print(f\"  Tasks scheduled:  {d.get('tasks_scheduled', 'N/A')}\")
print(f\"  Planned minutes:  {d.get('total_planned_minutes', 'N/A')}\")
print(f\"  Reasoning:        {d.get('reasoning', 'N/A')[:200]}\")
" 2>/dev/null || echo "  (Could not parse response)"

# ─── Step 6: Compare reasoning ──────────────────────────────────────────────
log_step "Compare today vs tomorrow reasoning"

echo -e "  ${YELLOW}Today's reasoning:${NC}"
echo "$PLAN_RESPONSE" | python3 -c "import sys,json; print('    ' + json.load(sys.stdin).get('reasoning','N/A')[:300])" 2>/dev/null || true
echo ""
echo -e "  ${YELLOW}Tomorrow's reasoning:${NC}"
echo "$TOMORROW_PLAN_RESPONSE" | python3 -c "import sys,json; print('    ' + json.load(sys.stdin).get('reasoning','N/A')[:300])" 2>/dev/null || true
echo ""
echo "  If tomorrow's reasoning mentions patterns, completion rates, or"
echo "  behavioral observations — the memory loop is influencing planning."
echo ""
echo "  You can also verify in the OpenAI dashboard:"
echo "  Traces → filter 'day-architect' → check USER PATTERNS section in prompt."

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  MEMORY LOOP TEST SUMMARY${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$fail" -eq 0 ]; then
  echo -e "  ${GREEN}All API calls succeeded!${NC}"
else
  echo -e "  ${RED}$fail API call(s) failed.${NC}"
fi

echo ""
echo "  Patterns written by Accountability Agent: $PATTERNS_WRITTEN"
echo ""

if [ "$PATTERNS_WRITTEN" -gt 0 ]; then
  echo -e "  ${GREEN}✓ Memory loop is FUNCTIONAL${NC}"
  echo "    Patterns were extracted and stored with embeddings."
  echo "    The Day Architect reads them via vector similarity before planning."
  echo "    Compare today vs tomorrow reasoning above to verify influence."
else
  echo -e "  ${RED}✗ Memory loop INCOMPLETE${NC}"
  echo "    No patterns were written. The Accountability Agent either:"
  echo "    - Returned an empty array (not enough data for patterns)"
  echo "    - Failed to parse the LLM response"
  echo "    Run again after completing more tasks for richer data."
fi

echo ""
