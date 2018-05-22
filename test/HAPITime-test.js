var fs       = require('fs');
var moment   = require('moment');
var clc      = require('cli-color');
var HAPITime = require('../is.js').HAPITime;

// Read test file (see header for format)
var tests = fs.readFileSync('./HAPITime-tests.txt').toString();
var tests = tests.split(/\n/);

// Get regular expressions from schema
var schema = fs.readFileSync('../schemas/HAPI-data-access-schema-2.0.json');
schema = JSON.parse(schema);
var tmp = schema.HAPIDateTime.anyOf;
var schemaregexes = [];
for (var i = 0;i < tmp.length;i++) {
	schemaregexes[i] = tmp[i].pattern;
}

console.log("--")
for (var i = 0;i < tests.length; i++) {

	var tmp = tests[i].split(",");
	var isostr = tmp[0]; 		// String to test
	var expect = tmp[1]; 		// Expected result is second column of file
	expect = expect === "1" ? true: false; // Convert to boolean
	var reason = tmp[2] || "";  // Explanation for passing/failing

	if (!/^\d/.test(isostr)) {continue;} // Ignore lines that dont start with digit

	if (reason) {reason = " ("+reason+")"}
	test_hapi   = HAPITime(isostr,schemaregexes);
	test_moment = moment(isostr.replace(/Z$/,""),moment.ISO_8601).isValid();

	//console.log(test_hapi)
	var errmsg  = (test_hapi.error == expect) ? "??? Error: HAPITime code got wrong answer.": "";
	var warnmsg = (!test_hapi.error != test_moment) ? "Warning: HAPITime result differs from moment.js.": "";
	console.log(isostr + ": " + (!test_hapi.error ? "Pass": "Fail")
				+ ". Expected:  " + (expect ? "Pass": "Fail")
				+ ". moment.js: " + (test_moment ? "Pass": "Fail")
				+ reason + " " + clc.red(warnmsg) + clc.red(errmsg));


}
console.log("--")