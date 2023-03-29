#!/bin/bash
source ~/.nvm/nvm.sh && nvm use 16

if [ "$1" = "devel" ]; then
    nodemon verify.js --port 9997 --plotserver http://localhost:5000/
else
    node --max-old-space-size=96 verify.js --port 9997
fi
