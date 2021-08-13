var fs        = require('fs');
var moment    = require('moment');
var Validator = require('jsonschema').Validator;
var diff      = require('deep-diff').diff;

// Note that for reporting to have correct line numbers, must start functions with
// function FNAME( and start description with 'is.FNAME()'.

// TODO: Get this list by reading directory.
var schemas = {};
schemas["1.1"] = require("./schemas/HAPI-data-access-schema-1.1.json");
schemas["2.0"] = require("./schemas/HAPI-data-access-schema-2.0-1.json");
schemas["2.1"] = require("./schemas/HAPI-data-access-schema-2.1.json");
schemas["3.0"] = require("./schemas/HAPI-data-access-schema-3.0.json");
schemas["3.1"] = require("./schemas/HAPI-data-access-schema-3.1.json");

function prod(arr) {
	// TODO: Also in tests.js. Move to lib.js (and create lib.js)
	// Compute product of array elements.
	return arr.reduce(function(a,b){return a*b;})
}

function versions() {
	arr = [];
	for (key in schemas) {
		arr.push(key);
	}
	return arr.sort();
}
exports.versions = versions;

function HAPIVersion(version) {
	var	got = version;
	var t = false;
	if (versions().includes(version)) {
		t = true;
	} else {
		got = "'" + version + "', which is not valid or not implemented by verifier. Will use " + versions().pop();
	}
	return {"description": "is.HAPIVersion(): Expect HAPI version in JSON response to be one of " + JSON.stringify(versions()), "error": t != true, "got": got};	
}
exports.HAPIVersion = HAPIVersion;

function schema(version) {
	var json = schemas[version];
	if (!json) {
		return false;
	} else {
		return schemas[version];
	}
}
exports.schema = schema;

function timeregexes(version) {
	json = schemas[version];
	if (!json) {
		return false;
	}
	var tmp = json.HAPIDateTime.anyOf;
	var regexes = [];
	for (var i = 0;i < tmp.length;i++) {
		regexes[i] = tmp[i].pattern;
	}
	return regexes;
}
exports.timeregexes = timeregexes;

function trailingZfix(str) {
	// moment.js does not consider date only with trailing Z to be valid ISO8601
	if (/^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]Z$|^[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9]Z$/.test(str)) {
		str = str.slice(0, -1) + "T00Z";
	} 
	return str;
}
exports.trailingZfix = trailingZfix;

function isinteger(str) {
	return parseInt(str) < 2^31 - 1 && parseInt(str) > -2^31 && parseInt(str) == parseFloat(str) && /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]{1,3})?$/.test(str.trim());
}
function isfloat(str) {
	return Math.abs(parseFloat(str)) < Number.MAX_VALUE && /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]{1,3})?$/.test(str.trim())
}

function RequestError(err,res,timeoutType,timeoutObj) {

	var tout = timeoutObj[timeoutType]["timeout"];
	var when = timeoutObj[timeoutType]["when"];

	if (!err) {
		// Remove nonsense extra precision on timings.
		var timings = res.timings;
		for (var key in timings) {
			timings[key] = timings[key].toFixed(1);
		}
		var timingPhases = res.timingPhases;
		for (var key in timingPhases) {
			timingPhases[key] = timingPhases[key].toFixed(1);
		}

		var timeInfo = "";
		if (timingPhases && timings) {
			timeInfo = JSON.stringify(timings) + ", " + JSON.stringify(timingPhases);
			timeInfo = " <a href='https://github.com/request/request#requestoptions-callback'>Timing info [ms]</a>: " + timeInfo;
		}
		return {"description":"is.RequestError(): Expect no request error for timeout of " + tout + " ms used when " + when,"error": false,"got": "No error." + timeInfo};
	}

	if (err.code === "ETIMEDOUT") {
		// https://github.com/request/request/blob/master/request.js#L846
		return {"description":"is.RequestError(): Expect HTTP headers and start of response body in less than " + tout + " ms when " + when,"error": true,"got": "ETIMEDOUT"};
	} else if (err.code === "ESOCKETTIMEDOUT") {
		//https://github.com/request/request/blob/master/request.js#L811
		 return {"description":"is.RequestError(): Expect time interval between bytes sent to be less than " + tout + " ms when " + when,"error": true,"got": "ESOCKETTIMEDOUT"};
	} else if (err.code === "ECONNRESET") {
		return {"description":"is.RequestError(): Expect connection to not be reset by server","error": true,"got": "ECONNRESET"};
	} else if (err.code === "ECONNREFUSED") {
		return {"description":"is.RequestError(): Expect connection to not be refused by server","error": true,"got": "ECONNREFUSED"};
	} else {
		return {"description":"is.RequestError(): Probably URL is malformed.","error":true,"got":err};
	}
}
exports.RequestError = RequestError;

function CadenceValid(cadence) {
	var md = moment.duration(cadence);
	var t = md._isValid;
	// moment.duration("PT720") gives md._isValid = true and
	// md._milliseconds = 0. (Need H, M, S at end)
	if (md._milliseconds == 0) {
		t = false;
	}
	return {"description": "is.CadenceValid(): Expect cadence to be a valid ISO8601 duration", "error": t == false, "got": cadence};
}
exports.CadenceValid = CadenceValid;

