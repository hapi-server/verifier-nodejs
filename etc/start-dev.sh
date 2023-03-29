#!/bin/bash
source ~/.nvm/nvm.sh && nvm use 16

if [ "$1" = "devel" ]; then
    nodemon verify.js --port 9996 --plotserver http://localhost:5000/
else
    #cpulimit -l 5 -- nice -20 node --max-old-space-size=96 verify.js --port 9996 
    node --max-old-space-size=96 verify.js --port 9996
fi
