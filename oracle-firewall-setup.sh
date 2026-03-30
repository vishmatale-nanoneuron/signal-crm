#!/bin/bash
# Run this on the Oracle Cloud VM to open ports in the OS firewall
# Oracle Cloud Ubuntu VMs have iptables rules blocking ports by default

echo "Opening ports 80, 443, 8000 in iptables..."

sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8000 -j ACCEPT

# Save rules so they persist after reboot
sudo netfilter-persistent save 2>/dev/null || sudo iptables-save | sudo tee /etc/iptables/rules.v4

echo "Firewall rules updated. Ports 80, 443, 8000 are now open."