function CadenceOK(cadence,start,stop,what) {
	if (!cadence) return; // Don't do test; no cadence given.
	if (!stop) return {"description":"is.CadenceOK(): Need more than two lines to do cadence comparison with consecutive samples.","error":true,"got":"One line."}
	//console.log(start)
	//console.log(stop)
	start = trailingZfix(start);
	stop = trailingZfix(stop);
	var startms = moment(start).valueOf();
	var stopms = moment(stop).valueOf();
	var md = moment.duration(cadence);
	var R = (stopms-startms)/md._milliseconds;
	if (what === "start/stop") {
		t = R > 1;
		var got = "(stopDate-startDate)/cadence = " + (stopms-startms)/md._milliseconds;
		return {"description":"is.CadenceOK(): Expect (stopDate-startDate)/cadence > 1","error":t != true,"got":got}
	}
	if (what === "sampleStart/sampleStop") {
		t = R > 10;
		var got = "(sampleStartDate-sampleStopDate)/cadence = " + (stopms-startms)/md._milliseconds;
		return {"description":"is.CadenceOK(): Expect (sampleStopDate-sampleStartDate)/cadence > 10","error":t != true,"got":got}
	}
	if (what === "consecsamples") {
		t = R > 10;
		var got = "Cadence/(time[i+1]-time[i]) = " + (stopms-startms)/md._milliseconds;
		return {"description":"is.CadenceOK(): Expect (t[i+1]-t[i])/cadence > 10","error":t != true,"got":got}
	}

}
exports.CadenceOK = CadenceOK;

function CIdentifier(arr,type) {
	var re_str = "[_a-zA-Z][_a-zA-Z0-9]{1,30}";

	var arr_fail = [];
	for (var i = 0; i < arr.length;i++) {
		var re = new RegExp(re_str);
		var t = re.test(arr[i]);
		if (!t) {
			arr_fail.push(arr[i]);
		}
	}
	var got = "All " + type + "(s) match.";
	if (arr_fail.length > 0) {
		console.log(arr_fail);
		got = "Non-matching " + type + "(s):" + JSON.stringify(arr_fail);
	}
	return {"description": "is.CIdentifier(): Expect " + type + " to match c identifier regex '" + re_str + "'.", "error": arr_fail.length > 0, "got": got};

}
exports.CIdentifier = CIdentifier;

function ErrorCorrect(code,wanted,what) {

	if (what === "httpcode") {
		return {"description": "is.ErrorCorrect(): Expect HTTP code in JSON to be " + wanted, "error": code != wanted, "got": code};
	}
	if (what === "hapicode") {
		t = code == wanted
		var got = code;
		if (t != true) {got = code + "."}
		return {"description": "is.ErrorCorrect(): Expect HAPI code in JSON to be " + wanted, "error": t != true, "got": got};
	}

}
exports.ErrorCorrect = ErrorCorrect;

function StatusInformative(message,wanted,what) {

	var re = new RegExp(wanted);
	var t = re.test(message);
	var got = message;
	if (t !== true) {got = message + "."}

	if (what === "hapistatus") {
		var l = "<a href='https://github.com/hapi-server/verifier-nodejs/wiki#status-informative'>(Explanation.)</a>";
		return {"description": "is.StatusInformative(): Want HAPI status message in JSON response to contain the string '" + wanted + "' (default HAPI error message). " + l, "error": t !== true, "got": "'" + message + "'"};
	}
	if (what === "httpstatus") {
		var l = "<a href='https://github.com/hapi-server/verifier-nodejs/wiki#status-informative'>(Explanation.)</a>";
		return {"description": "is.StatusInformative(): Want HTTP status message to contain the string '" + wanted + "' (default HAPI error message). " + l, "error": t !== true, "got": "'" + message + "'"};
	}
}
exports.StatusInformative = StatusInformative;

