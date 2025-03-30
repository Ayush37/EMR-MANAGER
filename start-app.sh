#!/bin/bash

# Start the backend and frontend together
# This script uses tmux to run both services in split panes

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo "tmux could not be found, please install it."
    echo "On Ubuntu/Debian: sudo apt-get install tmux"
    echo "On CentOS/RHEL: sudo yum install tmux"
    echo "On MacOS: brew install tmux"
    exit 1
fi

# Create a new tmux session
tmux new-session -d -s emr-manager

# Split the window horizontally
tmux split-window -h -t emr-manager

# Start the backend in the left pane
tmux send-keys -t emr-manager:0.0 "cd backend && bash start-backend.sh" C-m

# Start the frontend in the right pane
tmux send-keys -t emr-manager:0.1 "cd frontend && npm start" C-m

# Attach to the session
tmux attach -t emr-manager

# Note: To exit, press Ctrl+B then D to detach, or Ctrl+B then X to kill the current pane
