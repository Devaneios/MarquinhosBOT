#!/bin/sh

echo "Registering Discord slash commands..."
npm run register-commands

echo "Starting MarquinhosBOT..."
exec npm run start:prod