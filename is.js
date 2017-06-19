var fs       = require('fs');
var validate = require('jsonschema').validate;
var moment   = require('moment');

// Note that for reporting to have correct line numbers, must start functions with
// 'function FNAME('' and start description with 'is.FNAME'.

function DurationOK(header,what) {

	if (what === "{start,stop}Date") {
		if (!header["cadence"]) return false; // Don't do test.
		startstr = "startDate";
		stopstr = "stopDate";
	}

	if (what === "sample{Start,Stop}Date") {
		if (!header["cadence"] || !header["sampleStartDate"] || !header["sampleStartDate"]) return false; // Don't do test.
		startstr = "sampleStartDate";
		stopstr = "sampleStopDate";
	}

	var dt = moment.duration(header["cadence"]);
	var dT = new Date(header[stopstr]).getTime() - new Date(header[startstr]).getTime();
	var t = dt <= dT;
	var got = header["cadence"] + " <= " + header[stopstr] + " - " + header[startstr];
	if (!t) {
		var got = got.replace("<=",">");
	}
	return {"description":"is.DurationOK(): Cadence <= " + stopstr + " - " + startstr,"error": t != true,"got":got};
}
exports.DurationOK = DurationOK;

function FileOK(body,what) {

	if (what === "firstchar") {
		desc = "Expect CSV response to start w/ integer.";
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
		var got = lines.length + " lines";
		if (lines.length == 0) {
			got = "No lines.";
		} else {
			got = lines.length + " lines";
		}
		desc = "Expect at least one line in CSV response.";
		t = lines.length == 0
	}

	return {"description":"isFileOK(): " + desc,"error":t,"got":got};

}
exports.FileOK = FileOK;

function LengthAppropriate(len,type,name) {
	if (/isotime|string/.test(type) && !len) {
		obj = {"description":"If type = string or isotime, length must not be given","error":true,"got": "Type = " + type + " and length = " + len + " for parameter " + name};
	} else if (t = !/isotime|string/.test(type) && len) {
		obj = {"description":"If type = string or isotime, length must be given","error":true,"got": "Type = " + type + " and length = " + len + " for parameter " + name};
	} else {
		obj = {"description":"Length may only be given for types string and isotime","error":false,"got": "Type = " + type + " and length = " + len + " for parameter " + name};
	}
	obj["description"] = "is.SizeAppropriate(): " + obj["description"];
	return obj;
}
exports.LengthAppropriate = LengthAppropriate;

function SizeAppropriate(size,name,what) {
	if (!size) return;
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
		} catch (error) {}

		if (!body) {
			var body = " and non JSON.parseable() body\t\n" + res.body.replace(/\n/g,"\n\t");
		} else {
			var body = "";
		}

	}
	return {"description":"is.HTTP200(): Expect HTTP status code to be 200","error":200 != res.statusCode,"got":"HTTP status " + res.statusCode + body};
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
	return {"description":'is.CorrectLength(): Expect (trimmed length of ' + name + ' string parameter in CSV) - (parameters.'+ name + '.length-1) should be zero.',"error":t,"got":got}
}
exports.CorrectLength = CorrectLength;

function TimeInBounds(lines,start,stop) {
	var firstTime = lines[0].split(",").shift();
	var lastTime  = lines[lines.length-2].split(",").shift(); // -2 because of split gives empty string in last array element if last line is newline.
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
			var t = new Date(linenext[0]).getTime() > new Date(line[0]).getTime();
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
	var t  = (parseInt(str) < 2^31 - 1 || parseInt(str) > -2^31) && parseInt(str) == parseFloat(str);
	var ts = "(parseInt('"+str+"') < 2^31 - 1 || parseInt('"+str+"') > -2^31) && parseInt(" + str + ") == parseFloat(" + str + ")"+extra;
	return {"description":"is.Integer(): Expect " + ts,"error":t != true,"got":"parseInt(" + str + ") = " + parseInt(str) + " and " + "parseFloat(" + str + ") = " + parseFloat(str)};
}
exports.Integer = Integer;

function Float(str,extra) {
	var extra = extra || ""
	var t  = Math.abs(parseFloat(str)) < Number.MAX_VALUE && /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]{1,3})?$/.test(str.trim());
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
 	return {"description":"is.Unique(): Expect all '" + idstr + "' values in objects in " + arrstr + " array to be unique","error":!(uids.length == ids.length),"got": "Repeated at least once: " + rids.join(",")};
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

function CompressionAvailable(headers){
	var available = false;
	// Note: request module used for http requests only allows gzip to be specified in Accept-Encoding.
	// So error here may be misleading if server can use compress or deflate compression algorithms.
	got = "No gzip in Content-Encoding header. Compression will usually speed up transfer speed of data."
	var re = /gzip/;
	if (headers["content-encoding"]) {
		available = re.test(headers["content-encoding"]);
		if (available) {got = headers["content-encoding"]}
	}
	return {"description":"is.CompressionAvailable(): Expect HTTP Accept-Encoding to match " + re,"error":!available,"got":got};
}
exports.CompressionAvailable = CompressionAvailable;

function ContentType(re,given){
	return {"description":"is.ContentType(): Expect HTTP Content-Type to match " + re,"error":!re.test(given),"got":given || "No Content-Type header."};
}
exports.ContentType = ContentType;

function JSONparsable(text){
	ret = {"description":"is.JSONparsable(): Expect JSON.parse(str) to not throw error","error":false,"got":"no error"};
	try {
		JSON.parse(text);
		return ret;
	}
	catch (error) {
		ret.got = error + " See http://jsonlint.org/ for better error report";
		ret.error = true;
		return ret;
	}
}
exports.JSONparsable = JSONparsable;

function HAPIJSON(text,schema){
	var json = JSON.parse(text);
	jsonschema = fs.readFileSync(__dirname + "/schemas/" + schema + ".json");
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