#!/bin/bash
# =============================================================================
# VOW MCP Remote Agent - Quick Installer
# =============================================================================
# Download and run with:
#   curl -sSL http://192.168.2.126:3000/api/mcp-installer | bash -s -- \
#     --server-url http://192.168.2.126:3456 --token YOUR_TOKEN
#
# Or download and run manually:
#   curl -O http://192.168.2.126:3000/api/mcp-installer/install.sh
#   chmod +x install.sh
#   ./install.sh --server-url http://192.168.2.126:3456 --token YOUR_TOKEN
# =============================================================================

set -e

# Default server (can be overridden)
DEFAULT_SERVER="http://192.168.2.126:3456"
INSTALLER_URL="${INSTALLER_URL:-http://192.168.2.126:3000/api/mcp-installer/install.sh}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "=============================================="
echo "  VOW MCP Remote Agent - Quick Installer"
echo "=============================================="
echo -e "${NC}"

# Create temp directory
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

echo -e "${YELLOW}Downloading installer...${NC}"

# Download main installer
if command -v curl &> /dev/null; then
  curl -sSL -o install.sh "$INSTALLER_URL"
elif command -v wget &> /dev/null; then
  wget -q -O install.sh "$INSTALLER_URL"
else
  echo -e "${RED}Error: Neither curl nor wget found${NC}"
  exit 1
fi

chmod +x install.sh

echo -e "${GREEN}Running installer...${NC}"
echo ""

# Pass all arguments to the installer
./install.sh "$@"

# Cleanup
cd /
rm -rf "$TEMP_DIR"
