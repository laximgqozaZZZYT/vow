#!/bin/bash

# 🚀 Vow - Quick Deploy Script
# 最短でWEBサービスを公開するためのセットアップスクリプト

set -e

echo "🚀 Vow - Quick Deploy Setup"
echo "=========================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if required tools are installed
check_requirements() {
    echo -e "${BLUE}Checking requirements...${NC}"
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ first.${NC}"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm is not installed. Please install npm first.${NC}"
        exit 1
    fi
    
    if ! command -v git &> /dev/null; then
        echo -e "${RED}❌ git is not installed. Please install git first.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All requirements satisfied${NC}"
}

# Install dependencies
install_dependencies() {
    echo -e "${BLUE}Installing dependencies...${NC}"
    
    echo "📦 Installing root dependencies..."
    npm install
    
    echo "📦 Installing backend dependencies..."
    cd backend && npm install && cd ..
    
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
    
    echo -e "${GREEN}✅ Dependencies installed${NC}"
}

# Build projects
build_projects() {
    echo -e "${BLUE}Building projects...${NC}"
    
    echo "🔨 Building backend..."
    cd backend && npm run build && cd ..
    
    echo "🔨 Building frontend..."
    cd frontend && npm run build && cd ..
    
    echo -e "${GREEN}✅ Projects built successfully${NC}"
}

# Run security tests
run_security_tests() {
    echo -e "${BLUE}Running security tests...${NC}"
    
    # Start backend for testing
    echo "🔧 Starting backend for testing..."
    cd backend
    DATABASE_URL="postgresql://test:test@localhost:5432/test" NODE_ENV=test npm start &
    BACKEND_PID=$!
    cd ..
    
    # Wait for backend to start
    sleep 10
    
    # Run security tests
    echo "🔒 Running security tests..."
    API_URL="http://localhost:4000" NEXT_PUBLIC_SUPABASE_URL="https://example.supabase.co" npm run security-test
    
    # Stop backend
    kill $BACKEND_PID 2>/dev/null || true
    
    echo -e "${GREEN}✅ Security tests passed${NC}"
}

# Display deployment instructions
show_deployment_instructions() {
    echo -e "${YELLOW}"
    echo "🎉 Setup completed successfully!"
    echo "================================"
    echo ""
    echo "Next steps for deployment:"
    echo ""
    echo "1. 📚 Read the deployment guide:"
    echo "   cat docs/deployment-guide.md"
    echo ""
    echo "2. 🔧 Set up external services:"
    echo "   - Supabase (Authentication): https://supabase.com"
    echo "   - Railway (Backend + DB): https://railway.app"
    echo "   - Vercel (Frontend): https://vercel.com"
    echo ""
    echo "3. 🚀 Deploy in this order:"
    echo "   a) Create Supabase project"
    echo "   b) Deploy backend to Railway"
    echo "   c) Deploy frontend to Vercel"
    echo "   d) Update URLs and test"
    echo ""
    echo "4. ⚡ Quick deploy (if accounts ready):"
    echo "   - Railway: Connect GitHub repo → Set env vars → Deploy"
    echo "   - Vercel: Connect GitHub repo → Set env vars → Deploy"
    echo "   - Total time: ~5 minutes"
    echo ""
    echo "5. 🔒 Security validation:"
    echo "   npm run security-full"
    echo ""
    echo "📖 Full guide: docs/deployment-guide.md"
    echo -e "${NC}"
}

# Main execution
main() {
    echo -e "${GREEN}Starting quick deploy setup...${NC}"
    
    check_requirements
    install_dependencies
    build_projects
    
    # Skip security tests if DATABASE_URL is not available
    if [[ -n "${DATABASE_URL}" ]]; then
        run_security_tests
    else
        echo -e "${YELLOW}⚠️  Skipping security tests (no DATABASE_URL)${NC}"
        echo -e "${YELLOW}   Run 'npm run security-test' after setting up database${NC}"
    fi
    
    show_deployment_instructions
}

# Run main function
main "$@"