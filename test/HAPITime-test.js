var fs       = require('fs');
var moment   = require('moment');
var clc      = require('chalk');
var HAPITime = require('../is.js').HAPITime;

// Read test file (see header for format)
var tests = fs.readFileSync('./HAPITime-tests.txt').toString();
var tests = tests.split(/\n/);
var VERSION = '2.0-1';

var schemaregexes = require('../is.js').timeregexes(VERSION);

console.log("----------------------")
for (var i = 0;i < tests.length; i++) {

	var tmp = tests[i].split(",");
	var isostr = tmp[0]; 		// String to test
	var expect = tmp[1]; 		// Expected result is second column of file
	expect = expect === "1" ? true: false; // Convert to boolean
	var reason = tmp[2] || "";  // Explanation for passing/failing

	if (!/^\d/.test(isostr)) {continue;} // Ignore lines that dont start with digit

	if (reason) {reason = " ("+reason+")"}
	hapi = HAPITime(isostr,VERSION);
	test_hapi = !hapi.error;
	test_moment = moment(isostr.replace(/Z$/,""),moment.ISO_8601).isValid();
	//console.log(test_hapi);
	//console.log(tmp[1]);
	//console.log(test_moment);

	//console.log(test_hapi)
	var errmsg  = (test_hapi === expect) ? "??? Error: HAPITime code got wrong answer.": "";
	var warnmsg = (test_hapi != test_moment) ? "Warning: HAPITime result differs from moment.js.": "";
	if (test_hapi === expect) {
		var prefix = clc.green.bold("PASS");
	} else {
		var prefix = clc.red.bold("FAIL");
	}
	console.log(prefix + " " + isostr + ": " + (test_hapi ? "Valid": "Invalid")
				+ ". Expected: " + (expect ? "Valid": "Invalid")
				+ ". moment.js: " + (test_moment ? "Valid": "Invalid")
				+ reason);// + " " + clc.red(warnmsg) + clc.red(errmsg));


}
console.log("----------------------")