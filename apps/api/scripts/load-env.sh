#!/bin/bash
# Load environment variables from root .env file
if [ -f "../../.env" ]; then
  export $(cat ../../.env | xargs)
fi

# Run the provided command
exec "$@"
