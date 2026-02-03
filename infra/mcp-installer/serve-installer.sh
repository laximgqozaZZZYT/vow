#!/bin/bash
#
# Serve the MCP installer via HTTP for easy distribution
#
# Usage:
#   ./serve-installer.sh [port]
#
# Then on other machines:
#   curl -fsSL http://YOUR_IP:8080/install.sh | bash
#

PORT="${1:-8080}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Get local IP
LOCAL_IP=$(ip route get 1 2>/dev/null | awk '{print $7; exit}' || echo "localhost")

echo "============================================================"
echo "  MCP Installer Server"
echo "============================================================"
echo ""
echo "  Serving installer at:"
echo "    http://${LOCAL_IP}:${PORT}/install.sh"
echo ""
echo "  Install command (run on target machine):"
echo "    curl -fsSL http://${LOCAL_IP}:${PORT}/install.sh | bash"
echo ""
echo "  With custom options:"
echo "    curl -fsSL http://${LOCAL_IP}:${PORT}/install.sh | INSTALL_DIR=/opt/mcp bash"
echo "    curl -fsSL http://${LOCAL_IP}:${PORT}/install.sh | AUTO_START=true bash"
echo ""
echo "  Press Ctrl+C to stop"
echo "============================================================"
echo ""

cd "$SCRIPT_DIR"

# Use Python's built-in HTTP server
if command -v python3 &>/dev/null; then
    python3 -m http.server "$PORT"
elif command -v python &>/dev/null; then
    python -m SimpleHTTPServer "$PORT"
else
    echo "Error: Python not found. Install Python or use another HTTP server."
    exit 1
fi
