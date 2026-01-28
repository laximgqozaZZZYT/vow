#!/bin/bash
# Build Lambda deployment package for TypeScript backend
# This script creates a zip file containing the compiled TypeScript code and dependencies

set -e

echo "🔨 Building TypeScript backend for Lambda deployment..."

# Navigate to backend directory
cd "$(dirname "$0")/.."

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist lambda-package lambda-package.zip

# Build TypeScript
echo "📦 Compiling TypeScript..."
npm run build || echo "⚠️ TypeScript compilation had errors, continuing with available output..."

# Create lambda package directory
echo "📁 Creating Lambda package..."
mkdir -p lambda-package

# Copy compiled code
cp -r dist/* lambda-package/

# Copy specs directory (AI Coach specifications)
echo "📋 Copying AI Coach specs..."
if [ -d "specs" ]; then
  cp -r specs lambda-package/
  echo "   ✓ Specs directory copied"
else
  echo "   ⚠️ Specs directory not found"
fi

# Copy package.json (for reference)
cp package.json lambda-package/

# Install production dependencies
echo "📥 Installing production dependencies..."
cd lambda-package
npm install --omit=dev --ignore-scripts

# Remove unnecessary files
echo "🗑️ Removing unnecessary files..."
rm -rf node_modules/.bin
rm -rf node_modules/**/test
rm -rf node_modules/**/tests
rm -rf node_modules/**/*.md
rm -rf node_modules/**/*.ts
rm -rf node_modules/**/LICENSE*
rm -rf node_modules/**/CHANGELOG*

# Create zip file
echo "📦 Creating zip file..."
cd ..
zip -r lambda-package.zip lambda-package -x "*.git*" -x "*.DS_Store"

# Get file size
SIZE=$(du -h lambda-package.zip | cut -f1)
echo "✅ Lambda package created: lambda-package.zip ($SIZE)"

echo ""
echo "📋 Next steps:"
echo "1. Upload lambda-package.zip to AWS Lambda"
echo "2. Set handler to: lambda-package/lambda.handler"
echo "3. Set runtime to: Node.js 20.x"
echo "4. Configure environment variables:"
echo "   - SUPABASE_URL"
echo "   - SUPABASE_SERVICE_ROLE_KEY"
echo "   - JWT_SECRET"
echo "   - SLACK_CLIENT_ID"
echo "   - SLACK_CLIENT_SECRET"
echo "   - SLACK_SIGNING_SECRET"
echo "   - TOKEN_ENCRYPTION_KEY"
