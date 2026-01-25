#!/bin/bash
# Build Lambda@Edge packages

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Building Lambda@Edge auth-check package..."
cd "$SCRIPT_DIR/auth-check"
zip -r ../auth-check.zip index.js
echo "Package created: $SCRIPT_DIR/auth-check.zip"

echo "Building Lambda@Edge origin-request package..."
cd "$SCRIPT_DIR/origin-request"
zip -r ../origin-request.zip index.js
echo "Package created: $SCRIPT_DIR/origin-request.zip"

echo "All Lambda@Edge packages built successfully!"
