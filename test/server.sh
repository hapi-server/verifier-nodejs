#!/bin/bash

TESTDATA=http://mag.gmu.edu/TestData/hapi
#TESTDATA=http://localhost:8999/hapi
#VURL=http://localhost:9999/verify-hapi
VURL=http://localhost:9999

set -x;
node verify.js --port 9999 &
stat=$?

PID=$!;

sleep 2

curl "$VURL/?url=$TESTDATA&time.min=2000-01-01&time.max=2000-01-01T00:00:10&id=dataset1" > test.html
grep "End of validation tests." test.html
stat=$stat$?

curl "$VURL/?url=$TESTDATA&id=dataset1&parameter=scalar" > test.html
grep "End of validation tests." test.html
stat=$stat$?

curl "$VURL/?url=$TESTDATA&id=dataset1" > test.html
grep "End of validation tests." test.html
stat=$stat$?

curl "$VURL/?url=http://jfaden.net/HapiServerDemo/hapi" > test.html
grep "End of validation tests." test.html
stat=$stat$?

curl "$VURL/?url=https://cdaweb.gsfc.nasa.gov/hapi&id=AC_H0_MFI&time.min=2013-04-13T07:00:00&time.max=2013-04-14T11:00:00" > test.html
grep "End of validation tests." test.html
stat=$stat$?

curl "$VURL/?url=http://datashop.elasticbeanstalk.com/hapi&id=CASSINI_MAG_HI_RES" > test.html
grep "End of validation tests." test.html
stat=$stat$?

kill -9 $PID

if [[ $stat =~ 1 ]]; then
	echo "server.sh At least one test failed. Exiting with code 1."
	exit 1
else
	echo "server.sh All tests passed. Exiting with code 0."
	exit 0
fi
