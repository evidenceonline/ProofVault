#!/bin/bash

# ProofVault Port 80 Setup Script
# This script sets up port forwarding from port 80 to port 3005

echo "Setting up port forwarding from port 80 to port 3005..."

# Add iptables rule to forward port 80 to 3005
iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 3005

# Save the iptables rules (varies by system)
if command -v iptables-save > /dev/null; then
    iptables-save > /etc/iptables/rules.v4
elif command -v service > /dev/null && service iptables status > /dev/null 2>&1; then
    service iptables save
fi

echo "Port forwarding setup complete!"
echo "Your website should now be accessible on port 80"
echo ""
echo "To run this script: sudo bash setup-port80.sh"
echo "To remove forwarding: sudo iptables -t nat -D PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 3005"