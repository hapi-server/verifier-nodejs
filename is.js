var fs        = require('fs');
var moment    = require('moment');
var Validator = require('jsonschema').Validator;

// Note that for reporting to have correct line numbers, must start functions with
// function FNAME( and start description with 'is.FNAME()'.

function trailingZfix(str) {
	// moment.js does not consider date only with trailing Z to be valid ISO8601
	if (/^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]Z$|^[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9]Z$/.test(str)) {
		str = str.slice(0, -1) + "T00Z";
	} 
	return str;
}
function isinteger(str) {
	return parseInt(str) < 2^31 - 1 && parseInt(str) > -2^31 && parseInt(str) == parseFloat(str) && /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]{1,3})?$/.test(str.trim());
}
function isfloat(str) {
	return Math.abs(parseFloat(str)) < Number.MAX_VALUE && /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]{1,3})?$/.test(str.trim())
}

function CadenceValid(cadence) {
	var md = moment.duration(cadence);
	var t = md._isValid;
	// moment.duration("PT720") gives md._isValid = true and
	// md._milliseconds = 0. (Need H, M, S at end)
	if (md._milliseconds == 0) {
		t = false;
	}
	return {"description":"is.CadenceValid(): Expect cadence to be a valid ISO8601 duration","error": t == false,"got": cadence};
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

function ErrorCorrect(code,wanted,what) {

	if (what === "httpcode") {
		return {"description":"Expect HTTP code to be " + wanted,"error": code != wanted,"got": code};
	}
	if (what === "hapicode") {
		t = code == wanted
		var got = code;
		if (t != true) {got = code + ". Consider using https://github.com/hapi-server/verifier-nodejs/blob/master/schema/1.1/errors.json"}
		return {"description":"Expect HAPI code to be " + wanted,"error":t != true,"got": got};
	}

}
exports.ErrorCorrect = ErrorCorrect;

function ErrorInformative(message,wanted,what) {

	if (what === "httpmessage") {
		var re = new RegExp(wanted+"");
		var t = /HAPI/.test(message) && re.test(message);
		var l = "<a href='https://github.com/hapi-server/data-specification/blob/master/hapi-dev/HAPI-data-access-spec-dev.md#user-content-HTTPStatusExample'>spec.</a>";
		return {"description":"Want HTTP message to match 'HAPI' and '" + wanted + "'' for clients who do not have access to response body for HTTP 400-level errors. See "+l,"error": t != true,"got": message};
	}

	if (what === "hapimessage") {
		var re = new RegExp(wanted);
		var t = re.test(wanted);
		var got = message;
		if (t != true) {got = message + ". Consider using https://github.com/hapi-server/verifier-nodejs/blob/master/errors/1.1/errors.json"}
		return {"description":"Want HTTP message to contain the string '" + wanted + "' (default HAPI error message)","error": t != true,"got": message};
	}

}
exports.ErrorInformative = ErrorInformative;

function FileOK(body,what) {
	
	var desc,t,got

	if (what === "firstchar") {
		desc = "Expect first character of CSV response to be an integer.";
		t    = !/^[0-9]/.test(body.substring(0,1));
		got  = body.substring(0,1);
	}

	if (what === "lastchar") {
		desc = "Expect last character of CSV response be a newline."
		t = !/\n$/.test(body.slice(-1))
		got = body.slice(-1).replace(/\n/g,"\\n");
	}

	if (what === "extranewline") {	
		desc = "Expect last two characters of CSV response to not be newlines.";
		t    = /\n\n$/.test(body.slice(-2));
		got  = body.slice(-2).replace(/\n/g,"\\n")
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

	return {"description":"isFileOK(): " + desc,"error":t,"got":got};

}
exports.FileOK = FileOK;

function LengthAppropriate(len,type,name) {
	var got = "Type = " + type + " and length = " + len + " for parameter " + name;
	if (/isotime|string/.test(type) && !len) {
		obj = {"description":"If type = string or isotime, length must not be given","error":true,"got": got};
	} else if (!/isotime|string/.test(type) && len) {
		obj = {"description":"If type = string or isotime, length must be given","error":true,"got": got};
	} else {
		obj = {"description":"Length may only be given for types string and isotime","error":false,"got": got};
	}
	obj["description"] = "is.LengthAppropriate(): " + obj["description"];
	return obj;
}
exports.LengthAppropriate = LengthAppropriate;

function TimeFirstParameter(header) {
	return {"description":"is.TimeFirstParameter(): First parameter should (not must) be named 'Time' b/c clients will likely label first parameter name 'Time' when plotting to protect against first parameter names that are not sensible.","error":header.parameters[0].name !== "Time","got":header.parameters[0].name}
}
exports.TimeFirstParameter = TimeFirstParameter;

function FillOK(fill,type,len,name,what) {
	if (!fill) return; // No fill or fill=null
	var t = false;
	var got = "fill = " + fill + " for parameter " + name + ".";
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
	return {"description":desc,"error":t,"got":got};
}
exports.FillOK = FillOK;

function SizeCorrect(nc,nf,header) {
	var t = nc == nf
	if (header.size) {
		var extra = "product of elements in size array " + JSON.stringify(header.size);
		var got = nc + " commas and " + extra + " = " + nf;
	} else {
		if (nf == 0) {
			var extra = "0 because only Time requested."
		} else {
			var extra = "1 because no size given."
		}
		var got = nc + " commas";
	}
	return {"description":"is.SizeCorrect(): Expect number of commas on first line to be " + extra,"error":t !=true,"got": got};
}
exports.SizeCorrect = SizeCorrect;

function SizeAppropriate(size,name,what) {
	if (!size) return; // No test.
	if (what === "needed") {
		// Test if all elements of size are 1.
		t = 0;
		for (var i=0;i<size.length;i++) {
			t = t + size[i];
		}
		t = t == size.length;
		return {"description":"is.SizeAppropriate(): Size is not needed if all elements are 1.","error":t,"got": "size = " + JSON.stringify(size) + " for parameter " + name}
	}
	if (what === "2D+") {
		// Test size array has 2 or more elements.
		t = false;
		if (size) {
			t = (size.length > 1)
		}
		return {"description":"is.SizeAppropriate(): Size arrays with more than one element are experimental.","error":t,"got": "size = " + JSON.stringify(size) + " for parameter " + name}
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
	return {"description":"is.HTTP200(): Expect HTTP status code to be 200","error":200 != res.statusCode,"got": "HTTP status " + res.statusCode + body};
}
exports.HTTP200 = HTTP200;

function CorrectLength(str,len,name,extra,required) {
	var extra = extra || ""
	var required = required || false
	var got = "(" + (str.length) + ") - (" + (len) + ")"
	var t = str.length != len;
	if (t && !required) {
		got = got + extra + " Not an error for CSV, but may cause error in binary."
	}
	return {"description":'is.CorrectLength(): Expect (trimmed length of ' + name + ' string parameter in CSV) - (parameters.'+ name + '.length) = 0.',"error":t,"got":got}
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
	//var t = new Date(firstTime).getTime() >=  new Date(start).getTime() && new Date(lastTime).getTime() <  new Date(stop).getTime();
	var t = moment(firstTime).valueOf() >=  moment(start).valueOf() && moment(lastTime).valueOf() <  moment(stop).valueOf();
	return {"description": "is.TimeInBounds(): Expect first time in CSV >= " + start + " and last time in CSV < " + stop + " (only checks to ms)","error": t != true,"got":got};
}
exports.TimeInBounds = TimeInBounds;

function TimeIncreasing(header,what) {
	if (what === "CSV") {
		var got = "Monotonically increasing time in CSV"
		var starttest = new Date().getTime();
		var ts = got;
		for (i = 0;i < header.length-2;i++) {// -2 instead of -1 b/c split will place an '' for a line that is only \n.
			var line = header[i].split(",");
			var linenext = header[i+1].split(",");
			//var t = new Date(linenext[0].trim()).getTime() > new Date(line[0].trim()).getTime();
			var t = moment( trailingZfix(linenext[0].trim()) ).valueOf() > moment( trailingZfix(line[0].trim()) ).valueOf();
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
	return {"description":"is.TimeIncreasing(): Expect " + ts,"error":t != true,"got":got};
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

function HAPITime(isostr,schemaregexes) {

	// schemaregexes come from list in a schema file in ./schemas.
	var got,str,result;
	var t = true;
	if (typeof(isostr) === 'object') {
		var starttest = new Date().getTime();
		got = "Valid HAPI Time format";
		for (var i = 0; i < isostr.length; i++) {
			if (isostr[i] === '') {break};
			str = isostr[i].split(",")[0].trim();
			result = HAPITime(str,schemaregexes);
			if (result.error == true) {
				t = false;
				got = str + " is not a valid HAPI Time string.";
				break;
			}
			if (new Date().getTime() - starttest > 10) {
				// Stop testing after 10 ms.
				got = got + " in first " + (i+1) + " lines.";
				break;
			}
			//console.log(isostr[i] + " " + t)
		}
		return {"description":"is.HAPITime(): Expect time column to contain valid HAPI time strings.","error":t != true,"got":got};
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
	var regex_pass;
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
	}

	var t = regex_pass && semantic_pass;
	//if (t==false) {console.log("x" + isostr)}
	return {"description":"is.HAPITime(): Expect time value to be a valid HAPI time string.","error":t != true,"got":got};

}
exports.HAPITime = HAPITime;

function Integer(str,extra) {
	var extra = extra || ""
	var t  = isinteger(str);
	var ts = "(parseInt('"+str+"') < 2^31 - 1 || parseInt('"+str+"') > -2^31) && parseInt(" + str + ") == parseFloat(" + str + ")"+extra;
	return {"description":"is.Integer(): Expect " + ts,"error":t != true,"got":"parseInt(" + str + ") = " + parseInt(str) + " and " + "parseFloat(" + str + ") = " + parseFloat(str)};
}
exports.Integer = Integer;

function Float(str,extra) {
	var extra = extra || ""
	var t  = isfloat(str);
	var ts = "Math.abs(parseFloat('"+str+"')) < " + Number.MAX_VALUE + " && /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]{1,3})?$/.test('"+str+"'.trim()) == true"+extra;
	return {"description":"is.Float(): Expect " + ts,"error":t != true,"got":"/^-?\d*(\.\d+)?$/.test('"+str+"'.trim()) = "+t};
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
	
	var t = !(uids.length == ids.length);
	if (t) {
		var got ="Repeated at least once: " + rids.join(",");
	} else {
		var got ="All unique.";
	}
 	return {"description":"is.Unique(): Expect all '" + idstr + "' values in objects in " + arrstr + " array to be unique","error":t,"got": got};
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

function CORSAvailable(head){
	var ahead = "Access-Control-Allow-Origin";
	var bhead = "Access-Control-Allow-Methods";
	//var chead = "Access-Control-Allow-Headers";
	var astr = head[ahead.toLowerCase()];
	var bstr = head[bhead.toLowerCase()];
	//var cstr = head[chead.toLowerCase()];
	var a = /\*/.test(astr);
	var b = /GET/.test(bstr);
	//var c = /Content-Type/.test(cstr);
	var want = "Access-Control-Allow-{Origin,Methods} = " + "{*, GET}";
	var got = "Access-Control-Allow-{Origin,Methods} = {" + astr + ", " + bstr + "}";
	t = a && b;
	return {"description":"is.CORSAvailable(): To enable AJAX clients, want CORS HTTP Headers " + want,"error":t != true,"got":got};
}
exports.CORSAvailable = CORSAvailable;

function CompressionAvailable(headers){
	var available = false;
	// Note: request module used for http requests only allows gzip to be specified in Accept-Encoding,
	// so error here may be misleading if server can use compress or deflate compression algorithms but not gzip (should be a rare occurence).
	got = "No gzip in Content-Encoding header. Compression will usually speed up transfer of data."
	var re = /gzip/;
	if (headers["content-encoding"]) {
		available = re.test(headers["content-encoding"]);
		if (available) {got = headers["content-encoding"]}
	}
	return {"description":"is.CompressionAvailable(): Expect HTTP Accept-Encoding to match " + re + ". (Note, only compression tested for is gzip.)","error":!available,"got":got};
}
exports.CompressionAvailable = CompressionAvailable;

function ContentType(re,given){
	return {"description":"is.ContentType(): Expect HTTP Content-Type to match " + re,"error":!re.test(given),"got":given || "No Content-Type header."};
}
exports.ContentType = ContentType;

function JSONparsable(text) {
	ret = {"description":"is.JSONparsable(): Expect JSON.parse(response) to not throw error","error":false,"got":"no error"};
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

function HAPIJSON(text,schema,part){

	if (typeof(text) === "object") {
		var json = text;
	} else {
		var json = JSON.parse(text);
	}
	
	var v = new Validator();
	v.addSchema(schema["HAPI"], '/HAPI');
	v.addSchema(schema["HAPIDateTime"], '/HAPIDateTime');
	v.addSchema(schema["HAPIStatus"], '/HAPIStatus');
	version = schema["HAPI"].pattern.replace("^","").replace("$","");
	vr = v.validate(json, schema[part]);
	//console.log(JSON.stringify(vr,null,4))
	ve = vr.errors;
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
	return {"description":"is.HAPIJSON(): Expect body to be valid <a href='"+url+"'>" + part + " schema</a>","error":ve.length != 0,"got":got};
}
exports.HAPIJSON = HAPIJSON;