function FileDataOK(header,body,bodyAll,pn,what) {

	function prod(arr) {
		// Compute product of array elements.
		return arr.reduce(function(a,b){return a*b;})
	}

	if (pn !== null) {
		// One parameter
		var nf = 1; // Number of fields (columns) counter (start at 1 since time checked already)
		if (!header.parameters[pn]["size"]) {
			nf = nf + 1; // Width of field (number of columns of field)
		} else {
			nf = nf + prod(header.parameters[pn]["size"]);
		}
	} else {
		// All parameters
		var nf = 0; // Number of fields (columns) counter
		for (var i = 0;i < header.parameters.length;i++) {
			if (!header.parameters[i]["size"]) {
				nf = nf + 1; // Width of field (number of columns of field)
			} else {
				nf = nf + prod(header.parameters[i]["size"]);
			}		
		}
	}

	var lines = body.split("\n");

	if (what === "Ncolumns") {
		var t = false;
		if (lines.length == 0) {
			var got = "(0)" + " - (" + nf + ")";
		} else {
			var got = "(" + nf + ")" + " - (" + nf + ")";
		}
		for (var i = 0;i<lines.length-1;i++) {
			var line = lines[i].split(",");
			t = nf != line.length;
			if (t) {
				got = "(" + line.length + ")" + " - (" + nf + ")";
				got = got + " on line " + (i+1);
				break;
			}
		}
		return {"description":'is.FileDataOK(): Expect (# of columns in CSV) - (# computed from length and size metadata) = 0.',"error":t,"got":got};
	}

	var linesAll = bodyAll.split("\n");

	if (what === "contentsame") {
		var e = false;
		var got = "Match";
		var desc = "is.FileDataOK(): Expect data response to be same as previous request given differing request URLs.";

		if (bodyAll !== body) { // byte equivalent

			if (lines.length != linesAll.length) { // # lines not same.
				e = true;
				got = lines.length + " rows here vs. " + linesAll.length + " rows previously.";
				return {"description":desc, "error": e, "got": got};		
			}

			// Look for location of difference.
			var line = "";
			var lineAll = "";
			var e1 = false;
			var e2 = false;
			for (var i=0;i<lines.length-1;i++) {

				line = lines[i].split(",");
				lineAll = linesAll[i].split(",");

				if (line.length != lineAll.length) {
					e1 = true;
					break;
				}

				for (var j=0;j<line.length-1;j++) {
					if (line[j].trim() !== lineAll[j].trim()) {
						e2 = true;
						break;
					}
				}
				if (e2) {break;}
			}
			if (e1) {
				got = line.length + " columns vs. " + lineAll.length + " columns on line " + (i+1) + ".";
				e = true;
				return {"description":desc, "error": e, "got": got};		
			}
			if (e2) {
				got = "Difference on line " + (i+1) + " column " + (nf+1) + ".";
				e = true;
				return {"description":desc, "error": e, "got": got};		
			}
			// TODO: Can e1 and e2 be false?
		}
		return {"description":desc, "error": e, "got": got};		
	}

	var desc = "is.FileDataOK(): Expect data from one parameter request to match data from all parameter request.";
	var t = false;
	var got = "Match";

	var fc = 0; // First column of parameter.
	for (var i = 0;i < header.parameters.length;i++) {
		if (header.parameters[i]["name"] === header.parameters[pn]["name"]) {
			break;
		}
		if (!header.parameters[i]["size"]) {
			fc = fc + 1;
		} else {
			fc = fc + prod(header.parameters[i]["size"]);
		}
	}

	var desc = "Expect number of rows from one parameter request to match data from all parameter request.";
	var t = lines.length != linesAll.length;
	var got = "Match";
	if (t) {
		got = " # rows in single parameter request = " + lines.length + " # in all parameter request = " + linesAll.length;
		return {"description":"is.FileDataOK(): " + desc,"error":t,"got":got};
	}

	var desc = "is.FileDataOK(): Expect content from one parameter request to match content from all parameter request.";
	t = false;

	var line = "";
	var lineAll = "";
	for (var i=0;i<lines.length-1;i++) {

		line = lines[i].split(",");
		lineAll = linesAll[i].split(",");

		if (line.length != lineAll.length) {
			// This error will be caught by Ncolumns test.
			return;
		}

		// Time
		if (line[0].trim() !== lineAll[0].trim()) {
			t = true;
			got = "Time column for parameter " + name + " does not match at time " + line[0] + ": Single parameter request: " + line[1] + "; All parameter request: " + lineAll[0] + ".";
		}

		var desc = "Expect number of columns from one parameter request to be equal to or less than number of columns in all parameter request.";
		var t = line.length > lineAll.length;
		got = " # columns in single parameter request = " + line.length + " # in all parameter request = " + lineAll.length;
		if (t) {
			return {"description":"is.FileDataOK(): " + desc,"error":t,"got":got};
		}

		var desc = "Expect data from one parameter request to match data from all parameter request.";
		got = "Match";
		t = false;
		// Parameter
		for (var j=0;j<nf-1;j++) {
			if (!line[1+j] || !lineAll[fc+1]) {
				t = false;
				got = "Problem with line " + (j) + ": " + line[1+j];
				break;
			}
			if (line[1+j].trim() !== lineAll[fc+j].trim()) {
				if (header.parameters[pn].name) {
					var name = "'" + header.parameters[pn].name + "'";
				} else {
					var name = "#" + header.parameters[pn].name;
				}
				if (nf == 2) {
					t = true;
					got = got + ". Parameter " + name + " does not match at time " + line[0] + ": Single parameter request: " + line[1] + "; All parameter request: " + lineAll[fc+j] + ".";
				} else {
					got = got + ". Parameter " + name + " field #" + j + " does not match at time " + line[0] + ": Single parameter request: " + line[1+j] + "; All parameter request: " + lineAll[fc+j] + ".";
				}
			}
		}
	}
	return {"description": "is.FileDataOK(): " + desc, "error": t,"got": got};
}
exports.FileDataOK = FileDataOK;

function FileOK(body,what,other,emptyExpected) {
	
	var desc,t,got;

	if (what === "emptyconsistent") {
		if (body === null || other === null) {
			return; // Can't do test due to previous failure.
		}
		if (body.length == 0 || other.length == 0) {
			if (body.length == 0 && other.length != 0) {
				return {"description":'is.FileOK(): If empty response for single parameter, expect empty response for all parameters.',"error": true,"got": "Single parameter body: " + body.length + " bytes. All parameter body: " + other.length + " bytes."};
			} else {
				return {"description":'is.FileOK(): If empty response for single parameter, expect empty response for all parameters.',"error": false,"got": "Both empty."};
			}
		} else {
			return; // Test is not relevant.
		}	
	}

	if (what === "empty") {

		var l = "<a href='https://github.com/hapi-server/verifier-nodejs/wiki#status-informative'>(Explanation.)</a>";
		var l2 = "<a href='https://github.com/hapi-server/verifier-nodejs/wiki#empty-body'>(Explanation.)</a>";

		var emptyIndicated = /HAPI 1201/.test(other);
		if (!body || body.length === 0) {
			if (emptyExpected && !emptyIndicated) {
				return {"description":"is.FileOK(): If data part of response has zero length, want 'HAPI 1201' in HTTP header status message. " + l2,"error": true,"got": "Zero bytes and HTTP header status message of '" + other + "'"};
			}
			if (!emptyExpected) {
				if (emptyIndicated) {
					return {"description":"is.FileOK(): A data part of response with zero bytes was not expected. " + l2,"error": false,"got": "Zero bytes (but 'HAPI 1201' is in HTTP header status message)."};
				} else {
					return {"description":"is.FileOK(): A data part of response with zero bytes was not expected. " + l2,"error": true,"got": "Zero bytes and no 'HAPI 1201' in HTTP header status message."};
				}
			}
		}
		if (body && body.length != 0 && emptyIndicated) {
			return {"description":"is.FileOK(): A data part of response with zero bytes was expected because 'HAPI 1201 in HTTP header status messsage." + l2,"error": false,"got": "'HAPI 1201' in HTTP header status message and " + body.length + " bytes."};
		}
		return {"description":'is.FileOK(): Expect nonzero-length data part of response.',"error": false,"got": body.length + " bytes."};		
	}

	if (what === "firstchar") {
		desc = "Expect first character of CSV response to be an integer.";
		t    = !/^[0-9]/.test(body.substring(0,1));
		got  = body.substring(0,1);
	}

	if (what === "lastchar") {
		desc = "Expect last character of CSV response be a newline.";
		t = !/\n$/.test(body.slice(-1));
		got = body.slice(-1).replace(/\n/g,"\\n");
		if (t) {
			got = "The character '" + got + "'";
		} else {
			got = "A newline.";
		}
	}

	if (what === "extranewline") {	
		desc = "Expect last two characters of CSV response to not be newlines.";
		t    = /\n\n$/.test(body.slice(-2));
		got  = body.slice(-2).replace(/\n/g,"\\n");
		if (t) {
			got = "Two newlines.";
		} else {
			got = "The characters '" + got + "'";
		}
	}

	if (what === "numlines") {
		var lines = body.split("\n");
		got = lines.length + " newlines";
		if (lines.length == 0) {
			got = "No lines.";
		} else {
			got = lines.length + " newlines";
		}
		desc = "Expect at least one newline in CSV response.";
		t = lines.length == 0
	}

	return {"description": "is.FileOK(): " + desc, "error": t,"got": got};

}
exports.FileOK = FileOK;

