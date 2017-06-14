var fs       = require('fs');
var validate = require('jsonschema').validate;
var moment   = require('moment');
var request  = require('request');
var clc      = require('cli-color');
var argv     = require('yargs')
				.default({
					"port": false,
					"id": "",
					"time.max": "",
					"time.min": "",
					"url": "http://mag.gmu.edu/hapi"
				})
				.argv

if (argv.port) {
	// Server model
	var express = require('express')
	var app     = express()
	var server  = require("http").createServer(app)
	app.get('/verify-hapi', function (req, res) {
		var url   = req.query.url
		if (!url) {
			res.end("<html>Usage: <code>?url=URL&time.min=TIME&time.max=TIME&id=ID</code>.<br><br>Only <code>URL</code> is required.<br><br>Default is to use <code>time.min=startDate</code> and <code>time.max=startDate+P1D</code> and check all dataset IDs from <code>/catalog</code> response.<br><br>Example: <a href='?url=http://mag.gmu.edu/TestData/hapi'>?url=http://mag.gmu.edu/TestData/hapi&time.min=1970-01-01&time.max=1970-01-01T00:00:10&id=TestData</a></html>");
			return;
		}

		var start = req.query["time.max"] || ""
		var stop  = req.query["time.min"] || ""
		var id    = req.query["id"] || ""
		main(url,id,start,stop,res);
	})
	app.listen(argv.port)
	console.log("Listening on port " + argv.port + ". See http://localhost:" + argv.port + "/")
} else {
	// Command-line mode
	main(argv.url,argv.id,argv.start,argv.stop);
}

process.on('uncaughtException', function(err) {
	if (err.errno === 'EADDRINUSE') {
		console.log(ds() + clc.red("Port " + config.PORT + " already in use."))
	} else {
		console.log(err.stack)
	}
})

// Helper function to compute product of array elements.
function prod(arr) {
	return arr.reduce(function(a,b){return a*b;})
}
function isISO8601(str,extra) {
	var extra = extra || ""
	var t  = moment(str,moment.ISO_8601).isValid();
	var ts = "moment('" + str + "',moment.ISO_8601).isValid() == true"+extra;
	return {"description":"isIS8601(): Expect " + ts,"error":t != true,"warning":false,"got":"moment(" + str + ",moment.ISO_8601).isValid() = " + t};
}
function isInteger(str,extra) {
	var extra = extra || ""
	var t  = parseInt(str) == parseFloat(str);
	var ts = "parseInt(" + str + ") == parseFloat(" + str + ")"+extra;
	return {"description":"isInteger(): Expect " + ts,"error":t != true,"warning":false,"got":"parseInt(" + str + ") = " + parseInt(str) + " and " + "parseFloat(" + str + ") = " + parseFloat(str)};
}
function isFloat(str,extra) {
	var extra = extra || ""
	var t  = /^-?\d*(\.\d+)?$/.test(str.trim());
	var ts = "/^-?\d*(\.\d+)?$/.test('"+str+"'.trim()) == true"+extra;
	return {"description":"isFloat(): Expect " + ts,"error":t != true,"warning":false,"got":"/^-?\d*(\.\d+)?$/.test('"+str+"'.trim()) = "+t};
}
function isNaN(str,extra) {
	var extra = extra || ""
	t = str.trim().toLowerCase();
	ts = "'" + str + "'.trim().toLowerCase() === 'nan'"+extra;
	return {"description":"isNaN(): Expect " + ts,"error":t !== "nan","warning":false,"got":"'" + str + "'.trim().toLowerCase() = " + t};
}
function is200(statusCode){
	return {"description":"is200(): Expect HTTP status code to be 200","error":200 != statusCode,"warning":false,"got":statusCode};
}
function isContentType(re,wanted){
	return {"description":"isContentType(): Expect HTTP Content-Type to match " + re,"error":!re.test(wanted),"warning":false,"got":wanted};
}
function isJSON(text){
	ret = {"description":"isJSON(): Expect JSON.parse(str) to not throw error","error":false,"warning":false,"got":"no error"};
	try {
		JSON.parse(text);
		return ret;
	}
	catch (error) {
		ret.got = error;
		ret.error = true;
		return ret;
	}
}
function isHAPIJSON(json,schema){
	jsonschema = fs.readFileSync(__dirname + "/schemas/" + schema + ".json");
	jsonschema = JSON.parse(jsonschema);
	v = validate(json,jsonschema).errors;
	got = "is valid"
	if (v.length != 0) {got = JSON.stringify(v)}
	return {"description":"isJSON(): Expect body to be valid " + schema + " schema","error":v.length != 0,"warning":false,"got":got};
}

