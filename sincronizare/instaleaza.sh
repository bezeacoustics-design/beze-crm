#!/bin/bash
# Pornește (sau repornește) programul care aduce clienții din mail în CRM, la fiecare 5 minute.
set -e
DEST=~/Library/LaunchAgents/ro.beze.crm-mail.plist
cp "$(dirname "$0")/ro.beze.crm-mail.plist" "$DEST"
launchctl bootout gui/$(id -u)/ro.beze.crm-mail 2>/dev/null || true
launchctl bootstrap gui/$(id -u) "$DEST"
echo "Pornit: ro.beze.crm-mail (jurnal: ~/Library/Logs/BEZE-crm-mail.log)"