function LengthAppropriate(len,type,name) {
	var got = "Type = " + type + " and length = " + len + " for parameter " + name;
	if (/isotime|string/.test(type) && !len) {
		obj = {"description": "If type = string or isotime, length must be given", "error":true, "got": got};
	} else if (!/isotime|string/.test(type) && len) {
		obj = {"description": "If type = string or isotime, length must not be given", "error":true, "got": got};
	} else {
		obj = {"description": "Length may only be given for types string and isotime", "error":false, "got": got};
	}
	obj["description"] = "is.LengthAppropriate(): " + obj["description"];
	return obj;
}
exports.LengthAppropriate = LengthAppropriate;

function HeaderSame(headerInfo, headerBody) {
	// Compare header from info response with header in data response

	var differences = diff(headerInfo, headerBody);	
	var keptDiffs = [];

	//console.log(headerInfo);
	//console.log(headerBody);
	//console.log(differences);
	if (differences) {
		for (var i = 0; i < differences.length; i++) {
			if (differences[i].path[0] !== 'format' && differences[i].path[0] !== 'creationDate') {
				//console.log('path: ' + differences[i].path);
				var keep = true;
				for (j = 0; j < differences[i].path.length; j++) {
					//console.log("path[" + j + "] = " + differences[i].path[j]);
					if (typeof(differences[i].path[j]) === 'string' && differences[i].path[j].substring(0,2) === 'x_') {
						keep = false;
						break;
					}
				}
				if (keep) {
					keptDiffs.push(differences[i]);
				}
			}
		}
	}
	var desc = "is.HeaderSame(): Expect header in info response to match header in data response when 'include=header' requested.";
	if (keptDiffs.length == 0) {
		return {"description": desc, "error": false, "got": "Matching headers."};
	} else {
		var got = "Differences:\n" + JSON.stringify(keptDiffs);
		return {"description": desc, "error": true, "got": got};
	}
}
exports.HeaderSame = HeaderSame;

function FormatInHeader(header,type) {
	// https://github.com/hapi-server/data-specification/blob/master/hapi-2.1.1/HAPI-data-access-spec-2.1.1.md#info
	if (type == "nodata") {
		var t = 'format' in header;
		var got = 'No format given.'
		if (t) {
			got = "Format of '" + header.format + "' specified."
		}
		return {"description": "is.FormatInHeader(): Info response should not have 'format' specified.", "error": t, "got": got};		
	}
	if (type == "data") {
		var t = !('format' in header);
		var got = 'No format given.'
		if (!t) {
			got = "Format of '" + header.format + "' specified."
		}
		return {"description": "is.FormatInHeader(): Header in csv response should have 'format: csv' specified.", "error": t, "got": got};		
	}
}
exports.FormatInHeader = FormatInHeader;

function FirstParameterOK(header,what) {
	if (what == "name") {
		return {"description": "is.FirstParameterOK(): First parameter should (not must) be named 'Time' b/c clients will likely label first parameter as 'Time' on plot to protect against first parameter names that are not sensible.", "error": header.parameters[0].name !== "Time", "got": header.parameters[0].name};
	}
	if (what == "fill") {
		var t = false;
		var got = 'null';
		if (!('fill' in header.parameters[0])) {
			got = 'No fill entry.'
		}
		if (header.parameters[0].fill != null) {
			t = true;
			got = header.parameters[0].fill;
		}
		return {"description": "is.FirstParameterOK(): First parameter must have a fill of null or it should not be specified.", "error": t, "got": got};
	}
}
exports.FirstParameterOK = FirstParameterOK;

function prod(arr) {
	// Compute product of array elements.
	return arr.reduce(function(a,b){return a*b;})
}

function BinsOK(name,bins,size) {
	if (!bins) {
		return;
	}

	var desc = "Expect bin units, label, centers, and ranges to have correct number of elements.";
	var err = false;
	var got = "";

	// Recursive check
	if (false && Array.isArray(bins[0])) {
		size.shift();
		BinsOK(name,bins[0],size);
		return {}; 
	}
	var err = false;
	var k = 1;
	if (size.length == 1) {
		k = 0;
	}
	if (size.length == 1 && bins.length != 1) {
		err = true;
		got = "Parameter " + name + ": bins.length = " + bins.length + " but should equal 1. ";
	}
	if (size.length > 1 && bins.length != size[0]) {
		err = true;
		got = "Parameter " + name + ": bins.length (= " + bins.length + ") != size[0] (= " + size[0] + "). ";
	}
	if (size.length <= 2) {
		for (i=0; i < bins.length; i++) {
			if (bins[i].units && Array.isArray(bins[i].units) && bins[i].units.length > 1 && bins[i].units.length != size[k]) {
				err = true;	
				got = got + "Parameter " + name + ": wrong number of elements in units. Got " + bins[i].units.length + ". Expected 1 or " + size[k] + ". ";
			}
			if (bins[i].label && Array.isArray(bins[i].label) && bins[i].label.length > 1 && bins[i].label.length != size[k]) {
				err = true;
				got = got + "Parameter " + name + ": wrong number of elements in labels. Got " + bins[i].label.length + ". Expected 1 or " + size[k] + ". ";
			}
			if (bins[i].centers && bins[i].centers.length != size[k]) {
				err = true;
				got = got + "Parameter " + name + ": wrong number of elements in centers. Got " + bins[i].centers.length + ". Expected " + size[k] + ". ";
			}
			if (bins[i].ranges && bins[i].ranges.length != size[k]) {
				err = true;
				got = got + "Parameter " + name + ": wrong number of elements in ranges. Got " + bins[i].ranges.length + ". Expected " + size[k] + ". ";
			}
		}
	}

	if (got === "") {got = "Parameter " + name + " has correct number of elements."}

	if (units.length > 1 && size.length > 2) {
		got = "<span style='background-color:yellow'>size.length &gt; 2 for parameter " + name + ". Check not implemented.</span>"		
	}

	return {"description": "is.BinsOK: " + desc, "error": err, "got": got};		
}
exports.BinsOK = BinsOK;

