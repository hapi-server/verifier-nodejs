var moment = require('moment');
var fs = require('fs');

var tests = fs.readFileSync('hapi8601.txt').toString();
var tests = tests.split(/\n/);
console.log("--")
for (var i = 0;i < tests.length; i++) {

	var tmp = tests[i].split(",");
	var isostr = tmp[0];
	if (isostr === "") {continue;}
	var expect = tmp[1];
	expect = expect === "1" ? true: false;

	test_hapi = HAPITime(isostr);
	test_moment = moment(isostr,moment.ISO_8601).isValid();

	var errmsg = (test_hapi != expect) ? "??? Error: HAPI code got wrong answer.": "";
	console.log(isostr + ": " + (test_hapi ? "Pass": "Fail") + " Expected: " + (expect ? "Pass": "Fail") + " " + errmsg);

	if (false) {
		if (test_moment) {
			console.log("Moment ISO_8601: Pass " + isostr);
		} else {
			console.log("Moment ISO_8601: Fail " + isostr);
		}
	}

}
console.log("--")

function HAPITime(isostr) {
	function isleap(year) {return ((year % 4 == 0) && (year % 100 != 0)) || (year % 400 == 0)}

	// Not implemented:
	// SECONDS can be 0-59, and 60 on leap second days (Jun 30 or Dec 31).

	// MONTH, DOM, DOY should all be optional (this needs to be handled in regexp)
	var re2 = /^\d{4}Z|^\d{4}-\d{2}Z/;
	var test_re2 = re2.test(isostr);

	if (test_re2) { // YYYYZ or YYYY-MMZ only given
		var isostro = isostr;
		// Set missing month and day to 01-01
		isostr = isostr.replace(/(^\d{4})Z/,"$1-01-01TZ");
		// Set missing day to 01
		isostr = isostr.replace(/(^\d{4})-(\d{2})Z/,"$1-$2-01TZ");
		// TZ inserted there instead of Z alone so it passes next regexp.
		// TODO: **** REMOVE WHEN REGEXP FIXED **** 
		//console.log(isostro + " => " + isostr)
	}	

	// TZ inserted so it passes next regexp.
	// TODO: **** REMOVE WHEN REGEXP FIXED ****
	isostr = isostr.replace(/(^\d{4})-(\d{2})-(\d{2})Z$/,"$1-$2-$3TZ");
	isostr = isostr.replace(/(^\d{4})-(\d{3})Z$/,"$1-$2TZ");

	// https://github.com/hapi-server/data-specification/issues/54#issuecomment-338637245
	var re = /((?:((?:16|17|18|19|20|21)\d\d)-(0[1-9]|10|11|12)-([0-3]\d))|(?:((?:16|17|18|19|20|21)\d\d)-([0-3]\d\d)))T(([01]\d|2[0-4])(?:\:([0-5]\d)(?::([0-5]\d|60)(\.\d{1,9})?)?)?)?Z/;
	var test_re = re.test(isostr);

	var test_semantic = true;
	if (test_re) { // Only check if main expression test passed.

		var date = isostr.split("-");
		var year = parseInt(isostr.slice(0,4));
		if (date.length == 2) {
			var doy = parseInt(date[1]);
		}
		if (date.length == 3) {
			var day = parseInt(date[1]);
			var mo  = parseInt(date[2]);
		}

		// DOY can be no more than 365 on non-leap years, 366 on leap years.
		if (doy == 366) {
			if (isleap(year) == false) {
				test_semantic = false;
			}
		}
		if (doy > 366) {
			test_semantic = false;
		}

		// 24 is allowed for HOURS, but only if MINUTES=00, SECONDS=00, SUBSECONDS=0
		if (/T/.test(isostr)) {
			var hr_mn_sec_subsec = isostr.split("T")[1].split(/:|\./);
			if (hr_mn_sec_subsec[0] === "24") {
				if (hr_mn_sec_subsec[1] !== "00" || hr_mn_sec_subsec[2] !== "00" || parseInt(hr_mn_sec_subsec[3]) != 0) {
					test_semantic = false;
				}
			}
		}

	}
	return test_re && test_semantic;
}