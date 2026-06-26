#!/bin/bash
set -e
cd /home/ubuntu/app/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
echo "Dependencies installed"