function ArrayOK(name,units,size,type,version) {

	if (version !== "2.1") {
		return;
	}
	// "units": [["nT"],["nT","degrees","nT"]],

	// size = [N]
	// units = "u" 
	// units = ["u"]
	// units = ['u1','u2',...,'uN']

	// size = [N,M]
	// units = "u"
	// units = ["u"]
	// units = ['uN','uM']
	// units = [['u1',...,'u1M'],['u2',...,'uM'],...,['uN',...,'uNM']]
	if (Array.isArray(units)) {
		var desc = "Expect " + type + " to be a string or an array with appropriate structure. ";
		var err = false;
		var got = "";
		if (units.length > 1 && size.length == 1 && units.length != size[0]) {
			// size = [N], units = ['u1','u2',...,'uN'] case
			err = true;
			got = got + "if size.length == 1, " + type + " should have 1 element or size[0] elements. ";
		}
		if (units.length > 1 && size.length == 2) {
			for (var j = 0; j < units.length; j++) {
				if (Array.isArray(units[j])) {
					if (units[j].length != 1 && units[j].length != size[1]) {
						err = true;
						got = got + type + "[" + j + "] contains array; it should have 1 element or size[" + (1) + "] elements. ";
					}
				}
			}

		}
		if (got === "") {
			got = "parameter '" + name + "' " + type + " has appropriate structure.";
		} else {
			got = "parameter '" + name + "', size = " + JSON.stringify(size) + ", " + type + " = " + JSON.stringify(units) + ". " + got;			
		}
		if (units.length > 1 && size.length > 2) {
			got = "<span style='background-color:yellow'>size.length &gt; 2 for parameter " + name + ". Check not implemented.</span>"		
		}
		return {"description": "is.ArrayOK: " + desc, "error": err, "got": got};		
	}
}
exports.ArrayOK = ArrayOK;

// TODO: Use this
function checkdims(units,size,version) {
	var err = false;
	if (units && units !== null && typeof(units) !== "string") {
		// units is an array.
		// size passed assumed to always be an array
		var err = false;
		if (size.length == 1 && units.length == size[0]) {
			// e.g., size = [2] and units = ["m", "km"] is OK
			// So is size = [1] and units = ["m"] (but this should really be size = 1 and units = "m")
		} else {
			if (units.length !== size.length) {
				// Check that number of elements in units matches number in size.
				err = true;
			} else if (typeof(units[0]) !== 'object') {
				// If here, then size.length > 1. This checks for, e.g.,
				// units = ["m", "km"] and size = [1,2], which is wrong
				err = true;
			} else {
				// Check that ith subarray of units has length equal to ith value in size.
				for (var i = 0; i < units.length; i++) {
					if (units[i].length !== size[i]) {
						err = true;
						break;
					}				
				}
			}
		}
		return err;
	}
}

function UnitsOK(name,units,type,size) {
	if (type === 'isotime') {
		var err = false;
		if (typeof(units) === 'object') {
			for (var i = 0; i < units.length; i++) {
				for (var j = 0; j < units[i].length; j++) {
					if (units[i][j] !== "UTC") {
						err = true;
						break;
					}
				}
			}
		} else {
			var got = "type = '" + type + "' and units = '" + units + "' for parameter " + name + ".";
			if (units !== "UTC") {
				err = true;
			}			
		}
		return {"description": "is.UnitsOK: Expect isotime units to be 'UTC'.", "error": err,"got": got};
	}
}
exports.UnitsOK = UnitsOK;

function FillOK(fill,type,len,name,what) {

	if (!fill) {return;} // No fill or fill=null so no test needed.
	var t = false;
	if (typeof(fill) === 'string') {
		var got = "fill = '" + fill + "' for parameter " + name + ".";
	} else {
		var got = "fill = " + fill + " for parameter " + name + ".";
	}
	var desc = "";
	if (what === "nullstring") {
		desc = "is.FillOK(): Expect fill value to not be the string 'null'.";
		if (fill === "null") {
			t = true;
			got  = " The string 'null'; Probably fill=null and not fill='null' was intended.";
		}
	}
	if (what === "isotime") {
		desc = "is.FillOK(): Expect length of fill value for a isotime parameter to be equal to length of the string parameter";
		if (len === fill.length && name !== "Time") {
			t = true;
			got  = got;
		}
	}
	if (what === "string") {
		desc = "is.FillOK(): Expect length of fill value for a string parameter to be <= length of the string parameter";
		if (len > fill.length) {
			t = true;
			got  = got + " string length = " + len + "; fill length = " + fill.length;
		}
	}
	if (what === "stringparse") {
		desc = "is.FillOK(): Expect fill value for a string parameter to not parse to an integer or float";
		if (isinteger(fill) || isfloat(fill)) {
			t = true;
			got  = got + " This was probably not intended.";
		}
	}
	if (what === "integer") {
		desc = "is.FillOK(): Expect fill value for a integer parameter to not have a decimal point";
		if (/\./.test(fill)) {
			t = true;
			got  = got + " This was probably not intended.";
		}
	}
	if (what === "double") {
		desc = "is.FillOK(): Expect fill value for a double parameter to not have a two or more non-zero decimal places.";
		if (/\.[1-9][1-9]/.test(fill)) {
			t = true;
			got  = got + " This is uncommon and was probably not intended.";
		}
	}
	return {"description": desc, "error": t,"got": got};
}
exports.FillOK = FillOK;

