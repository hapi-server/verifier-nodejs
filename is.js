var fs       = require('fs');
var validate = require('jsonschema').validate;
var moment   = require('moment');

// Note that for reporting to have correct line numbers, must start functions with
// function FNAME( and start description with 'is.FNAME()'.

function isinteger(str) {
	return (parseInt(str) < 2^31 - 1 || parseInt(str) > -2^31) && parseInt(str) == parseFloat(str);
}
function isfloat(str) {
	return Math.abs(parseFloat(str)) < Number.MAX_VALUE && /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]{1,3})?$/.test(str.trim())
}

function CadenceValid(cadence) {
	var md = moment.duration(cadence);
	t = md._isValid;
	return {"description":"Expect cadence to be a valid ISO8601 duration","error": t != true,"got": cadence};
}
exports.CadenceValid = CadenceValid;

function CadenceOK(cadence,start,stop,what) {
	if (!cadence) return; // Don't do test; no cadence given.
	if (!stop) return {"description":"Need more than two lines to do cadence comparison with consecutive samples.","error":true,"got":"One line."}
	var startms = new Date(start).valueOf();
	var stopms = new Date(stop).valueOf();
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
		return {"description":"is.CadenceOK(): Expect (sampleStartDate-sampleStopDate)/cadence > 10","error":t != true,"got":got}
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
		return {"description":"Want HTTP message to match 'HAPI' and '" + wanted + "'' for clients who do not have access to response body for HTTP 400-level errors","error": t != true,"got": message};
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
		lines = body.split("\n");
		var got = lines.length + " newlines";
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
	return {"description":"is.TimeFirstParameter(): First parameter should (not must) be named 'Time'.","error":header.parameters[0].name !== "Time","got":header.parameters[0].name}
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
		desc = "is.FillOK(): Expect length of fill value for a isotime parameter to be equal to length of the string parameter - 1";
		if (len < fill.length && name !== "Time") {
			t = true;
			got  = got;
		}
	}
	if (what === "string") {
		desc = "is.FillOK(): Expect length of fill value for a string parameter to be < length of the string parameter";
		if (len < fill.length) {
			t = true;
			got  = got;
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
		var extra = "1 because no size given."
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
			var body = " and non JSON.parse()-able body\t\n" + res.body.replace(/\n/g,"\n\t");
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
	var got = "(" + (str.length) + ") - (" + (len-1) + ")"
	var t = str.length != (len - 1);
	if (t && !required) {
		got = got + extra + " Not an error for CSV, but whitespace padding will cause error in binary."
	}
	return {"description":'is.CorrectLength(): Expect (trimmed length of ' + name + ' string parameter in CSV) - (parameters.'+ name + '.length-1) = 0.',"error":t,"got":got}
}
exports.CorrectLength = CorrectLength;

function TimeInBounds(lines,start,stop) {
	// Remove Z from all times so Date().getTime() gives local timezone time for all.
	// Javascript Date assumes all date/times are in local timezone.
	start = start.trim().replace(/Z$/,"");
	stop = stop.trim().replace(/Z$/,"");

	var firstTime = lines[0].split(",").shift().trim().replace(/Z$/,"");
	var lastTime  = lines[lines.length-2].split(",").shift().trim().replace(/Z$/,"");
	// lines.length-2 above because of split gives empty string in last array element if last line is newline

	var got = "First time = " + firstTime + "; LastTime = " + lastTime;
	var t = new Date(firstTime).getTime() >=  new Date(start).getTime() && new Date(lastTime).getTime() <  new Date(stop).getTime();
	return {"description": "is.TimeInBounds(): Expect first time in CSV >= " + start + " and last time in CSV < " + stop + " (only checks to ms)","error": t != true,"got":got};
}
exports.TimeInBounds = TimeInBounds;

function TimeIncreasing(header,what) {
	if (what === "CSV") {
		var got = "Monotonically increasing time in CSV"
		var starttest = new Date().getTime();
		for (i = 0;i < header.length-2;i++) {// -2 instead of -1 b/c split will place an '' for a line that is only \n.
			var line = header[i].split(",");
			var linenext = header[i+1].split(",");
			var ts = "Time(i+1) > Time(i)";
			var t = new Date(linenext[0].trim()).getTime() > new Date(line[0].trim()).getTime();
			if (!t) {
				var got = linenext[0] + " <= " + line[0];
				break;			
			}
			if (new Date().getTime() - starttest > 10) {
				// Stop testing after 10 ms.
				got = got + " in first " + (i+1) + " lines.";
				break
			}
		}
	}
	if (what === "{start,stop}Date") {
		var start = header.startDate;
		var stop  = header.stopDate;
		var ts = "info.startDate < info.stopDate";
		var t = new Date(start).getTime() < new Date(stop).getTime();
		var got = start + " < " + stop;
	}
	if (what === "sample{Start,Stop}Date") {
		var start = header.sampleStartDate;
		var stop  = header.sampleStopDate;
		if (!start && !stop) return false;
		if (start && stop) {
			var t = new Date(start).getTime() < new Date(stop).getTime();
			var ts = "info.sampleStartDate < info.sampleStopDate";
			var got = start + " < " + stop;
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
	var extra = extra || ""
	var t  = moment(str,moment.ISO_8601).isValid();
	var ts = "moment('" + str + "',moment.ISO_8601).isValid() == true"+extra;
	return {"description":"is.ISO8601(): Expect " + ts,"error":t != true,"got":"moment(" + str + ",moment.ISO_8601).isValid() = " + t};
}
exports.ISO8601 = ISO8601;

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
	var chead = "Access-Control-Allow-Headers";
	var astr = head[ahead.toLowerCase()];
	var bstr = head[bhead.toLowerCase()];
	var cstr = head[chead.toLowerCase()];
	var a = /\*/.test(astr);
	var b = /GET/.test(bstr);
	var c = /Content-Type/.test(cstr);
	var want = "Access-Control-Allow-{Origin,Methods,Headers} = " + "{*, GET, Content-Type}";
	var got = "Access-Control-Allow-{Origin,Methods,Headers} = {" + astr + ", " + bstr + ", " + cstr + "}";
	t = a && b && c;
	return {"description":"is.CORSAvailable(): To enable AJAX clients, want CORS HTTP Headers " + want,"error":t != true,"got":got};
}
exports.CORSAvailable = CORSAvailable;

function CompressionAvailable(headers){
	var available = false;
	// Note: request module used for http requests only allows gzip to be specified in Accept-Encoding,
	// so error here may be misleading if server can use compress or deflate compression algorithms but not gzip (should be a rare occurence).
	got = "No gzip in Content-Encoding header. Compression will usually speed up transfer speed of data."
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

function HAPIJSON(text,schema){
	var json = JSON.parse(text);
	jsonschema = fs.readFileSync(__dirname + "/schemas/1.1/" + schema + ".json");
	jsonschema = JSON.parse(jsonschema);
	v = validate(json,jsonschema).errors;
	got = "is valid"
	if (v.length != 0) {
		var err = [];
		for (var i = 0;i< v.length;i++) {
			err[i] = v[i].property.replace("instance","object") + " " + v[i].message.replace(/\"/g,"'");
		}
		got = "\n\t" + JSON.stringify(err,null,4).replace(/\n/g,"\n\t")
	}
	return {"description":"is.HAPIJSON(): Expect body to be valid " + schema + " schema","error":v.length != 0,"got":got};
}
exports.HAPIJSON = HAPIJSON;