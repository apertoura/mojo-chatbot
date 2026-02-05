#!/bin/bash
# Video processor control script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_SCRIPT="$SCRIPT_DIR/process-videos-async.js"
LOG_FILE="$SCRIPT_DIR/../video-processing.log"
PID_FILE="$SCRIPT_DIR/../video-processor.pid"

case "${1:-}" in
  start)
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
      echo "❌ Video processor already running (PID: $(cat $PID_FILE))"
      exit 1
    fi
    
    echo "🚀 Starting video processor..."
    cd "$SCRIPT_DIR/.."
    nohup node "$NODE_SCRIPT" > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    echo "✅ Started (PID: $!, log: $LOG_FILE)"
    ;;
    
  stop)
    if [ ! -f "$PID_FILE" ]; then
      echo "❌ Video processor not running"
      exit 1
    fi
    
    PID=$(cat "$PID_FILE")
    echo "🛑 Stopping video processor (PID: $PID)..."
    kill $PID 2>/dev/null
    rm -f "$PID_FILE"
    echo "✅ Stopped"
    ;;
    
  status)
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
      PID=$(cat "$PID_FILE")
      echo "✅ Running (PID: $PID)"
      echo ""
      tail -15 "$LOG_FILE" 2>/dev/null || echo "No logs yet"
    else
      echo "❌ Not running"
      [ -f "$PID_FILE" ] && rm -f "$PID_FILE"
    fi
    ;;
    
  log)
    tail -f "$LOG_FILE"
    ;;
    
  *)
    echo "Usage: $0 {start|stop|status|log}"
    exit 1
    ;;
esac
