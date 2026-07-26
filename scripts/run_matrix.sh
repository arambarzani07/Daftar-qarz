#!/usr/bin/env bash
pkill -f "node" || true
sleep 1
npx tsx server.ts &
SERVER_PID=$!
sleep 3

npx tsx scripts/verify_owner_protection_approval.ts
TEST_EXIT=$?

kill $SERVER_PID || true
pkill -f "node" || true
exit $TEST_EXIT
