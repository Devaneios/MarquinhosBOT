#!/bin/bash

source /etc/marquinhos/marquinhos.conf

DESTINATION_DIR="$1"

service=$(cat << EOF
[Unit]

Description=MarquinhosBOT

After=network.target

[Service]

Environment="TOKEN=$MARQUINHOS_TOKEN"
Environment="PREFIX=$MARQUINHOS_PREFIX"
Environment="CLIENT_ID=$MARQUINHOS_CLIENT_ID"
Environment="MONGO_URI=$MARQUINHOS_MONGO_URI"
Environment="MONGO_DATABASE_NAME=$MARQUINHOS_MONGO_DATABASE_NAME"
Environment="BOT_ID=$MARQUINHOS_BOT_ID"
Environment="MARQUINHOS_API_KEY=$MARQUINHOS_API_KEY"
Environment="MARQUINHOS_API_URL=$MARQUINHOS_API_URL"
Environment="NODE_ENV=production"

User=guilherme

KillMode=control-group

WorkingDirectory=$DESTINATION_DIR

ExecStart=node -r tsconfig-paths/register ./index.js

Restart=always

RestartSec=30

StartLimitInterval=0


[Install]

WantedBy=multi-user.target

EOF

)

systemctl stop marquinhos.service

echo "$service" > /etc/systemd/system/marquinhos.service

systemctl daemon-reload

systemctl enable marquinhos.service

systemctl start marquinhos.service

systemctl status marquinhos.service