function main(ROOT,ID,START,STOP,RES) {
	
	root()

	function report(url,obj) {

		if (!url) {
			// Print summary.
			if (RES) RES.write("<br>Summary: <font style='color:green'>Passes</font>: " + report.passes.length + ". <font style='color:red'>Failures: </font>" + report.fails.length)
			console.log("\nSummary: " + clc.green('Passes') + ": " + report.passes.length + ". " + clc.red('Failures') + ": " + report.fails.length);
			console.log();

			for (var i = 0;i<report.fails.length;i++) {
				if (RES) RES.write("<font style='color:red'>Failures: </font>" + report.fails[i].url)
				console.log(clc.red(report.fails[i].url));
				if (RES) RES.write("&nbsp;&nbsp;<font style='color:red'>Fail: </font>" + report.fails[i].description + "; Got: <b>" + report.fails[i].got + "</b>");
				console.log(clc.red("  Fail: ") + report.fails[i].description + "; Got: " + clc.bold(report.fails[i].got));
			}
			if (RES) {RES.end()}
			return;
		}
		if (typeof(report.url) === "undefined") {
			report.fails = []; // Initalize failure array
			report.passes = []; // Initalize passes array			
		}
		if (report.url !== url){
			if (RES) RES.write("<font style='color:blue'>" + url + "</font></br>")
			console.log("\n" + clc.blue(url)); // Show URL
		}
		report.url = url;
		obj.url = url;
		if (obj.error) {
			report.fails.push(obj)
			if (RES) RES.write("<font style='color:red'>&nbsp&nbsp;Fail:&nbsp</font>" + obj.description + ";&nbsp;Got: <b>" + obj.got + "</b><br>")
			console.log(clc.red("&nbsp;&nbsp;Fail:&nbsp") + obj.description + "; Got:&nbsp;" + clc.bold(obj.got));
		} else {
			report.passes.push(obj)
			if (RES) RES.write("<font style='color:green'>&nbsp&nbsp;Pass:&nbsp;</font>" + obj.description + ";&nbsp;Got:&nbsp<b>" + obj.got + "</b><br>")
			console.log(clc.green("&nbsp;&nbsp;Pass: ") + obj.description + "; Got:&nbsp;" + clc.bold(obj.got));
		}
	}

	function root() {
		var url = ROOT + "/";
		request(url, 
			function (err,res,body) {
				if (err) {
					report(url,{"description":"","error":true,"warning":false,"got":error});
					capabilities();
					return;
				}
				report(url,is200(res.statusCode));
				report(url,isContentType(/^text\/html/,res.headers["content-type"]));
				capabilities();
			})
	}

	function capabilities() {
		url = ROOT + "/capabilities";
		request(url, 
			function (err,res,body) {
				if (err) {
					report(url,{"description":"","error":true,"warning":false,"got":error});
					catalog();
					return;
				}
				report(url,is200(res.statusCode));
				report(url,isContentType(/^application\/json/,res.headers["content-type"]));
				report(url,isJSON(res.body));
				var json = JSON.parse(res.body);
				report(url,isHAPIJSON(json,'capabilities'));
				report(url,{"description":"Expect outputFormats have 'csv'","error":json.outputFormats.indexOf("csv") == -1,"warning":false,"got": JSON.stringify(json.outputFormats)});
				catalog();
				return;
			})
	}

	function catalog() {
		var url = ROOT + "/catalog";
		request(url, 
			function (err,res,body) {
				if (err) {
					report(url,{"description":"","error":true,"warning":false,"got":error});
					infoall(json.catalog);
					return;
				}
				report(url,is200(res.statusCode));
				report(url,isContentType(/^application\/json/,res.headers["content-type"]));
				report(url,isJSON(res.body));
				var json = JSON.parse(res.body);
				report(url,isHAPIJSON(json,'catalog'));
				info(json.catalog);
			})
	}

	function info(datasets,cb) {
		if (datasets.length == 0) return;
		var id = datasets[0]["id"];

		datasets.shift(); // Remove first element	

		if (ID !== "" && ID !== id) {
			info(datasets);
			return;
		}

		var url = ROOT + '/info' + "?id=" + id;
		request(url, 
			function (err,res,body) {
				if (err) {
					report(url,{"description":"","error":true,"warning":false,"got":error});
					data(id,json,0)
					return;
				}
				report(url,is200(res.statusCode));
				report(url,isContentType(/^application\/json/,res.headers["content-type"]));
				report(url,isJSON(res.body));
				var json = JSON.parse(res.body);
				report(url,isHAPIJSON(json,'info'));
				data(id,json,0)
			})
	}

	function data(id,header,pn) {

		var start = START || header["startDate"];
		var stop  = STOP || header["stopDate"];
		//stop = new Date(start).valueOf() + 86400*1000; // Add one day
		stop = new Date(start).valueOf() + 1000; // Add one second
		stop = new Date(stop).toISOString().slice(0,-1); // -1 to remove Z

		if (pn == 0) {
			var parameterlist = header.parameters[pn].name; // Check Time alone
		} else {
			var parameterlist = header.parameters[pn+1].name;
		}
		// TODO: Check if sampleStartDate and sampleStopDate is given. If yes, use them.

		if (pn == header.parameters.length-3) {
			report(); // Print out summary
			return; // All parameters have been checked.
		}
		var url = ROOT + '/data' + "?id=" + id + '&parameters=' + parameterlist + '&time.min=' + start + '&time.max=' + stop	
		request(url, 
			function (err,res,body) {
				var t = 0;
				if (err) {
					report(url,err);
					data(id,header,pn+1); // Check next parameter
					return;
				}
				report(url,is200(res.statusCode));
				report(url,isContentType(/^text\/csv/,res.headers["content-type"]));

				report(url,{"description":'Expect CSV response to start with integer',"error":!/^[0-9]/.test(body.substring(0,1)),"got":body.substring(0,1)});

				report(url,{"description":'Expect last character of CSV response be a newline',"error":!/\n$/.test(body.slice(-1)),"got":body.slice(-1).replace(/\n/g,"\\n")});

				report(url,{"description":'Expect last two characters of CSV response to not be newlines',"error":/\n\n$/.test(body.slice(-2)),"got":body.slice(-2).replace(/\n/g,"\\n")});

				lines = body.split("\n");
				line1 = lines[0].split(",");
				time1 = line1[0].trim();
				timeLength = header.parameters[0].length;

				report(url,{"description":'Expect (trimmed length of first column string in CSV) - (parameters.Time.length-1) should be zero.',"error":time1.length != (timeLength - 1),"got":"(" + (time1.length) + ") - (" + (timeLength-1) + ")"})

				report(url,isISO8601(time1));

				var knownparams = [];
				for (var i = 0;i < header.parameters.length;i++) {
					knownparams[i] = header.parameters[i].name;
				}

				var pnames = parameterlist.split(",");
				var ptypes = [];
				nr = 1; // Time will be there even if not requested
				for (var i = 0;i < pnames.length;i++) {
					if (pnames[i] === 'Time') continue // Don't double count Time if it was in requested parameter list (Time is always returned).
					I = knownparams.indexOf(pnames[i]);
					if (!header.parameters[I]["size"]) {
						var w = 1;
					} else {
						var w = prod(header.parameters[I]["size"])
					}
					ptypes[i] = header.parameters[I]["type"];
					for (var j=nr;j<nr+w;j++) {
						var extra = ' in column ' + j + ' on first line.'
						if (ptypes[i] == "isotime") {
							report(url,isISO8601(line1[j].trim(),extra));
						}
						if (ptypes[i] == "integer") {
							report(url,isInteger(line1[j].trim(),extra));
						}
						if (ptypes[i] == "double") {
							report(url,isFloat(line1[j].trim(),extra));
						}
					}
					var nr = nr + w;
				}
				report(url,{"description":'(# of columns in first line of CSV) - (# computed from length and size metadata) should be zero.',"error":nr != line1.length,"got":"(" + nr + ")" + " - (" + line1.length + ")"});

				data(id,header,pn+1); // Check next parameter
			})
	}
}