function SizeCorrect(nc,nf,header) {
	var t = nc == nf
	if (header.size) {
		var extra = "product of elements in size array " + JSON.stringify(header.size);
		var got = nc + " commas and " + extra + " = " + nf;
	} else {
		if (nf == 0) {
			var extra = "0 because only Time requested.";
		} else {
			var extra = "1 because no size given.";
		}
		var got = nc + " commas";
	}
	return {"description": "is.SizeCorrect(): Expect number of commas on first line to be " + extra, "error": t !=true,"got": got};
}
exports.SizeCorrect = SizeCorrect;

function SizeAppropriate(size,name,what) {
	if (!size) return; // Test not appropriate.
	if (typeof(size) !== 'object') return; // Test not appropriate.

	if (what === "needed") {
		// Test if all elements of size are 1.
		t = 0;
		for (var i=0;i<size.length;i++) {
			t = t + size[i];
		}
		t = t == size.length;
		return {"description": "is.SizeAppropriate(): Size is not needed if all elements are 1.", "error": t, "got": "size = " + JSON.stringify(size) + " for parameter " + name};
	}
	if (what === "2D+") {
		// Test size array has 2 or more elements.
		t = false;
		if (size) {
			t = (size.length > 1)
		}
		return {"description": "is.SizeAppropriate(): Size arrays with more than one element are experimental.", "error": t, "got": "size = " + JSON.stringify(size) + " for parameter " + name};
	}
}
exports.SizeAppropriate = SizeAppropriate;

function HTTP200(res){
	var body = "";
	if (res.statusCode != 200) {
		try {
			var json = JSON.parse(res.body);
			var body = " and JSON body\n\t" + JSON.stringify(body,null,4).replace(/\n/g,"\n\t");
		} catch (error) {
		}

		if (!body) {
			var body = " and non JSON.parse()-able body:\n" + res.body.replace(/\n/g,"\n\t");
		} else {
			var body = "";
		}
	}
	return {"description": "is.HTTP200(): Expect HTTP status code to be 200", "error": 200 != res.statusCode, "got": "HTTP status " + res.statusCode + body};
}
exports.HTTP200 = HTTP200;

function CorrectLength(str,len,name,required) {
	var extra = extra || ""
	var required = required || false
	var got = "(" + (str.length) + ") - (" + (len) + ")"
	var t = str.length != len;
	if (t && !required) {
		got = got + extra + " Not an error for format=csv, but will cause error for format=binary."
	}
	return {"description": 'is.CorrectLength(): Expect (trimmed length of ' + name + ' string parameter in CSV) - (parameters.'+ name + '.length) = 0.', "error": t, "got": got}
}
exports.CorrectLength = CorrectLength;

function TimeInBounds(lines,start,stop) {
	// Remove Z from all times so Date().getTime() gives local timezone time for all.
	// Javascript Date assumes all date/times are in local timezone.

	var start = start.trim().replace(/Z$/,"");
	var stop = stop.trim().replace(/Z$/,"");

	var firstTime = lines[0].split(",").shift().trim().replace(/Z$/,"");
	var lastTime = firstTime;
	// Find the last line with content.
	for (var i = 0;i<lines.length-1;i++) {
		if (lines[lines.length-i-1] !== '') {
			lastTime = lines[lines.length-i-1].split(",").shift().trim().replace(/Z$/,"");
			break;
		}
	}
	var got = "First time = " + firstTime + "; LastTime = " + lastTime;
	var t = moment(firstTime).valueOf() >=  moment(start).valueOf() && moment(lastTime).valueOf() <  moment(stop).valueOf();
	return {"description": "is.TimeInBounds(): Expect first time in CSV >= " + start + " and last time in CSV < " + stop + " (only checks to ms)","error": t != true,"got":got};
}
exports.TimeInBounds = TimeInBounds;

function TimeIncreasing(header,what) {
	if (what === "CSV") {
		var got = "Monotonically increasing time in CSV"
		var starttest = new Date().getTime();
		var ts = got;
		// Remove blanks (caused by extra newlines)
		header = header.filter(function(n){ return n != '' });
		// Don't run test if only one record.
		if (header.length == 1) {return;} 
		
		for (i = 0;i < header.length-1;i++) {
			var line = header[i].split(",");
			var linenext = header[i+1].split(",");
			//var t = new Date(linenext[0].trim()).getTime() > new Date(line[0].trim()).getTime();
			if (!line || !linenext) {
				t = false;
				got = "Problem with line " + (i) + " or " + (i+1);
				break;
			}
			try {
				var t = moment( trailingZfix(linenext[0].trim()) ).valueOf() > moment( trailingZfix(line[0].trim()) ).valueOf();
			} catch (e) {
				t = false;
				got = "Was not able to parse either " + linenext[0].trim() + " or " + line[0].trim();
				break;
			}
			//console.log(linenext[0].trim())
			//console.log(moment.valueOf(linenext[0].trim()))
			if (!t) {
				var ts = "Time(line="+(i+1)+") > Time(line="+i+")";
				var got = "line " + (i+1) + " = "+ linenext[0] + "; line " + (i) + " = " + line[0];
				break;			
			}
			if (new Date().getTime() - starttest > 10) {
				// Stop testing after 10 ms.
				got = got + " in first " + (i+1) + " lines.";
				break;
			}
		}
	}
	if (what === "{start,stop}Date") {
		var start = trailingZfix(header.startDate);
		var stop  = trailingZfix(header.stopDate);
		var ts = "info.startDate < info.stopDate";
		//var t = new Date(start).getTime() < new Date(stop).getTime();
		var t = moment(start).valueOf() < moment(stop).valueOf();
		var got = "startDate = " + start + "; stopDate = " + stop;
	}
	if (what === "sample{Start,Stop}Date") {
		var start = trailingZfix(header.sampleStartDate);
		var stop  = trailingZfix(header.sampleStopDate);
		if (!start && !stop) return false;
		if (start && stop) {
			//var t = new Date(start).getTime() < new Date(stop).getTime();
			var t = moment(start).valueOf() < moment(stop).valueOf();
			var ts = "info.sampleStartDate < info.sampleStopDate";
			var got = "sampleStartDate = " + start + "; sampleStopDate = " + stop;
		} else {
			if (!stop) {
				var ts = "info.sampleStartDate does not have a matching sampleStopDate";
				var t = false;
				var got = "a missing date";
			} else {
				var ts = "info.sampleStopDate does not have a matching sampleStartDate";
				var t = false;
				var got = "a missing date";				
			}
		}
	}
	if (t) {
		got = got.replace(">","<");
	}
	return {"description": "is.TimeIncreasing(): Expect " + ts, "error": t != true, "got":got};
}
exports.TimeIncreasing = TimeIncreasing;

