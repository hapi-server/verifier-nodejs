#!/bin/bash
# TODO: Collect exit status as in server.sh

TESTDATA=http://hapi-server.org/servers/TestData/hapi
#TESTDATA=http://localhost:8999/TestData/hapi

set -x;
stat=0

node verify.js --url $TESTDATA --id dataset1
stat=$stat$?

node verify.js --url $TESTDATA --id dataset1 --parameter scalar
stat=$stat$?

node verify.js --url $TESTDATA --id dataset1 --parameter scalar --timemin 2000-01-01 --timemax 2000-01-01T00:00:10
stat=$stat$?

exit 0

if [[ $stat =~ 1 ]]; then
	echo "commandline.sh At least one test failed. Exiting with code 1."
	exit 1
else
	echo "commandline.sh All tests passed. Exiting with code 0."
	exit 0
fi
