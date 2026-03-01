#!/bin/sh

echo "Registering Discord slash commands..."
bun run register-commands

echo "Starting MarquinhosBOT..."
exec bun run start