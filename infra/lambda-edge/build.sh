#!/bin/bash
# Build Lambda@Edge package

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Building Lambda@Edge auth-check package..."

cd "$SCRIPT_DIR/auth-check"

# Create zip file
zip -r ../auth-check.zip index.js

echo "Package created: $SCRIPT_DIR/auth-check.zip"
