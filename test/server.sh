#!/bin/bash

#TESTDATA=http://mag.gmu.edu/TestData/hapi
TESTDATA=http://localhost:8999/hapi

set -x;
node verify.js --port 9999 &
stat=$?

PID=$!;

sleep 2

curl "http://localhost:9999/verify-hapi/?url=$TESTDATA&time.min=2001-01-01&time.max=2000-01-01T00:00:10&id=dataset1"
grep "End of validation tests." test.html
stat=$stat$?

rm -f test.html

kill -9 $PID

if [[ $stat =~ 1 ]]; then
	echo "server.sh At least one test failed. Exiting with code 1."
	exit 1
else
	echo "server.sh All tests passed. Exiting with code 0."
	exit 0
fi
