#!/bin/bash
source ~/.nvm/nvm.sh && nvm use 8

if [ "$1" = "devel" ]; then
    nodemon verify.js --port 9997 --plotserver http://localhost:5000/
else
    nohup forever verify.js --port 9997 2>&1 &
    tail -f nohup.out
fi