function ISO8601(str,extra) {
	// TODO: Change to HAPIISO8601.
	// https://github.com/hapi-server/data-specification/issues/54
	var extra = extra || ""
	var t  = moment(trailingZfix(str),moment.ISO_8601).isValid();
	var ts = "moment('" + trailingZfix(str) + "',moment.ISO_8601).isValid() == true"+extra;
	return {"description":"is.ISO8601(): Expect " + ts,"error":t != true,"got":"moment(" + trailingZfix(str) + ",moment.ISO_8601).isValid() = " + t};
}
exports.ISO8601 = ISO8601;

function HAPITime(isostr,version) {

	schemaregexes = timeregexes(version);
	// schemaregexes come from list in a schema file in ./schemas.
	var got,str,result;
	var t = true;
	if (typeof(isostr) === 'object') {
		var starttest = new Date().getTime();
		got = "Valid HAPI Time strings";
		for (var i = 0; i < isostr.length; i++) {
			if (isostr[i] === '') {break};
			str = isostr[i].split(",")[0].trim();
			result = HAPITime(str,version);
			if (result.error == true) {
				t = false;
				got = "'" + str + "'" + " is not a valid HAPI Time string.";
				if (!/Z$/.test(str)) {
					got = got + " (Missing trailing Z.)";
				}
				if (!/^[0-9]$/.test(str)) {
					got = got + " (First character is not [0-9].)";
				}
				break;
			}
			if (new Date().getTime() - starttest > 10) {
				// Stop testing after 10 ms.
				got = got + " in first " + (i+1) + " lines.";
				break;
			}
			//console.log(isostr[i] + " " + t)
		}
		var url = "https://github.com/hapi-server/verifier-nodejs/tree/master/schemas/HAPI-data-access-schema-"+version+".json";

		return {"description":"is.HAPITime(): Expect time column to contain valid <a href='"+url+"'>HAPI " + version + " HAPITime strings</a>","error":t != true,"got":got};
	}
	// Tests if a string is a valid HAPI time representation, which is a subset of ISO 8601.
	// Two tests are made: (1) A set of regular expressions in the JSON schema (see ./schemas)
	// and (2) A set of semantic tests.

	// The semantic tests are that:
	// (1) DOY can be no more than 365 on non-leap years, 366 on leap years,
	// (2) DOM must be valid

	function isleap(year) {return ((year % 4 == 0) && (year % 100 != 0)) || (year % 400 == 0)}

	var regex_pass = false;
	var re;
	for (var i = 0;i < schemaregexes.length;i++) {
		re = new RegExp(schemaregexes[i]);
		regex_pass = re.test(isostr);
		if (regex_pass) {
			//console.log(' Passing pattern:' + schemaregexes[i])
			break;
		}
	}

	//console.log(" Regex pass: " + regex_pass);
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
	}
	//console.log(" Semantic pass: " + regex_pass);

	var e = !(regex_pass && semantic_pass);
	//if (t==false) {console.log("x" + isostr)}
	return {"description":"is.HAPITime(): Expect time value to be a valid HAPI time string.", "error": e, "got": got};

}
exports.HAPITime = HAPITime;

function Integer(str,extra) {
	var extra = extra || ""
	var t  = isinteger(str);
	var ts = "(parseInt('"+str+"') < 2^31 - 1 || parseInt('"+str+"') > -2^31) && parseInt(" + str + ") == parseFloat(" + str + ")"+extra;
	return {"description":"is.Integer(): Expect " + ts, "error":t != true, "got":"parseInt(" + str + ") = " + parseInt(str) + " and " + "parseFloat(" + str + ") = " + parseFloat(str)};
}
exports.Integer = Integer;

function Float(str,extra) {
	var extra = extra || ""
	var t  = isfloat(str);
	var ts = "Math.abs(parseFloat('"+str+"')) < " + Number.MAX_VALUE + " && /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]{1,3})?$/.test('"+str+"'.trim()) == true"+extra;
	return {"description":"is.Float(): Expect " + ts, "error":t != true, "got": t};
}
exports.Float = Float;

function NaN(str,extra) {
	var extra = extra || ""
	t = str.trim().toLowerCase();
	ts = "'" + str + "'.trim().toLowerCase() === 'nan'"+extra;
	return {"description":"is.NaN(): Expect " + ts,"error":t !== "nan","got":"'" + str + "'.trim().toLowerCase() = " + t};
}
exports.NaN = NaN;

