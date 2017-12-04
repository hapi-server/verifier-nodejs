var moment = require('moment');
var fs = require('fs');
var HAPITime = require('./HAPITime.js').HAPITime;

// Read test file
var tests = fs.readFileSync('HAPITime-tests.txt').toString();
var tests = tests.split(/\n/);

var schema = fs.readFileSync('./schemas/HAPI-data-access-schema-2.0.json');
schema = JSON.parse(schema);
var tmp = schema.HAPIDateTime.anyOf;
var schemaregexes = [];
for (var i = 0;i < tmp.length;i++) {
	schemaregexes[i] = tmp[i].pattern;
}

console.log("--")
for (var i = 0;i < tests.length; i++) {

	var tmp = tests[i].split(",");
	var isostr = tmp[0]; // String to test
	var expect = tmp[1]; // Expected result is second column of file
	var reason = tmp[2] || ""; // Explanation for passing/failing

	if (!/^\d/.test(isostr)) {continue;} // Ignore lines that dont start with digit

	if (reason) {reason = " ("+reason+")"}
	expect = expect === "1" ? true: false; // Convert to boolean

	test_hapi = HAPITime(isostr,schemaregexes);

	var errmsg = (test_hapi != expect) ? "??? Error: HAPITime code got wrong answer.": "";
	console.log(isostr + ": " + (test_hapi ? "Pass": "Fail")
				+ " Expected: " + (expect ? "Pass": "Fail")
				+ reason + " " + errmsg);

	if (false) {
		test_moment = moment(isostr,moment.ISO_8601).isValid();
		if (test_moment) {
			console.log("Moment ISO_8601: Pass " + isostr);
		} else {
			console.log("Moment ISO_8601: Fail " + isostr);
		}
	}

}
console.log("--")