var fs      = require('fs');
var request = require('request');
var clc     = require('cli-color');
var moment  = require('moment');
var ip      = require("ip");

var is = require('./is.js'); // Test library

function run(ROOT,ID,PARAMETER,START,STOP,VERSION,REQ,RES) {

	if (!VERSION) {
		VERSION = is.versions().pop();
	}

	if (REQ) {
		var CLOSED = false;
		REQ.connection.on('close',function() {CLOSED = true;});
	}

	// Catch uncaught execeptions.
	process.on('uncaughtException', function(err) {
		console.log(err.stack);
		if (RES) RES.end('<br><br><div style="border:2px solid black"><b><font style="color:red"><b>Problem with verification server (Uncaught Exception). Aborting. Please report last URL shown above in report to the <a href="https://github.com/hapi-server/verifier-nodejs/issues">issue tracker</a>.</b></font></div>');	
		if (!RES) console.log(clc.red('Problem with verification server (Uncaught Exception). Aborting.'));
		if (!RES) process.exit(1);
		if (!RES) console.log(err.stack);
	});
	
	root();
	
	function report(url,obj,opts) {

		// Returns !(obj.error && (stop || abort))
		// stop means processing can't continue on current URL
		// Abort means can't move to testing new URL.
		// Note that abort = true implies stop = true.
		if (obj == false) return false; // Case where test was not appropriate.

		if (opts) {
			var warn  = opts["warn"]  || false; // Warn not fail message on error
			var stop  = opts["stop"]  || false; // Need to stop tests on current URL
			var abort = opts["abort"] || false; // Stop and send abort all processing
			var shush = opts["shush"] || false; // Don't print unless warning, error, or url changed
		} else {
			var warn  = false;
			var stop  = false;
			var abort = false;
			var shush = false;
		}
		var stop = stop || abort; // Make stop true when abort true.

		var firstshush = false; // Don't print pass results for long list of similar tests.
		if (shush && report.shushon == false) {var firstshush = true};
		report.shushon = shush;

		if (!url) {
			// Print summary when report() called.
			if (RES) {
				RES.write("<p>End of validation tests.</p><p>Summary: <font style='color:black;background:green'>Passes</font>:&nbsp;" + report.passes.length + ". <font style='color:black;background:yellow'>Warnings</font>:&nbsp;" + report.warns.length + ". <font style='background:red;color:black'>Failures</font>:&nbsp;" + report.fails.length + ".");
			} else {
				console.log("End of validation tests.");
			}
			if (report.warns.length + report.fails.length > 0) {
				if (RES) {
					RES.write("Warnings and failures repeated below.</p>");
				} else {
					console.log("\nWarnings and failures repeated below.");
				}
			}

			if (!RES) console.log("************************************************************************************");
			if (!RES) console.log("Summary: " + clc.green.inverse('Passes') + ": " + report.passes.length + ". " + clc.yellowBright.inverse('Warnings') + ": " + report.warns.length + ". " + clc.inverse.red('Failures') + ": " + report.fails.length + ".");
			if (!RES && (report.warns.length + report.fails.length > 0)) console.log("Warnings and failures repeated below.");
			if (!RES) console.log("************************************************************************************");
			for (var i = 0;i<report.warns.length;i++) {
				if (RES) RES.write("<br><a href='" + report.warns[i].url.replace(/\&parameters/,"&amp;parameters") + "'>" + report.warns[i].url.replace(/\&parameters/,"&amp;parameters") + "</a><br>")
				if (!RES) console.log("|" + clc.blue(report.warns[i].url));
				if (RES) RES.write("&nbsp;&nbsp;<font style='color:black;background:yellow'>Warn:</font>&nbsp;" + report.warns[i].description + "; Got: <b>" + report.warns[i].got.toString().replace(/\n/g,"<br>").replace(/\s/g,"&nbsp;") + "</b><br>");
				if (!RES) console.log("|  " + clc.yellowBright.inverse("Warn") + " " + report.warns[i].description + "; Got: " + clc.bold(report.warns[i].got));
			}
			for (var i = 0;i<report.fails.length;i++) {
				if (RES) RES.write("<br><a href='" + report.fails[i].url.replace(/\&parameters/,"&amp;parameters") + "'>" + report.fails[i].url.replace(/\&parameters/,"&amp;parameters") + "</a><br>")
				if (!RES) console.log("|" + clc.blue(report.fails[i].url));
				if (RES) RES.write("&nbsp;&nbsp;<font style='color:black;background:red'>Fail</font>&nbsp;" + report.fails[i].description + "; Got: <b>" + report.fails[i].got.toString().replace(/\n/g,"<br>").replace(/\s/g,"&nbsp;") + "</b><br>");
				if (!RES) console.log("|  " + clc.red.inverse("Fail") + " " + report.fails[i].description + "; Got: " + clc.bold(report.fails[i].got));
			}
			if (RES) RES.end("<br><br>End of validation summary.</body></html>");
		
			if (!RES) {
				console.log("\nEnd of validation summary.");
				process.exit(0); // Normal exit.
			}
			return;
		}

		if (typeof(report.url) === "undefined") {
			// First call to report(); initialize and attach arrays
			// to report object.
			if (RES) {RES.write("<html><body>");}
			if (RES) {
				var linkopen = "<a href='https://github.com/hapi-server/verifier-nodejs/tree/master/schemas/HAPI-data-access-schema-"+VERSION+".json'>";
				RES.write("Using " + linkopen + "HAPI schema version " + VERSION + "</a><br/>");
			} else {
				console.log("Using HAPI schema version " + VERSION);
			}
			report.fails = [];  // Initalize failure array
			report.passes = []; // Initalize passes array			
			report.warns = [];  // Initalize warning array	
			// Parse is.js to get line numbers for test functions.
			var istext = fs.readFileSync(__dirname + '/is.js').toString();
			istext = istext.split("\n");
			report.lineobj = {};
			// Store locations in report.lineobj array.
			// TODO: This should happen on server start not here.
			for (var i = 0;i<istext.length;i++) {
				if (istext[i].match(/^function/)) {
					key = istext[i].replace(/^function (.*)?\(.*/,"$1");
					report.lineobj[key] = i+1;
				}
			}
		}
		var indentcons = ""; // Indent console
		var indenthtml = ""; // Indent html
		if (/\/hapi\/data/.test(url)) {
			// Indent extra amount when testing data url
			var indentcons = "  ";
			var indenthtml = "&nbsp;&nbsp;"
		}
		if (report.url !== url) { 
			// Display URL only if not the same as last one seen or requested to be displayed
			// when report() was called.
			if (RES) RES.write("<br>" + indenthtml + "<font style='color:blue'><a href='" + url + "'>" + url.replace(/\&parameters/,"&amp;parameters") + "</a></font></br>");
			if (!RES) console.log("\n" + indentcons + clc.blue(url));
		}
		report.url = url;
		if (!obj) return; // If report(url) was called, only print URL so user knows it is being requested.
		obj.url = url;
		if (RES) {
			// Get function name from description in obj and replace it
			// with a link to GitHub code.
			var key = obj.description.replace(/^is\.(.*?)\(.*/,"$1");
			obj.description = obj.description.replace(/^(is.*?):/,"<a href='https://github.com/hapi-server/verifier-nodejs/blob/master/is.js#L__LINE__'>$1</a>");
			obj.description = obj.description.replace(/__LINE__/,report.lineobj[key]);
		}
		if (obj.error == true && warn == false) {
			report.fails.push(obj)
			if (RES) RES.write(indenthtml + "&nbsp&nbsp;<font style='color:black;background:red'>Fail</font>:&nbsp" + obj.description + ";&nbsp;Got: <b>" + obj.got.toString().replace(/\n/g,"<br>").replace(/\s/g,"&nbsp;")+ "</b><br>");
			if (!RES) console.log(indentcons + "  " + clc.inverse.red("Fail") + ": " + obj.description + "; Got: " + clc.bold(obj.got));
		} else if (obj.error == true && warn == true) {
			report.warns.push(obj)
			if (RES) RES.write(indenthtml + "&nbsp&nbsp;<font style='color:black;background:yellow'>Warn</font>:&nbsp;" + obj.description + ";&nbsp;Got:&nbsp<b>" + obj.got.toString().replace(/\n/g,"<br>").replace(/\s/g,"&nbsp;") + "</b><br>");
			if (!RES) console.log(indentcons + "  " + clc.yellowBright.inverse("Warn") + ": " + obj.description + "; Got: " + clc.bold(obj.got));
		} else {
			report.passes.push(obj);
			if (firstshush) {
				if (RES) RES.write(indenthtml + "&nbsp&nbsp;Passes are being suppressed.<br>");
				if (!RES) console.log(indentcons + "  " + "Passes are being suppressed.");
			}
			if (report.shushon == false) {
				if (RES) RES.write(indenthtml + "&nbsp&nbsp;<font style='color:black;background:green'>Pass</font>:&nbsp;" + obj.description + ";&nbsp;Got:&nbsp<b>" + obj.got.toString().replace(/\n/g,"<br>").replace(/\s/g,"&nbsp;") + "</b><br>");
				if (!RES) console.log(indentcons + "  " + clc.green.inverse("Pass") + ": " + obj.description + "; Got: " + clc.bold(obj.got));
			}
		}

		if (obj.error && stop) {
			if (abort) {
				if (RES) RES.end("<br><font style='color:red'>Cannot continue validation tests due to last failure.</font></body></html>");
				if (RES) RES.end();
				if (!RES) console.log(clc.red("\nCannot continue validation tests due to last failure."));
				if (!RES) process.exit(0);
			} else {
				if (RES) RES.write("<br>&nbsp&nbsp;<font style='color:red'>Cannot continue tests on URL due to last failure.</font><br>");
				if (!RES) console.log(clc.red("\nCannot continue tests on URL due to last failure."));				
			}
		}

		// If no error, return true.  If stopping error, return false
		return !(obj.error && stop) 
	}

	function requesterr(url,err,what,obj) {

		// Catch errors that occur when reqeust is made and before tests are done on response.
		if (obj) {
			if (!obj.warn) obj.warn = false;
			if (!obj.stop) obj.stop = false;
			if (!obj.abort) obj.abort = false;
		} else {
			obj = {"warn":false,"stop":false,"abort":false,"showurl":true};
		}
		var tout = timeout(what);
		var when = timeout(what,"when");
		if (err.code === "ETIMEDOUT") {
			// https://github.com/request/request/blob/master/request.js#L846
			report(url,{"description":"Expect headers and start of response body in less than " + tout + " ms when " + when,"error": true,"got": "ETIMEDOUT"},obj)
		} else if (err.code === "ESOCKETTIMEDOUT") {
			//https://github.com/request/request/blob/master/request.js#L811
			report(url,{"description":"Expect time interval between bytes sent to be less than " + tout + " ms when " + when,"error": true,"got": "ESOCKETTIMEDOUT"},obj)
		} else if (err.code === "ECONNRESET") {
			report(url,{"description":"Expect connection to not be reset by server","error": true,"got": "ECONNRESET"},obj)
		} else if (err.code === "ECONNREFUSED") {
			report(url,{"description":"Expect connection to not be refused by server","error": true,"got": "ECONNREFUSED"},obj)
		} else {
			report(url,{"description":"Probably URL is malformed.","error":true,"got":err},obj);
		}
	}

	function root() {

		// Check optional landing page.

		if (typeof(root.tries) === "undefined") {
			root.tries = 0
			var timeoutFor = "default";
		} else {
			root.tries += 1;
			var timeoutFor = "defaultpreviousfail";			
		};

		var url = ROOT;
		report(url);
		request({"url": url,"timeout": timeout(timeoutFor)}, 
			function (err,res,body) {

				if (err) {
					if (root.tries == 0) {
						requesterr(url,err,timeoutFor,{"warn":true});
						root(); // Try again
					} else {
						requesterr(url,err,timeoutFor);
						capabilities();
					}
					return;
				}
				// TODO: if (!body), warn.
				report(url,is.HTTP200(res),{"warn":true});
				report(url,is.ContentType(/^text\/html/,res.headers["content-type"]),{"warn":true});
				capabilities();
			})
	}

	function capabilities() {

		if (CLOSED) {return;}

		if (typeof(capabilities.tries) === "undefined") {
			capabilities.tries = 0
			var timeoutFor = "default";
		} else {
			capabilities.tries += 1;
			var timeoutFor = "defaultpreviousfail";			
		};

		url = ROOT + "/capabilities";
		report(url);
		//console.log(ip.address())
		request({"url":url,"timeout": timeout(timeoutFor), "headers": {"Origin": ip.address()} }, 
			function (err,res,body) {
				if (err) {
					if (capabilities.tries == 0) {
						requesterr(url,err,timeoutFor,{"warn":true});
						capabilities(); // Try again
					} else {
						requesterr(url,err,timeoutFor);
						catalog();
					}
					return;
				}
				report(url,is.ContentType(/^application\/json/,res.headers["content-type"]));
				report(url,is.CORSAvailable(res.headers),{"warn":true});
				if (!report(url,is.HTTP200(res),{"stop":true})) {
					catalog();
					return;
				}
				if (!report(url,is.JSONparsable(body),{"stop":true})) {
					catalog();
					return;
				}
				if (!report(url,is.HAPIJSON(body,VERSION,'capabilities'),{"stop":true})) {
					catalog();
					return;
				}
				var json = JSON.parse(body);
				var outputFormats = json.outputFormats || "No outputFormats element."
				// Existence of 'csv' can't be checked with schema using enum b/c
				// only requirement is 'csv'; any other output formats can be defined.
				report(url,{"description":"Expect outputFormats to have 'csv'","error": outputFormats.indexOf("csv") == -1,"got": outputFormats.toString()});
				catalog();
			})
	}

	function catalog() {

		if (CLOSED) {return;}

		if (typeof(catalog.tries) === "undefined") {
			catalog.tries = 0
			var timeoutFor = "default";
		} else {
			catalog.tries += 1;
			var timeoutFor = "defaultpreviousfail";			
		};

		var url = ROOT + "/catalog";
		report(url);
		request({"url":url,"timeout": timeout(timeoutFor), "headers": {"Origin": ip.address()}}, 
			function (err,res,body) {

				if (err) {
					if (catalog.tries == 0) {
						requesterr(url,err,timeoutFor,{"warn":true});
						catalog(); // Try again
					} else {
						requesterr(url,err,timeoutFor,{"abort":true});
					}
					return;
				}

				report(url,is.ContentType(/^application\/json/,res.headers["content-type"]));
				report(url,is.CORSAvailable(res.headers),{"warn":true});
				if (!report(url,is.HTTP200(res),{"abort":true})) return;
				if (!report(url,is.JSONparsable(body),{"abort":true})) return;
				report(url,is.HAPIJSON(body,VERSION,'catalog'));
				var datasets = JSON.parse(body).catalog;
				if (datasets) {
					report(url,is.Unique(datasets,"datasets","id"));
					var datasets = removeDuplicates(datasets,'id');
					report(url,is.TooLong(datasets,"catalog","id","title",40),{"warn":true});
					infoerr(datasets);
				} else {
					report(url,{"description":"Expect datasets element in catalog","error":true,"got": datasets},{"abort":true});
					return
				}
			})
	}

	function infoerr(datasets) {

		if (CLOSED) {return;}

		if (typeof(infoerr.tries) === "undefined") {
			infoerr.tries = 0
			var timeoutFor = "default";
		} else {
			infoerr.tries += 1;
			var timeoutFor = "defaultpreviousfail";			
		};

		var url = ROOT + '/info?id=' + "a_test_of_an_invalid_id_by_verifier-nodejs";
		report(url);
		request({"url":url,"timeout": timeout("default")}, 
			function (err,res,body) {

				if (err) {
					if (infoerr.tries == 0) {
						requesterr(url,err,timeoutFor,{"warn":true});
						infoerr(datasets); // Try again
					} else {
						requesterr(url,err,timeoutFor,{"abort":false});
						info(datasets);
					}
					return;
				}

				report(url,is.ContentType(/^application\/json/,res.headers["content-type"]));
				report(url,is.ErrorCorrect(res.statusCode,404,"httpcode"));
				report(url,is.ErrorInformative(res.statusMessage,1406,"httpmessage"),{"warn":true});
				if (report(url,is.JSONparsable(body),{"stop":true})) {
					var json = JSON.parse(body);
					if (report(url,is.HAPIJSON(body,VERSION,'HAPIStatus'),{"stop":true})) {
						report(url,is.ErrorCorrect(json.status.code,1406,"hapicode"));
						var err1406 = errors(1406);
						report(url,is.ErrorInformative(json.status.message,err1406.status.message,"hapimessage"),{"warn":true});
					} 
				}
				info(datasets);
			})
	}

	function info(datasets) {

		if (CLOSED) {return;}

		if (datasets.length == 0) { // All datsets have been checked.
			report();
			return;
		}

		if (!ID) {
			var url = ROOT + '/info?id=' + datasets[0]["id"];
		} else {
			var url = ROOT + '/info' + "?id=" + ID;
			// Only check one dataset with id = ID.
			datasets = selectOne(datasets,'id',ID);
			if (datasets.length == 0) {
				if (!report(url,{"description": "Dataset " + ID + " is not in catalog","error":true,"got": "to abort"},{"abort":true})) {
					return;
				}
			}
		}

		var timeoutFor = "default";
		if (typeof(info.tries) === "undefined") {
			info.tries = [];
		}
		if (typeof(info.tries[datasets.length]) === "undefined") {
			info.tries[datasets.length] = 0;
		} else {
			info.tries[datasets.length] += 1;
			timeoutFor = "defaultpreviousfail";			
		}

		report(url);
		request({"url":url,"timeout": timeout(timeoutFor), "headers": {"Origin": ip.address()}}, 
			function (err,res,body) {

				if (err) {
					if (info.tries[datasets.length] == 0) {
						requesterr(url,err,timeoutFor,{"warn":true});
						info(datasets); // Try again
					} else {
						requesterr(url,err,timeoutFor);
						datasets.shift(); // Remove first element
						info(datasets); // Start next dataset
					}
					return;
				}

				if (!report(url,is.HTTP200(res),{"abort":true})) return;
				report(url,is.ContentType(/^application\/json/,res.headers["content-type"]));
				if (!report(url,is.JSONparsable(body),{"abort":true})) return;
				report(url,is.HAPIJSON(body,VERSION,'info'));
				var header = JSON.parse(body);
				if (header.parameters) {
					if (header.parameters[0].name) {
						report(url,is.Unique(header.parameters,"parameters","name"));
						header.parameters = removeDuplicates(header.parameters,'name');
					} else {
						report(url,{"description":"Expect first parameter object to have a key 'name'","error":true,"got": JSON.stringify(header.parameters[0])},{"abort":true});
						return;						
					}
				} else {
					report(url,{"description":"Expect parameters element in catalog","error":true,"got": header.parameters},{"abort":true});
					return;
				}

				report(url,is.TimeFirstParameter(header),{"warn":true});
				report(url,is.TimeIncreasing(header,"{start,stop}Date"));
				report(url,is.TimeIncreasing(header,"sample{Start,Stop}Date"));
								
				for (var i = 0;i<header.parameters.length;i++) {
					len  = header.parameters[i]["length"];
					type = header.parameters[i]["type"];
					name = header.parameters[i]["name"];
					size = header.parameters[i]["size"];
					fill = header.parameters[i]["fill"];

					report(url,is.FillOK(fill,type,len,name,type),{"warn":true});
					if (type === "string") {
						report(url,is.FillOK(fill,type,len,name,'nullstring'),{"warn":true});
						report(url,is.FillOK(fill,type,len,name,'stringparse'),{"warn":true});
					}

					report(url,is.LengthAppropriate(len,type,name));
					//report(url,is.SizeAppropriate(size,name,"2D+"),{"warn":true});
					report(url,is.SizeAppropriate(size,name,"needed"),{"warn":true});
				}
				if (PARAMETER) {
					if (0) {
						var Time = header.parameters[0];
						header.parameters = selectOne(header.parameters,'name',PARAMETER);
						header.parameters.unshift(Time);
						if (header.parameters.length == 1) {
							if (!report(url,{"description": "Parameter " + PARAMETER + " given in URL or on command line is not in parameter array returned by " + url,"error":true,"got": "To abort"},{"abort":true})) return;
						}
					}
					var tmp = selectOne(header.parameters,'name',PARAMETER);
					if (tmp.length != 1) {
						if (!report(url,{"description": "Parameter " + PARAMETER + " given in URL or on command line is not in parameter array returned by " + url,"error":true,"got": "To abort"},{"abort":true})) return;
					}
				}

				var validCadence = false;
				if (header["cadence"]) {
					report(url,is.CadenceValid(header["cadence"]));
					var obj = is.CadenceValid(header["cadence"]);
					validCadence = !obj.error;
				}

				if (START && STOP) {
					var start = START;
					var stop  = STOP;
					var useTimeoutFor = "datasamplechosen";
				} else if (header["sampleStartDate"] && header["sampleStopDate"]) {
					var start = header["sampleStartDate"];
					var stop  = header["sampleStopDate"];
					var useTimeoutFor = "datasamplesuggested";
					report(url,is.CadenceOK(header["cadence"],start,stop,"sampleStart/sampleStop"),{"warn":true});
				} else {
					var start = header["startDate"];
					var stop = header["stopDate"];
					if (header["cadence"] && validCadence) {
						report(url,is.CadenceOK(header["cadence"],start,stop,"start/stop"));
						var moment = require('moment');
						var md = moment.duration(header["cadence"]);
						var stop = new Date(start).valueOf() + 10*md._milliseconds;
						var stop = new Date(stop).toISOString();
						var useTimeoutFor = "datasample10xcadence";
					} else {
						var useTimeoutFor = "datasampledefault";
						// Check one day
						report(url,{"description":"Not enough information to compute time.max to use.  Using time.min = startDate and time.max = startDate + P1D.","error":true,"got":"No cadence and no sampleStartDate and sampleStopDate."},{"warn":true});
						var stop  = new Date(start).valueOf() + 86400*1000;
						var stop = new Date(stop).toISOString();
					}
				}
				infor(datasets,header,start,stop,useTimeoutFor);
			})
	}

	function infor(datasets,header,start,stop,useTimeoutFor) {
		
		if (CLOSED) {return;}

		// Check if JSON response has two parameter objects when only one parameter is requested.
		// Checks only the second parameter (first parameter after Time).

		var timeoutFor = "default";
		if (typeof(infor.tries) === "undefined") {
			infor.tries = [];
		}
		if (typeof(infor.tries[datasets.length]) === "undefined") {
			infor.tries[datasets.length] = 0;
		} else {
			infor.tries[datasets.length] += 1;
			timeoutFor = "defaultpreviousfail";			
		};

		if (header.parameters.length == 1) {
			// Time is only parameter; can't do request for second parameter.
			data(datasets,header,start,stop,useTimeoutFor);
			return;
		}

		parameter = header.parameters[1].name;
		if (PARAMETER !== "") {
			for (var i=0;i < header.parameters.length;i++) {
				if (header.parameters[i].name === PARAMETER) {
					parameter = header.parameters[i].name;
					break;
				}
			}
		}
		var url = ROOT + '/info' + "?id=" + datasets[0].id + '&parameters=' + parameter;

		report(url);
		request({"url":url,"timeout": timeout(timeoutFor), "headers": {"Origin": ip.address()}}, 
			function (err,res,body) {
				if (err) {
					if (infor.tries[datasets.length] == 0) {
						requesterr(url,err,timeoutFor,{"warn":true});
						infor(datasets,header,start,stop,useTimeoutFor); // Try again
					} else {
						requesterr(url,err,'default',{"stop":true});
						data(datasets,header,start,stop,useTimeoutFor);
					}
					return;
				}

				if (!report(url,is.HTTP200(res),{"stop":true})) {
					data(datasets,header,start,stop,useTimeoutFor);
					return;
				}
				report(url,is.ContentType(/^application\/json/,res.headers["content-type"]));
				if (!report(url,is.JSONparsable(body),{"stop":true})) {
					data(datasets,header,start,stop,useTimeoutFor);
					return;
				}
				var headerReduced = JSON.parse(body); // Reduced header
				if (!report(url,is.HAPIJSON(body,VERSION,'info'))) {
					if (headerReduced.parameters) {
						if (headerReduced.parameters[0]) {
							report(url,{"description":"Expect # parameters in JSON to be 2 when one non-time parameter is requested","error": headerReduced.parameters.length != 2,"got": headerReduced.parameters.length + " parameters."});
						} else {
							report(url,{"description":"Cannot count # of parameters because parameters element is not an array.","error": true,"got": "Non-array parameter element."});
						}
					} else {
						report(url,{"description":"Cannot count # of parameters because parameters element not found.","error": true,"got": "Missing parameter element."});
					}
				} else {
					report(url,{"description":"Expect # parameters in JSON to be 2 when one non-time parameter is requested","error": headerReduced.parameters.length != 2,"got": headerReduced.parameters.length + " parameters."});
				}
				var equivalent = isEquivalent(header,headerReduced,headerReduced.parameters[1],true);
				report(url,{"description":"Expect info response for one parameter to match content in response for all parameters","error": !equivalent, "got": (equivalent ? "Match." : "Mismatch.")});
				data(datasets,header,start,stop,useTimeoutFor);
			})
	}

	function data(datasets,header,start,stop,useTimeoutFor) {

		if (CLOSED) {return;}

		// Request all parameters.

		if (!start || !stop) {
			report(url,{"description":"Need at least startDate and stopDate or sampleStartDate and sampleStopDate to continue.","error":true,"got":"To abort"},{"abort":true});
		}

		var url = ROOT + '/data?id='+ datasets[0].id + '&time.min=' + start + '&time.max=' + stop;
		report(url);
		request({"url":url,"time":true,"gzip":true,"timeout": timeout(useTimeoutFor), "headers": {"Origin": ip.address()}}, 
			function (err,res,bodyAll) {

				if (err) {
					if (useTimeoutFor === "datapreviousfail") {
						requesterr(url,err,useTimeoutFor,{"warn":true,"stop":true});
						// Start checking individual parameters. Skip test
						// using different time format (data2())
						datar(datasets,header,start,stop,useTimeoutFor,0,null);
					} else {
						requesterr(url,err,useTimeoutFor,{"warn":true});
						// Try again
						data(datasets,header,start,stop,"datapreviousfail");
					}
					return;
				}

				if (!report(url,is.HTTP200(res),{"stop":true})) {
					data2(datasets,header,start,stop,useTimeoutFor,bodyAll);
					return;
				}
				if (!report(url,is.FileOK(bodyAll,"empty",res.statusMessage),{"stop":true})) {
					data2(datasets,header,start,stop,useTimeoutFor,bodyAll);					
					return;
				}
				if (!bodyAll || bodyAll.length === 0) {
					data2(datasets,header,start,stop,useTimeoutFor,bodyAll);
					return;					
				}

				report(url,is.CompressionAvailable(res.headers),{"warn":true});
				report(url,is.ContentType(/^text\/csv/,res.headers["content-type"]));
				report(url,is.CORSAvailable(res.headers),{"warn":true});

				report(url,is.FileOK(bodyAll,"firstchar"));
				report(url,is.FileOK(bodyAll,"lastchar"));
				report(url,is.FileOK(bodyAll,"extranewline"));
				report(url,is.FileOK(bodyAll,"numlines"));

				report(url,is.FileDataOK(header,bodyAll,null,null,'Ncolumns'));

				data2(datasets,header,start,stop,useTimeoutFor,bodyAll);
		})
	}

	function data2(datasets,header,start,stop,useTimeoutFor,bodyAll) {

		if (CLOSED) {return;}

		// Same request as data() but with different time format.
		var startnew = md2doy(start);
		var stopnew = md2doy(stop);

		if (startnew === start && stopnew === stop) {
			// No check to perform.
			datar(datasets,header,start,stop,useTimeoutFor,0,bodyAll);
			return;
		}

		var url = ROOT + '/data?id='+ datasets[0].id + '&time.min=' + startnew + '&time.max=' + stopnew;

		request({"url":url,"time":true,"gzip":true,"timeout": timeout(useTimeoutFor), "headers": {"Origin": ip.address()}}, 
			function (err,res,body) {
				if (err) {return;}
				report(url,is.FileDataOK(header,body,bodyAll,null,"contentsame"));
				datar(datasets,header,start,stop,useTimeoutFor,0,bodyAll);
			});		

		function md2doy(timestr) {
			//console.log("Original: " + timestr.substring(0,10));
			var timestrnew = timestr;
			if (/[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(timestr)) {
				timestrnew = moment(timestr.substring(0,10)).format("YYYY-DDDD");
				if (timestrnew === "Invalid date") {
					return timestrnew;
				} else {
					timestrnew = timestrnew + timestr.replace(/[0-9]{4}-[0-9]{2}-[0-9]{2}/,"");
				}
			} else if (/[0-9]{4}-[0-9]{3}/.test(timestr)) {
				timestrnew = moment(timestr.substring(0,8)).format("YYYY-MM-DD");
				if (timestrnew === "Invalid date") {
					return "";
				} else {
					timestrnew = timestrnew + timestr.replace(/[0-9]{4}-[0-9]{3}/,"");
				}
			}
			//console.log("Modified: " + timestrnew);
			return timestrnew;
		}
	}

	function datar(datasets,header,start,stop,useTimeoutFor,pn,bodyAll) {

		if (CLOSED) {return;}

		// Reduced data request. Request one parameter at a time.

		// TODO:
		// This is contorted logic to check only one parameter. Need
		// to rewrite. Also allow PARAMETER to be list of parameters.
		var i = NaN;
		if (PARAMETER !== "") {
			for (var i=0;i < header.parameters.length;i++) {
				if (header.parameters[i].name === PARAMETER) {
					pn = i;
					break;
				}
			}	
		}

		if (pn == i+1 || header.parameters.length == pn) {
			datasets.shift(); // Remove first element
			info(datasets); // Start next dataset
			return; // All parameters for dataset have been checked.
		}

		var parameter = header.parameters[pn].name;

		if (!parameter) {
			report(url,{"description":"Parameter #" + pn + " does not have a name.","error":true,"got":"No name."},{"stop":true});
			// Check next parameter
			datar(datasets,header,start,stop,useTimeoutFor,++pn,bodyAll);
			return;
		}

		if (!start || !stop) {
			report(url,{"description":"Need at least startDate and stopDate or sampleStartDate and sampleStopDate to continue.","error":true,"got":"To abort"},{"abort":true});
		}

		var url = ROOT + '/data?id='+ datasets[0].id + '&parameters=' + parameter + '&time.min=' + start + '&time.max=' + stop;
		report(url);
		request({"url":url,"time":true,"gzip":true,"timeout": timeout(useTimeoutFor), "headers": {"Origin": ip.address()}}, 
			function (err,res,body) {

				if (err) {
					if (useTimeoutFor === "datapreviousfail") {
						requesterr(url,err,useTimeoutFor,{"warn":true,"stop":true});
						// Start on next parameter
						datar(datasets,header,start,stop,"datapreviousfail",++pn,bodyAll);
					} else {
						requesterr(url,err,useTimeoutFor,{"warn":true});
						// Try again
						datar(datasets,header,start,stop,"datapreviousfail",pn,bodyAll);
					}
					return;
				}
				if (!report(url,is.HTTP200(res),{"stop":true})) {
					datar(datasets,header,start,stop,useTimeoutFor,++pn,bodyAll); // Check next parameter
					return;
				}

				var lines = body.split("\n");

				report(url,is.FileOK(body,"emptyconsistent",bodyAll));

				if (!report(url,is.FileOK(body,"empty",res.statusMessage),{"stop":true})) {
					// Check next parameter
					datar(datasets,header,start,stop,useTimeoutFor,++pn,bodyAll);
					return;
				}
				if (!body || body.length === 0) {
					// Check next parameter
					datar(datasets,header,start,stop,useTimeoutFor,++pn,bodyAll);
					return;					
				}

				report(url,is.CompressionAvailable(res.headers),{"warn":true});
				report(url,is.ContentType(/^text\/csv/,res.headers["content-type"]));
				report(url,is.CORSAvailable(res.headers),{"warn":true});

				report(url,is.FileOK(body,"firstchar"));
				report(url,is.FileOK(body,"lastchar"));
				report(url,is.FileOK(body,"extranewline"));
				report(url,is.FileOK(body,"numlines"));

				var line1 = lines[0].split(",");
				var time1 = line1[0].trim();
				if (lines[1]) {
					var line2 = lines[1].split(",")[0];
					var time2 = line2.trim();
				} else {
					var time2 = null;
				}
				report(url,is.CadenceOK(header["cadence"],time1,time2,"consecsample"),{"warn":true});

				var timeLength = header.parameters[0].length;
				
				report(url,is.CorrectLength(time1,timeLength,"Time","",false),{"warn":true});
				report(url,is.HAPITime(lines,VERSION));
				report(url,is.TimeIncreasing(lines,"CSV"));
				report(url,is.TimeInBounds(lines,start,stop));

				if (pn == 0) {
					// Time was requested parameter, no more columns to check
					report(url,is.SizeCorrect(line1.length-1,0,header.parameters[pn]),{"warn":false});
					datar(datasets,header,start,stop,useTimeoutFor,++pn,bodyAll); // Check next parameter
					return;
				}

				var len  = header.parameters[pn]["length"];
				var type = header.parameters[pn]["type"];
				var name = header.parameters[pn]["name"];
				var size = header.parameters[pn]["size"];

				var nf = 1; // Number of fields (columns) counter (start at 1 since time checked already)
				if (!size) {
					nf = nf + 1; // Width of field (number of columns of field)
				} else {
					nf = nf + prod(size);
				}

				// TODO: Check all lines?
				// Move this look into is.FileOK?
				for (var j=1;j < nf;j++) {
					if (j == 1 || j == nf-1) {var shush = false} else {shush = true}
					var extra = ' in column ' + j + ' on first line.'
					if (type === "string") {
						report(url,is.CorrectLength(line1[j],len,name,extra),{"warn":true,"shush":shush});
					}
					if (type === "isotime") {
						report(url,is.ISO8601(line1[j].trim(),extra));
						report(url,is.CorrectLength(line1[j],len,name,extra),{"warn":true,"shush":shush});
					}
					if (type === "integer") {
						report(url,is.Integer(line1[j],extra),{"shush":shush});
					}
					if (type === "double") {
						report(url,is.Float(line1[j],extra),{"shush":shush});
					}
				}

				// Note line.length - 1 = because split() adds extra empty element at end if trailing newline.
				report(url,is.SizeCorrect(line1.length-1,nf-1,header.parameters[pn]),{"warn":true});
				
				if (bodyAll) {
					report(url,is.FileDataOK(header,body,bodyAll,pn,'Ncolumns'));
					report(url,is.FileDataOK(header,body,bodyAll,pn));
				}

				// Check next parameter
				datar(datasets,header,start,stop,useTimeoutFor,++pn,bodyAll);
			})
	}
}
exports.run = run;

function timeout(what,when) {

	var obj = {
		"datapreviousfail":{"timeout":5000,"when":"a previous request for data failed or timed out."},
		"datasampledefault":{"timeout":10000,"when":"time.min/max not given to validator, sampleStart/Stop not given, and no cadence is in /info response and a default request is made for startDate to startDate + P1D."},
		"datasample10xcadence":{"timeout":1000,"when":"time.min/max not given to validator, sampleStart/Stop not given, but cadence is in /info response."},
		"datasamplesuggested":{"timeout":1000,"when":"time.min/max not given to validator but sampleStart/Stop is given in /info response."},
		"datasamplechosen":{"timeout":1000,"when":"time.min/max given to validator"},
		"default":{"timeout":200,"when":"Request is for metadata."},
		"defaultpreviousfail":{"timeout":5000,"when":"a previous request for metadata failed or timed out."}
	};

	if (!when) {
		return obj[what]["timeout"];
	} else {
		return obj[what]["when"];
	}
}

function errors(num) {

	var errs = 
		{
			"1400": {"status":{"code": 1400, "message": "HAPI error 1400: user input error"}},
			"1401": {"status":{"code": 1401, "message": "HAPI error 1401: unknown request field"}},
			"1402": {"status":{"code": 1402, "message": "HAPI error 1402: error in start time"}},
			"1403": {"status":{"code": 1403, "message": "HAPI error 1403: error in stop time"}},
			"1404": {"status":{"code": 1404, "message": "HAPI error 1404: start time equal to or after stop time"}},
			"1405": {"status":{"code": 1405, "message": "HAPI error 1405: time outside valid range"}},
			"1406": {"status":{"code": 1406, "message": "HAPI error 1406: unknown dataset id"}},
			"1407": {"status":{"code": 1407, "message": "HAPI error 1407: unknown dataset parameter"}},
			"1408": {"status":{"code": 1408, "message": "HAPI error 1408: too much time or data requested"}},
			"1409": {"status":{"code": 1409, "message": "HAPI error 1409: unsupported output format"}},
			"1410": {"status":{"code": 1410, "message": "HAPI error 1410: unsupported include value"}},
			"1500": {"status":{"code": 1500, "message": "HAPI error 1500: internal server error"}},
			"1501": {"status":{"code": 1501, "message": "HAPI error 1501: upstream request error"}}
		};

	return errs[num+""];	
}

function isEquivalent(Full, Reduced, parameter, checkparameter) {

    var FullProperties = Object.getOwnPropertyNames(Full);
    var ReducedProperties = Object.getOwnPropertyNames(Reduced);

    if (checkparameter == false) {
    	// Check top-level of object
	    if (FullProperties.length != ReducedProperties.length) {
	        return false;
	    }
	}

    for (var i = 0; i < ReducedProperties.length; i++) {
        var key = ReducedProperties[i];
        if (FullProperties[key] !== ReducedProperties[key]) {        	
            return false;
        }
    }

	if (typeof(checkparameter) === "undefined") {
	    return isEquivalent(Full.parameters,Reduced.parameters,parameter,true);
	}

    return true;
}

function prod(arr) {
	// Compute product of array elements.
	return arr.reduce(function(a,b){return a*b;})
}

function removeDuplicates(arr,key){
	// Remove array elements with objects having
	// key value that that is not unique.  Keep first unique.
	var obj = {};

	for (var i=0;i < arr.length;i++ ) obj[arr[i][key]] = arr[i];

	arr = [];
	// Keep last unique
	// for (keys in obj) arr.push(obj[keysr[i]]);

	// Keep first unique
	var keysr = Object.keys(obj).reverse();
	for (var i=0;i<keysr.length;i++) arr.push(obj[keysr[i]]);

	return arr.reverse();
}

function selectOne(arr,key,value) {

	// Return first array element with an object that has a key with
	// the given value.
	// TODO: Allow value to be an array.

	var arr = JSON.parse(JSON.stringify(arr)); // Deep copy.
	var found = false;
	var ids = [];
	var k = 0;
	while (arr.length > 0) {
		found = arr[0][key] === value;
		ids[k] = arr[0][key];
		k = k + 1;
		if (found) {
			break;
		} else {
			arr.shift();
		}
	}
	if (found) {
		arr = [arr[0]];
	}
	return arr;			
}