function Unique(arr,arrstr,idstr){
	if (!arr.length) {
 		return {"description":"is.Unique(): Expect " + arrstr + " to be an array","error":true,"got": typeof(arr)};
	}

	var ids = [];
	var rids = [];
	for (var i = 0;i<arr.length;i++) {
		if (!arr[i][idstr]) continue;
		if (ids.indexOf(arr[i][idstr]) > -1 && rids.indexOf(arr[i][idstr])) {
			rids.push(arr[i][idstr]);
		}
		ids[i] = arr[i][idstr];
	}
	var uids = Array.from(new Set(ids)); // Unique values
	
	var e = !(uids.length == ids.length);
	if (e) {
		var got ="Repeated at least once: " + rids.join(",");
	} else {
		var got ="All unique.";
	}
 	return {"description":"is.Unique(): Expect all '" + idstr + "' values in objects in " + arrstr + " array to be unique","error":e,"got": got};
}
exports.Unique = Unique;

function TooLong(arr,arrstr,idstr,elstr,N){
	// idstr = "id" for datasets and "name" for parameter.
	var ids = [];
	for (var i = 0;i<arr.length;i++) {
		if (!arr[i][elstr]) continue;
		if (arr[i][elstr]) {
			if (arr[i][elstr].length > N) {
				ids.push(arr[i][idstr]);
			}
		}
	}
	var got = "All objects in " + arrstr + " are shorter than " + N + " characters"
	if (ids.length > 0) {
		got = arrstr + " has " + ids.length + " object(s) (" + ids.join(",") + ") with " + elstr + " longer than " + N + " characters"
	}
 	return {"description":"is.TooLong(): Expect " + elstr + "s in objects to be <= 40 characters","error":ids.length != 0,"got": got};
}
exports.TooLong = TooLong;

function CORSAvailable(head) {
	var ahead = "Access-Control-Allow-Origin";
	var astr  = head[ahead.toLowerCase()];
	var a     = /\*/.test(astr);

	var bhead = "Access-Control-Allow-Methods";
	var bstr  = head[bhead.toLowerCase()];
	var b     = /GET/.test(bstr);

	var want = "Access-Control-Allow-{Origin,Methods} = " + "{*, GET}";
	var got  = "Access-Control-Allow-{Origin,Methods} = {" + astr + ", " + bstr + "}";
	var e = !(a && b);
	return {"description":"is.CORSAvailable(): To enable AJAX clients, want CORS HTTP Headers: " + want,"error":e,"got":got};
}
exports.CORSAvailable = CORSAvailable;

function CompressionAvailable(headers){
	var available = false;
	// Note: request module used for http requests only allows gzip to be specified in Accept-Encoding,
	// so error here may be misleading if server can use compress or deflate compression algorithms but not gzip (should be a rare occurence).
	var got = "No gzip in Content-Encoding header. Compression will usually speed up transfer of data."
	var re = /gzip/;
	if (headers["content-encoding"]) {
		var available = re.test(headers["content-encoding"]);
		if (available) {got = headers["content-encoding"]}
	}
	return {"description":"is.CompressionAvailable(): Expect HTTP Accept-Encoding to match " + re + ". (Note, only compression tested for is gzip.)", "error": !available, "got": got};
}
exports.CompressionAvailable = CompressionAvailable;

function ContentType(re,given){
	return {"description":"is.ContentType(): Expect HTTP Content-Type to match " + re,"error":!re.test(given),"got":given || "No Content-Type header."};
}
exports.ContentType = ContentType;

function JSONparsable(text) {
	var ret = {"description":"is.JSONparsable(): Expect JSON.parse(response) to not throw error","error":false,"got":"no error"};
	try {
		JSON.parse(text);
		return ret;
	} catch (error) {
		ret.got = error + " See http://jsonlint.org/ for a more detailed error report";
		ret.error = true;
		return ret;
	}
}
exports.JSONparsable = JSONparsable;

function HAPIJSON(text,version,part){

	s = schema(version);

	if (!s) {
		return {
				"description": "is.HAPIJSON(): Expect HAPI version to be one of " + JSON.stringify(Object.keys(schemas)),
				"error": true,
				"got": "Schema version " + version + " not one of " + JSON.stringify(Object.keys(schemas))
			};
	}

	if (typeof(text) === "object") {
		var json = text;
	} else {
		var json = JSON.parse(text);
	}
	
	var v = new Validator();
	// Look for all top-level elements that have an id starting with a /.
	// These are subschemas that are used.
	for (key in s) {
		if (s[key]["id"] && s[key]["id"][0] === "/") {
			v.addSchema(s[key], s[key]["id"]);
		}
	}
	//v.addSchema(s["HAPIDateTime"], '/HAPIDateTime');
	//v.addSchema(s["HAPIStatus"], '/HAPIStatus');
	//v.addSchema(s["Mutli"], '/Multi');
	//var version = s["HAPI"].pattern.replace("^","").replace("$","");
	var vr = v.validate(json, s[part]);
	//console.log(JSON.stringify(vr,null,4))
	var ve = vr.errors;
	var got = "is valid"
	//console.log(ve)
	if (ve.length != 0) {
		var err = [];
		for (var i = 0;i< ve.length;i++) {
			//err[i] = ve[i].property.replace("instance","object") + " " + ve[i].message.replace(/\"/g,"'");
			err[i] = ve[i].property.replace("instance.","") + " " + ve[i].message.replace(/\"/g,"'");
		}
		got = "\n\t" + JSON.stringify(err,null,4).replace(/\n/g,"\n\t")
	}
	var url = "https://github.com/hapi-server/verifier-nodejs/tree/master/schemas/HAPI-data-access-schema-"+version+".json";
	return {"description":"is.HAPIJSON(): Expect body to be valid <a href='"+url+"'>HAPI " + version + " " + part + " schema</a>","error":ve.length != 0,"got":got};
}
exports.HAPIJSON = HAPIJSON;
