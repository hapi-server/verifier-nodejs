#!/bin/bash
# TODO: Collect exit status as in server.sh

TESTDATA=http://mag.gmu.edu/TestData/hapi
TESTDATA=http://localhost:8999/hapi
set -x;

node verify.js --url $TESTDATA --id dataset1 --timemin 2000-01-01 --timemax 2000-01-01T00:00:10
stat=$stat$?

node verify.js --url $TESTDATA --id dataset1 --parameter scalar
stat=$stat$?

node verify.js --url $TESTDATA --id dataset0
stat=$?

node verify.js --url $TESTDATA --id dataset1
stat=$stat$?

node verify.js --url http://jfaden.net/HapiServerDemo/hapi
stat=$stat$?

node verify.js --url http://tsds.org/get/SSCWeb/hapi --id ace
stat=$stat$?

node verify.js --url https://voyager.gsfc.nasa.gov/hapiproto/hapi --id AC_H0_MFI --timemin 2013-04-13T07:00:00 --timemax 2013-04-14T11:00:00
stat=$stat$?

node verify.js --url http://datashop.elasticbeanstalk.com/hapi --id WEYGAND_GEOTAIL_MAG_GSM
stat=$stat$?

if [[ $stat =~ 1 ]]; then
	echo "commandline.sh At least one test failed. Exiting with code 1."
	exit 1
else
	echo "commandline.sh All tests passed. Exiting with code 0."
	exit 0
fi