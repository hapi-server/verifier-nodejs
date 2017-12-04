function HAPITime(isostr,schemaregexes,leaps) {

	// Tests if a string is a valid HAPI time representation, which is a subset of ISO 8601.
	// Two tests are made: (1) A set of regular expressions in the JSON schema (see ./schemas)
	// and (2) A set of semantic tests.

	// The semantic tests are that:
	// (1) DOY can be no more than 365 on non-leap years, 366 on leap years,
	// (2) DOM must be valid

	function isleap(year) {return ((year % 4 == 0) && (year % 100 != 0)) || (year % 400 == 0)}

	var regex_pass = false;
	for (var i = 0;i < schemaregexes.length;i++) {
		re = new RegExp(schemaregexes[i]);
		regex_pass = re.test(isostr);
		if (regex_pass) {
			//console.log('Passing pattern:' + schemaregexes[i])
			break;
		}
	}

	var semantic_pass = true;
	if (regex_pass) { // Only check semantic rules if regular expression test passed.

		var year = parseInt(isostr.slice(0,4));

		var isostr_split = isostr.split(/-|T/);

		if (isostr_split.length > 1) {
			if (isostr_split[1].length == 3) {
				var doy = parseInt(isostr_split[1]);
			} else {
				var mo = parseInt(isostr_split[1]);
				isostr_split = isostr.split(/-/);
				if (isostr_split.length > 2) {
					var day = parseInt(isostr_split[2]);
				}
			}
		}

		// DOY can be no more than 365 on non-leap years, 366 on leap years
		if (doy == 366 && isleap(year) == false) {
			semantic_pass = false;
		}
		if (doy > 366) {
			semantic_pass = false;
		}

		// DOM must be correct
		if (day) {
			if ([4,6,9,11].includes(mo) && day > 30) {
				semantic_pass = false;
			}
			if (mo == 2 && isleap(year) && day > 29) {
				semantic_pass = false;
			}
			if (mo == 2 && !isleap(year) && day > 28) {
				semantic_pass = false;
			}
		}

		// These tests are now in the schema regular expressions.
		// TODO: Remove if regular expressions are not removed.	
		if (false) {
			if (/T/.test(isostr)) {
				var hr_mn_sec_subsec = isostr.replace("Z","").split("T")[1].split(/:|\./);
				
				// Set missing time elements to 0
				for (var i = 0;i<4;i++) {
					hr_mn_sec_subsec[i] = hr_mn_sec_subsec[i] || "0";
					hr_mn_sec_subsec[i] = parseInt(hr_mn_sec_subsec[i]);
				}

				// 24 is allowed for HOURS, but only if MINUTES=00, SECONDS=00, SUBSECONDS=0
				if (hr_mn_sec_subsec[0] == 24) {
					if (hr_mn_sec_subsec[1] != 0 || hr_mn_sec_subsec[2] != 0 || hr_mn_sec_subsec[3] != 0) {
						semantic_pass = false;
					}
				}

				// SECONDS can be 60 on days at end of leap second days
				// TODO: Does not handle case where two leap seconds added (has never happened)
				// https://www.ietf.org/timezones/data/leap-seconds.list
				// Not used. Leap seconds have been placed in JSON schema.
				if (hr_mn_sec_subsec[2] == 60) {
					isostr = isostr.replace(/\..*Z$/,"Z"); // Remove fractional seconds
					if (doy) {
						// Compute ymd if date was in yyyy-doy format
						var tmp = new Date(year, 0, doy, hr_mn_sec_subsec[0]-(new Date).getTimezoneOffset()/60,0,0).toISOString();
						ymd = tmp.substring(0,10);
						isostr = ymd + "T" + isostr.split("T")[1];
					}
					if (!leaps.includes(isostr)) {
						semantic_pass = false;
					}
				}
			}
		}


	}
	return regex_pass && semantic_pass;
}
exports.HAPITime = HAPITime;