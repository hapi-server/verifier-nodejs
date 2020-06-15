const fs      = require('fs');
const clc     = require('chalk');
const moment  = require('moment');
const ip      = require("ip");
const zlib    = require('zlib');
const http    = require('http');
const https   = require('https');
const urllib  = require('url');
const request = require('request');

var is = require('./is.js'); // Test library

function run(ROOT,ID,PARAMETER,START,STOP,VERSION,DATATIMEOUT,METATIMEOUT,REQ,RES,PLOTSERVER) {

	if (!PLOTSERVER) {
		PLOTSERVER = 'http://hapi-server.org/plot';
	}

	var CATALOG; // Resolved in catalog(); used in report() to print ViViz links.
	function internalerror(err) {
		console.log(err.stack);
		if (RES) RES.end('<br><br><div style="border:2px solid black"><b><font style="color:red"><b>Problem with verification server (Uncaught Exception). Aborting. Please report last URL shown above in report to the <a href="https://github.com/hapi-server/verifier-nodejs/issues">issue tracker</a>.</b></font></div>');	
		if (!RES) console.log(clc.red('Problem with verification server (Uncaught Exception). Aborting.'));
		if (!RES) process.exit(1);
		if (!RES) console.log(err.stack);
	}

	if (REQ) {
		var CLOSED = false;
		REQ.connection.on('close',function() {CLOSED = true;});
	}

	// Catch uncaught execeptions.
	process.on('uncaughtException', internalerror);

	root();

	function versioncheck(url,metaVersion,urlVersion) {
		if (urlVersion) {
			return urlVersion; // Use version given in URL
		} else {
			if (!report(url,is.HAPIVersion(metaVersion),{"stop":false})) {
				return is.versions().pop(); // Use latest version
			} else {
				return metaVersion;
			}
		}		
	}

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
				if (RES) RES.write("&nbsp;&nbsp;<font style='color:black;background:yellow'>Warn:</font>&nbsp;" + report.warns[i].description + "; Got: <b>" + report.warns[i].got.toString().replace(/\n/g,"<br>") + "</b><br>");
				if (!RES) console.log("|  " + clc.yellowBright.inverse("Warn") + " " + report.warns[i].description + "; Got: " + clc.bold(report.warns[i].got));
			}
			for (var i = 0;i<report.fails.length;i++) {
				if (RES) RES.write("<br><a href='" + report.fails[i].url.replace(/\&parameters/,"&amp;parameters") + "'>" + report.fails[i].url.replace(/\&parameters/,"&amp;parameters") + "</a><br>")
				if (!RES) console.log("|" + clc.blue(report.fails[i].url));
				if (RES) RES.write("&nbsp;&nbsp;<font style='color:black;background:red'>Fail</font>&nbsp;" + report.fails[i].description + "; Got: <b>" + report.fails[i].got.toString().replace(/\n/g,"<br>") + "</b><br>");
				if (!RES) console.log("|  " + clc.red.inverse("Fail") + " " + report.fails[i].description + "; Got: " + clc.bold(report.fails[i].got));
			}

			request({"url": ROOT+"/capabilities"},
				function (err,res,body) {
				}
			)

			if (RES) {
				RES.write("<br><br>");
				RES.write("<b>Use the following links for visual checks of data and stress testing server.</b><br><br>")
				for (var i = 0;i < CATALOG["catalog"].length;i++) {
					var link = PLOTSERVER + "?server=" + ROOT + "&id=" +CATALOG["catalog"][i]["id"] + "&format=gallery";
					RES.write("<a target='_blank' href='" + link + "'>" + link + "</a><br>");
				}
				RES.end("</body></html>");
			}
		
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

			if (VERSION) {
				if (RES) {
					var linkopen = "<a href='https://github.com/hapi-server/verifier-nodejs/tree/master/schemas/HAPI-data-access-schema-"+VERSION+".json'>";
					RES.write("Using " + linkopen + "HAPI schema version " + VERSION + "</a><br/>");
				} else {
					console.log("Using HAPI schema version " + VERSION);
				}
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
		if (!obj) {
			// If report(url) was called, only print URL so user knows it is being requested.
			return
		}; 

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
			if (RES) RES.write(indenthtml + "&nbsp&nbsp;<font style='background-color:red'><b>&#x2715;</b></font>:&nbsp" + obj.description + ";&nbsp;Got: <b>" + obj.got.toString().replace(/\n/g,"<br>") + "</b><br>");
			if (!RES) console.log(indentcons + "  " + clc.inverse.red("Fail") + ": " + obj.description + "; Got: " + clc.bold(obj.got));
		} else if (obj.error == true && warn == true) {
			report.warns.push(obj)
			if (RES) RES.write(indenthtml + "&nbsp&nbsp;<font style='background-color:yellow'><b>&#x26a0;</b></font>:&nbsp;" + obj.description + ";&nbsp;Got:&nbsp<b>" + obj.got.toString().replace(/\n/g,"<br>") + "</b><br>");
			if (!RES) console.log(indentcons + "  " + clc.yellowBright.inverse("Warn") + ": " + obj.description + "; Got: " + clc.bold(obj.got));
		} else {
			report.passes.push(obj);
			if (firstshush) {
				if (RES) RES.write(indenthtml + "&nbsp&nbsp;Passes are being suppressed.<br>");
				if (!RES) console.log(indentcons + "  " + "Passes are being suppressed.");
			}
			if (report.shushon == false) {
				if (RES) RES.write(indenthtml + "&nbsp&nbsp;<font style='background-color:green;'><b>&#x2713;</b></font>:&nbsp;" + obj.description + ";&nbsp;Got:&nbsp<b>" + obj.got.toString().replace(/\n/g,"<br>") + "</b><br>");
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

	function root() {
		// Check optional landing page.

		if (typeof(root.tries) === "undefined") {
			root.tries = 0
			var metaTimeout = "metadefault";
		} else {
			root.tries += 1;
			var metaTimeout = "metapreviousfail";			
		};

		var url = ROOT;
		report(url);
		request(
			{
				"url": url,
				"timeout": timeout(metaTimeout),
				"time": true
			},
			function (err,res,body) {
				if (err) {
					report(url,is.RequestError(err,res,metaTimeout,timeout()),{"warn":true});
					if (root.tries == 0) {
						root(); // Try again
					} else {
						capabilities();
					}
					return;
				}

				report(url,is.RequestError(err,res,metaTimeout,timeout()));

				// TODO: if (!body), warn.
				//console.log(res);
				report(url,is.HTTP200(res),{"warn":true});
				report(url,is.ContentType(/^text\/html/,res.headers["content-type"]),{"warn":true});
				capabilities();

			})
	}

	function capabilities() {

		if (CLOSED) {return;}

		if (typeof(capabilities.tries) === "undefined") {
			capabilities.tries = 0
			var metaTimeout = "metadefault";
		} else {
			capabilities.tries += 1;
			var metaTimeout = "metapreviousfail";			
		};

		var url = ROOT + "/capabilities";
		report(url);
		request(
			{
				"url": url,
				"timeout": timeout(metaTimeout),
				"headers": {"Origin": ip.address()},
				"time": true
			},
			function (err,res,body) {

				if (err) {
					report(url,is.RequestError(err,res,metaTimeout,timeout()),{"warn":true});
					if (capabilities.tries == 0) {
						capabilities(); // Try again
					} else {
						catalog(['csv']);
					}
					return;
				}

				report(url,is.RequestError(err,res,metaTimeout,timeout()));
				report(url,is.ContentType(/^application\/json/,res.headers["content-type"]));
				report(url,is.CORSAvailable(res.headers),{"warn":true});
				if (!report(url,is.HTTP200(res),{"stop":true})) {
					catalog(['csv']);
					return;
				}
				if (!report(url,is.JSONparsable(body),{"stop":true})) {
					catalog(['csv']);
					return;
				}
				var json = JSON.parse(body);
				var version = versioncheck(url,json.HAPI,VERSION);
				if (!report(url,is.HAPIJSON(body,version,'capabilities'),{"stop":true})) {
					catalog(['csv']);
					return;
				}
				var outputFormats = json.outputFormats || "No outputFormats element."
				// Existence of 'csv' can't be checked easily with schema using enum.
				// (Could be done using oneOf for outputFormats and have csv be in emum
				// array for each of the objects in oneOf.)
				report(url,
						{
							"description":"Expect outputFormats to have 'csv'",
							"error": outputFormats.indexOf("csv") == -1,
							"got": outputFormats.toString()
						});
				catalog(outputFormats);
			})
	}

	function catalog(formats) {

		if (CLOSED) {return;}

		if (typeof(catalog.tries) === "undefined") {
			catalog.tries = 0
			var metaTimeout = "metadefault";
		} else {
			catalog.tries += 1;
			var metaTimeout = "metapreviousfail";			
		};

		var url = ROOT + "/catalog";
		report(url);
		request(
			{
				"url": url,
				"timeout": timeout(metaTimeout),
				"headers": {"Origin": ip.address()},
				"time": true
			},
			function (err,res,body) {

				if (err) {
					if (catalog.tries == 0) {
						report(url,is.RequestError(err,res,metaTimeout,timeout()),{"warn":true});
						catalog(formats); // Try again
					} else {
						report(url,is.RequestError(err,res,metaTimeout,timeout()),{"abort":true});
					}
					return;
				}

				report(url,is.RequestError(err,res,metaTimeout,timeout()));
				report(url,is.ContentType(/^application\/json/,res.headers["content-type"]));
				report(url,is.CORSAvailable(res.headers),{"warn":true});
				if (!report(url,is.HTTP200(res),{"abort":true})) return;
				if (!report(url,is.JSONparsable(body),{"abort":true})) return;
				CATALOG = JSON.parse(body);
				var cat = CATALOG["catalog"];
				if (ID) {
					for (var i = 0;i < cat.length;i++) {
						if (cat[i]["id"] == ID) {
							var catr = [cat[i]];
							break;
						}
					}
					CATALOG["catalog"] = catr;
				}
				var version = versioncheck(url,CATALOG.HAPI,VERSION);
				report(url,is.HAPIJSON(body,version,'catalog'));
				var datasets = JSON.parse(body).catalog;
				if (datasets) {
					report(url,is.Unique(datasets,"datasets","id"));
					var datasets = removeDuplicates(datasets,'id');
					report(url,is.TooLong(datasets,"catalog","id","title",40),{"warn":true});
					report(url,is.CIdentifier(datasets,"dataset id"),{"warn":true});					
					infoerr(formats,datasets);
				} else {
					report(url,
						{
							"description": "Expect datasets element in catalog",
						 	"error": true,
						 	"got": datasets
						 },
						 {"abort":true});
					return
				}
			})
	}

	function infoerr(formats,datasets) {

		if (CLOSED) {return;}

		if (typeof(infoerr.tries) === "undefined") {
			infoerr.tries = 0
			var metaTimeout = "metadefault";
		} else {
			infoerr.tries += 1;
			var metaTimeout = "metapreviousfail";			
		};

		var url = ROOT + '/info?id=' + "a_test_of_an_invalid_id_by_verifier-nodejs";
		report(url);
		request(
			{
				"url": url,
				"timeout": timeout(metaTimeout),
				"time": true
			},
			function (err,res,body) {

				if (err) {
					report(url,is.RequestError(err,res,metaTimeout,timeout()),{"warn":true});
					if (infoerr.tries == 0) {
						infoerr(formats,datasets); // Try again
					} else {
						info(formats,datasets);
					}
					return;
				}

				report(url,is.RequestError(err,res,metaTimeout,timeout()));
				report(url,is.ContentType(/^application\/json/,res.headers["content-type"]));
				report(url,is.ErrorCorrect(res.statusCode,404,"httpcode"));
				var err1406 = errors(1406);
				report(url,is.StatusInformative(res.statusMessage,err1406.status.message,'httpstatus'),{"warn":true});
				if (report(url,is.JSONparsable(body),{"stop":true})) {
					var json = JSON.parse(body);
					var version = versioncheck(url,json.HAPI,VERSION);
					if (report(url,is.HAPIJSON(body,version,'HAPIStatus'),{"stop":true})) {
						report(url,is.ErrorCorrect(json.status.code,1406,"hapicode"));
						report(url,is.StatusInformative(json.status.message,err1406.status.message,'hapistatus'),{"warn":true});
					} 
				}
				info(formats,datasets);
			})
	}

	function info(formats,datasets) {

		if (CLOSED) {return;}

		if (datasets.length == 0) {
			// All datsets have been checked.
			report();
			return;
		}

		if (!ID) {
			var id = datasets[0]["id"];
			var url = ROOT + '/info?id=' + datasets[0]["id"];
		} else {
			var id = ID;
			var url = ROOT + '/info' + "?id=" + ID;
			// Only check one dataset with id = ID.
			datasets = selectOne(datasets,'id',ID);
			if (datasets.length == 0) {
				if (!report(url,
								{
									"description": "Dataset " + ID + " is not in catalog",
									"error": true,
									"got": "to abort"
								},
								{"abort":true}
							)
					) {
					return;
				}
			}
		}

		var metaTimeout = "metadefault";
		if (typeof(info.tries) === "undefined") {
			info.tries = [];
		}
		if (typeof(info.tries[datasets.length]) === "undefined") {
			info.tries[datasets.length] = 0;
		} else {
			info.tries[datasets.length] += 1;
			metaTimeout = "metapreviousfail";			
		}

		report(url);

		if (RES && info.tries[datasets.length] == 0) {
			img = '<img width="20px" src="data:image/png;base64,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" alt="" />';
			var link = PLOTSERVER+"?server=" + ROOT + "&id=" + id + "&format=gallery";
			var note = "<a target='_blank' href='" + link + "'>Visually check data and test performance</a>";
			RES.write("&nbsp&nbsp;" + img + ":&nbsp" + note + "<br>");
		}

		request({"url":url,"timeout": timeout(metaTimeout), "headers": {"Origin": ip.address()}, "time": true},
			function (err,res,body) {

				if (err) {
					report(url,is.RequestError(err,res,metaTimeout,timeout()),{"warn":true});
					if (info.tries[datasets.length] == 0) {
						info(formats,datasets); // Try again
					} else {
						datasets.shift(); // Remove first element
						info(formats,datasets); // Start next dataset
					}
					return;
				}

				report(url,is.RequestError(err,res,metaTimeout,timeout()));
				if (!report(url,is.HTTP200(res),{"abort":true})) return;
				report(url,is.ContentType(/^application\/json/,res.headers["content-type"]));
				if (!report(url,is.JSONparsable(body),{"abort":true})) return;
				var header = JSON.parse(body);
				var version = versioncheck(url,header.HAPI,VERSION);
				report(url,is.HAPIJSON(body,version,'info'));
				if (header.parameters) {
					if (header.parameters[0].name) {
						report(url,is.Unique(header.parameters,"parameters","name"));
						//header.parameters = removeDuplicates(header.parameters,'name');
					} else {
						report(url,
							{
								"description":
								"Expect first parameter object to have a key 'name'",
								"error": true,
								"got": JSON.stringify(header.parameters[0])
							},
							{"abort":true});
						return;						
					}
				} else {
					report(url,
						{
							"description": "Expect parameters element in catalog",
							"error": true,
							"got": header.parameters
						},
						{"abort":true});
					return;
				}

				report(url,is.FormatInHeader(header, "nodata"));
				report(url,is.FirstParameterOK(header, "name"),{"warn":true});
				report(url,is.FirstParameterOK(header, "fill"));
				report(url,is.TimeIncreasing(header,"{start,stop}Date"));
				report(url,is.TimeIncreasing(header,"sample{Start,Stop}Date"));
								
				for (var i = 0;i<header.parameters.length;i++) {
					len  = header.parameters[i]["length"];
					type = header.parameters[i]["type"];
					name = header.parameters[i]["name"];
					size = header.parameters[i]["size"];
					fill = header.parameters[i]["fill"];
					units = header.parameters[i]["units"];
					label = header.parameters[i]["label"]

					if (!size) {
						size = [1];
					}
					//console.log(name,size,units)
					report(url,is.UnitsOK(name,units,type,size,version),{"warn":false});
					report(url,is.FillOK(fill,type,len,name,type),{"warn":true});
					report(url,is.ArrayOK(name,units,size,"units",version),{"warn":false});
					report(url,is.ArrayOK(name,label,size,"label",version),{"warn":false});

					if (type === "string") {
						report(url,is.FillOK(fill,type,len,name,'nullstring'),{"warn":true});
						report(url,is.FillOK(fill,type,len,name,'stringparse'),{"warn":true});
					}

					report(url,is.LengthAppropriate(len,type,name));
					report(url,is.BinsOK(name,header.parameters[i]["bins"],size));
					//report(url,is.SizeAppropriate(size,name,"2D+"),{"warn":true});
					//report(url,is.SizeAppropriate(size,name,"needed"),{"warn":true});
				}
				if (PARAMETER) {
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
					// start/stop given in verifier request URL
					var start = START;
					var stop  = STOP;
					var dataTimeout = "datasamplechosen";
				} else if (header["sampleStartDate"] && header["sampleStopDate"]) {
					var start = header["sampleStartDate"];
					var stop  = header["sampleStopDate"];
					var dataTimeout = "datasamplesuggested";
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
						var dataTimeout = "datasample10xcadence";
					} else {
						var dataTimeout = "datadefault";
						// Check one day
						report(url,
							{
								"description": "Not enough information to compute time.max to use for data tests. Using time.min = startDate and time.max = startDate + P1D.",
								"error":true,
								"got":"No cadence and no sampleStartDate and sampleStopDate."
							},
							{"warn":true});
						var stop  = new Date(start).valueOf() + 86400*1000;
						var stop = new Date(stop).toISOString();
					}
				}
				infor(formats,datasets,header,start,stop,dataTimeout);
			})
	}

	function infor(formats,datasets,header,start,stop,dataTimeout) {
		
		if (CLOSED) {return;}

		// Check if JSON response has two parameter objects when only
		// one parameter is requested. Checks only the second parameter
		// (first parameter after Time).

		var metaTimeout = "metadefault";
		if (typeof(infor.tries) === "undefined") {
			infor.tries = [];
		}
		if (typeof(infor.tries[datasets.length]) === "undefined") {
			infor.tries[datasets.length] = 0;
		} else {
			infor.tries[datasets.length] += 1;
			metaTimeout = "metapreviousfail";			
		};

		if (header.parameters.length == 1) {
			// Time is only parameter; can't do request for second parameter.
			dataAll1(formats,datasets,header,start,stop,dataTimeout);
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
		var url = ROOT + '/info' 
					+ "?id=" + datasets[0].id 
					+ '&parameters=' + parameter;

		report(url);
		request(
			{
				"url": url,
				"timeout": timeout(metaTimeout),
				"headers": {"Origin": ip.address()},
				"time": true
			},
			function (err,res,body) {
				if (err) {
					if (infor.tries[datasets.length] == 0) {
						// Try again
						report(url,is.RequestError(err,res,metaTimeout,timeout()),{"warn":true});
						infor(formats,datasets,header,start,stop,dataTimeout); 
					} else {
						report(url,is.RequestError(err,res,metaTimeout,timeout()),{"stop":true});
						dataAll1(formats,datasets,header,start,stop,dataTimeout);
					}
					return;
				}

				report(url,is.RequestError(err,res,metaTimeout,timeout()));
				if (!report(url,is.HTTP200(res),{"stop":true})) {
					dataAll1(formats,datasets,header,start,stop,dataTimeout);
					return;
				}
				report(url,is.ContentType(/^application\/json/,res.headers["content-type"]));
				if (!report(url,is.JSONparsable(body),{"stop":true})) {
					dataAll1(formats,datasets,header,start,stop,dataTimeout);
					return;
				}
				var headerReduced = JSON.parse(body); // Reduced header
				var version = versioncheck(url,headerReduced.HAPI,VERSION);
				if (!report(url,is.HAPIJSON(body,version,'info'))) {
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
				dataAll1(formats,datasets,header,start,stop,dataTimeout);
			})
	}

	function dataAll1(formats,datasets,header,start,stop,dataTimeout) {

		// Request all parameters using start/stop.

		if (CLOSED) {return;}

		if (typeof(dataAll1.tries) === "undefined") {
			dataAll1.tries = 0
			var useTimeout = dataTimeout;
		} else {
			dataAll1.tries += 1;
			var useTimeout = "datapreviousfail";			
		};

		if (!start || !stop) {
			report(url,
					{
						"description":"Need at least startDate and stopDate or sampleStartDate and sampleStopDate to continue.",
						"error":true,
						"got":"To abort"
					},
					{"abort": true});
		}

		var url = ROOT 
					+ '/data?id=' + datasets[0].id 
					+ '&time.min=' + start 
					+ '&time.max=' + stop;

		report(url);
		request(
			{
				"url": url,
				"gzip": true,
				"timeout": timeout(useTimeout),
				"headers": {"Origin": ip.address()},
				"time": true
			},
			function (err,res,bodyAll) {

				if (err) {
					if (useTimeout === "datapreviousfail") {
						report(url,is.RequestError(err,res,useTimeout,timeout()),{"warn":true,"stop":true});
						// Start checking individual parameters. Skip test
						// using different time format (dataAll2()) and request
						// with header (dataAll_Header()).
						datar(formats,datasets,header,start,stop,"",useTimeout,null,0);
					} else {
						report(url,is.RequestError(err,res,dataTimeout,timeout()),{"warn":true});
						// Try again
						dataAll1(formats,datasets,header,start,stop,dataTimeout);
					}
					return;
				}

				report(url,is.RequestError(err,res,useTimeout,timeout()));
				if (!report(url,is.HTTP200(res),{"stop":true})) {
					dataAll2(formats,datasets,header,start,stop,dataTimeout,bodyAll);
					return;
				}
				if (!report(url,is.FileOK(bodyAll,"empty",res.statusMessage),{"stop":true})) {
					dataAll2(formats,datasets,header,start,stop,dataTimeout,bodyAll);					
					return;
				}
				if (!bodyAll || bodyAll.length === 0) {
					dataAll2(formats,datasets,header,start,stop,dataTimeout,bodyAll);
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

				dataAll2(formats,datasets,header,start,stop,dataTimeout,bodyAll);
		})
	}

	function dataAll2(formats,datasets,header,start,stop,dataTimeout,bodyAll) {

		// Same request as dataAll1() but with different time format.
		// If dataAll1() used YMD, then dataAll2() uses YDOY and vice-versa.

		if (CLOSED) {return;}

		if (typeof(dataAll2.tries) === "undefined") {
			dataAll2.tries = 0
			var useTimeout = dataTimeout;
		} else {
			dataAll2.tries += 1;
			var useTimeout = "datapreviousfail";			
		};

		// md2doy converts YMD -> DOY or YDOY -> YMD
		var startnew = md2doy(start);
		var stopnew = md2doy(stop);

		var url = ROOT + '/data?id=' + datasets[0].id
					+ '&time.min=' + startnew
					+ '&time.max=' + stopnew;

		request({
					"url": url,
					"gzip": true,
					"timeout": timeout(useTimeout),
					"headers": {"Origin": ip.address()},
					"time": true
				},
			function (err,res,body) {

				// TODO: Code below is very similar to that in dataAll1()
				if (err) {
					if (useTimeout === "datapreviousfail") {
						report(url,is.RequestError(err,res,useTimeout,timeout()),{"warn":true,"stop":true});
						// Start checking individual parameters. Skip test
						// using different time format (dataAll2()) and request
						// with header (dataAll_Header()).
						datar(formats,datasets,header,start,stop,"",dataTimeout,null,0);
					} else {
						report(url,is.RequestError(err,res,useTimeout,timeout()),{"warn":true});
						// Try again
						dataAll2(formats,datasets,header,start,stop,dataTimeout,bodyAll);
					}
					return;
				}

				report(url,is.RequestError(err,res,useTimeout,timeout()));
				if (!report(url,is.HTTP200(res),{"stop":true})) {
					dataAll_Header(formats,datasets,header,start,stop,dataTimeout,bodyAll);
					return;
				}
				if (!report(url,is.FileOK(body,"empty",res.statusMessage),{"stop":true})) {
					dataAll_Header(formats,datasets,header,start,stop,dataTimeout,bodyAll);					
					return;
				}
				if (!body || body.length === 0) {
					dataAll_Header(formats,datasets,header,start,stop,dataTimeout,bodyAll);
					return;					
				}
				// End similar code.

				report(url,is.FileDataOK(header,body,bodyAll,null,"contentsame"));
				dataAll_Header(formats,datasets,header,start,stop,dataTimeout,bodyAll);
			});		

		function md2doy(timestr) {
			// Converts from YYYY-MM-DD to YYYY-DOY or vice-versa
			// TODO: Function name is confusing.

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

	function dataAll_Header(formats,datasets,header,start,stop,dataTimeout,bodyAll) {

		// Same as dataAll1() but request with header.

		if (CLOSED) {return;}

		if (typeof(dataAll2.tries) === "undefined") {
			dataAll_Header.tries = 0
			var useTimeout = dataTimeout;
		} else {
			dataAll_Header.tries += 1;
			var useTimeout = "datapreviousfail";			
		};

		var url = ROOT + '/data?id=' + datasets[0].id 
					+ '&time.min=' + start 
					+ '&time.max=' + stop
					+ "&include=header";
		report(url);
		request(
			{
				"url": url,
				"gzip": true,
				"timeout": timeout(useTimeout),
				"headers": {"Origin": ip.address()},
				"time": true
			},
			function (err,res,body) {

				// TODO: Code below is very similar to that in dataAll1()
				if (err) {
					if (useTimeout === "datapreviousfail") {
						report(url,is.RequestError(err,res,useTimeout,timeout()),{"warn":true,"stop":true});
						// Start next test
						dataAll_1201(formats,datasets,header,start,stop,"",dataTimeout,bodyAll);
					} else {
						report(url,is.RequestError(err,res,useTimeout,timeout()),{"warn":true});
						// Try again
						dataAll_Header(formats,datasets,header,start,stop,dataTimeout,bodyAll);
					}
					return;
				}

				report(url,is.RequestError(err,res,useTimeout,timeout()));
				if (!report(url,is.HTTP200(res),{"stop":true})) {
					dataAll_1201(formats,datasets,header,start,stop,"",dataTimeout,bodyAll);
					return;
				}
				if (!report(url,is.FileOK(body,"empty",res.statusMessage),{"stop":true})) {
					dataAll_1201(formats,datasets,header,start,stop,"",dataTimeout,bodyAll);
					return;
				}
				if (!body || body.length === 0) {
					dataAll_1201(formats,datasets,header,start,stop,"",dataTimeout,bodyAll);
					return;					
				}
				// End similar code.

				var bodyLines = body.split(/\r?\n/);
				var headerLines = "";
				var dataLines = "";

				// Extract header lines.
				for (var i = 0; i < bodyLines.length; i++) {
					if (bodyLines[i][0] === "#") {
						headerLines = headerLines + bodyLines[i].slice(1);
					} else {
						break;
					}
				}

				// TODO: Need to make ignore differences in newline string \r\n should
				// be considered same as \n.
				// CSV response checks are for response without header.
				// Use the HAPI version found in this check and pass through
				// to CSV response check functions.
				var version = "";
				var dataLines = bodyLines.slice(i).join("\n");
				if (report(url,is.JSONparsable(headerLines),{"abort":false})) {
					var bodyJSON = JSON.parse(headerLines);
					report(url,is.FormatInHeader(bodyJSON, "data"));
					report(url,is.HeaderSame(header, bodyJSON), {'warn': true});
					var version = bodyJSON.HAPI;
					report(url,is.FileDataOK(header,bodyAll,dataLines,null,"contentsame"));
				}
				dataAll_1201(formats,datasets,header,start,stop,version,dataTimeout,bodyAll);
		})
	}

	function dataAll_1201(formats,datasets,header,start,stop,version,dataTimeout,bodyAll) {

		// Attempt to create a HAPI 1201 response (no data in interval) by setting
		// start time to be 1 ms after reported dataset start and stop time to be
		// 2 ms after reported start.

		if (CLOSED) {return;}

		if (typeof(dataAll_1201.tries) === "undefined") {
			dataAll_1201.tries = 0
			var useTimeout = dataTimeout;
		} else {
			dataAll_1201.tries += 1;
			var useTimeout = "datapreviousfail";			
		};

		var stop2 = start;
		var start2 = start;

		// moment.js assumes local time if no trailing Z. Add trailing
		// Z if it is not given. The trailingZfix function addresses
		// case where stop2 is a date only, in which case moment.js
		// does not accept a date only with a trailing Z and it is removed.
		if (!start2.match(/Z$/)) {
			start2 = start2 + "Z";
		}
		if (!stop2.match(/Z$/)) {
			stop2 = stop2 + "Z";
		}
		var start2 = moment(is.trailingZfix(start2)).add(1,'ms').toISOString();
		var stop2 = moment(is.trailingZfix(stop2)).add(2,'ms').toISOString();
		if (!start.match(/Z$/)) {
			// If start did not have trailing Z, remove it from new start.
			start2 = start2.slice(0,-1);
		}
		if (!stop.match(/Z$/)) {
			// If stop did not have trailing Z, remove it from new stop.
			stop2 = stop2.slice(0,-1);
		}

		var url = ROOT + '/data?id='+ datasets[0].id 
					+ '&time.min=' + start2 
					+ '&time.max=' + stop2;

		version = versioncheck(url,version,VERSION);
		report(url);
		request(
			{
				"url": url,
				"gzip": true,
				"timeout": timeout(useTimeout),
				"headers": {"Origin": ip.address()},
				"time": true
			},
			function (err,res,body) {

				// TODO: Code below is very similar to that in dataAll1()
				if (err) {
					if (useTimeout === "datapreviousfail") {
						report(url,is.RequestError(err,res,useTimeout,timeout()),{"warn":true,"stop":true});
						// Start next check
						datar(formats,datasets,header,start,stop,version,dataTimeout,bodyAll,0);
					} else {
						report(url,is.RequestError(err,res,useTimeout,timeout()),{"warn":true});
						// Try again
						dataAll_1201(formats,datasets,header,start,stop,version,dataTimeout,bodyAll);
					}
					return;
				}

				report(url,is.RequestError(err,res,useTimeout,timeout()));
				if (!report(url,is.HTTP200(res),{"stop":true})) {
					datar(formats,datasets,header,start,stop,version,dataTimeout,bodyAll,0);
					return;
				}
				// End similar code.

				report(url,is.FileOK(body,"empty",res.statusMessage,true),{"warn": true});
				datar(formats,datasets,header,start,stop,version,dataTimeout,bodyAll,0);
		})		
	}

	function datar(formats,datasets,header,start,stop,version,dataTimeout,bodyAll,pn) {

		// Reduced data request. Request one parameter at a time.

		if (CLOSED) {return;}

		if (pn == -1 || pn == header.parameters.length) {
			// -1 is case when one parameter given (!PARAMETER is true)
			datasets.shift(); // Remove first element
			info(formats,datasets); // Start next dataset
			return; // All parameters for dataset have been checked.
		}

		// TODO:
		// This is contorted logic to check only one parameter. Need
		// to rewrite. Also allow PARAMETER to be list of parameters.
		var i = NaN;
		if (PARAMETER) {
			for (var i=0;i < header.parameters.length;i++) {
				if (header.parameters[i].name === PARAMETER) {
					pn = i;
					break;
				}
			}	
		}

		var parameter = header.parameters[pn].name;

		if (!parameter) {
			report(url,
						{
							"description": "Parameter #" + pn + " does not have a name.",
							"error": true,
							"got": "No name."
						},
						{"stop":true}
					);
			// Check next parameter
			datar(formats,datasets,header,start,stop,version,dataTimeout,bodyAll,++pn);
			return;
		}

		if (!start || !stop) {
			report(url,
						{
							"description": "Need at least startDate and stopDate or sampleStartDate and sampleStopDate to continue.",
							"error":true,
							"got":"To abort"
						},
						{"abort":true}
					);
		}

		var url = ROOT + '/data?id=' + datasets[0].id
					+ '&parameters=' + parameter
					+ '&time.min=' + start
					+ '&time.max=' + stop;

		if (!version && !VERSION) {
			version = is.versions().pop();
		}
		report(url);
		request(
			{
					"url": url,
					"gzip": true,
					"timeout": timeout(dataTimeout),
					"headers": {"Origin": ip.address()},
					"time": true
			},
			function (err,res,body) {

				if (err) {
					if (dataTimeout === "datapreviousfail") {
						report(url,is.RequestError(err,res,dataTimeout,timeout()),{"warn":true,"stop":true});
						// Start on next parameter
						datar(formats,datasets,header,start,stop,version,"datapreviousfail",bodyAll,++pn);
					} else {
						report(url,is.RequestError(err,res,dataTimeout,timeout()),{"warn":true});
						// Try again
						datar(formats,datasets,header,start,stop,version,"datapreviousfail",bodyAll,++pn);
					}
					return;
				}

				if (RES) {
					var link = PLOTSERVER+"?usecache=false&usedatacache=false&server=" + url.replace("/data?","&");
					var note = "<a target='_blank' href='" + link + "'>Direct link for following plot.</a>. Please report any plotting issues on <a target='_blank' href='https://github.com/hapi-server/client-python/issues'>the Python hapiclient GitHub page</a>.";
					RES.write("&nbsp&nbsp;&nbsp&nbsp;<font style='color:black'>&#x261E</font>:&nbsp" + note + "<br><img src='" + link + "'/><br/>");
				}

				report(url,is.RequestError(err,res,dataTimeout,timeout()));
				if (!report(url,is.HTTP200(res),{"stop":true})) {
					// Check next parameter
					datar(formats,datasets,header,start,stop,version,dataTimeout,bodyAll,++pn); 
					return;
				}

				var lines = body.split("\n");

				report(url,is.FileOK(body,"emptyconsistent",bodyAll));

				if (!report(url,is.FileOK(body,"empty",res.statusMessage),{"stop":true})) {
					// Check next parameter
					datar(formats,datasets,header,start,stop,version,dataTimeout,bodyAll,++pn);
					return;
				}
				if (!body || body.length === 0) {
					// Check next parameter
					datar(formats,datasets,header,start,stop,version,dataTimeout,bodyAll,++pn);
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
				
				var warn = true;
				if (formats.includes('binary')) {
					// If wrong length and server can serve binary, then error.
					warn = false;
				}
				report(url,is.CorrectLength(time1,timeLength,"Time",!warn),{"warn":warn});

				report(url,is.HAPITime(lines,version));
				report(url,is.TimeIncreasing(lines,"CSV"));
				report(url,is.TimeInBounds(lines,start,stop));

				if (pn == 0) {
					// Time was requested parameter, no more columns to check
					report(url,is.SizeCorrect(line1.length-1,0,header.parameters[pn]),{"warn":false});
					// Check next parameter
					datar(formats,datasets,header,start,stop,version,dataTimeout,bodyAll,++pn);
					return;
				}

				var len  = header.parameters[pn]["length"];
				var type = header.parameters[pn]["type"];
				var name = header.parameters[pn]["name"];
				var size = header.parameters[pn]["size"];

				var nf = 1; // Number of fields (columns) counter
							// (start at 1 since time checked already)
				if (!size) {
					nf = nf + 1; // Width of field (number of columns of field)
				} else {
					nf = nf + prod(size);
				}

				// TODO: Check all lines?
				// Move this check into is.FileOK?
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

				// Note line.length - 1 = because split() adds extra empty
				// element at end if trailing newline.
				report(url,is.SizeCorrect(line1.length-1,nf-1,header.parameters[pn]),{"warn":true});
				
				if (bodyAll) {
					report(url,is.FileDataOK(header,body,bodyAll,pn,'Ncolumns'));
					report(url,is.FileDataOK(header,body,bodyAll,pn));
				}

				if (!PARAMETER) {
					// Check next parameter
					datar(formats,datasets,header,start,stop,version,dataTimeout,bodyAll,++pn);
				} else {
					// Case where one parameter given. See TODO above.
					datar(formats,datasets,header,start,stop,version,dataTimeout,bodyAll,-1);
				}
			})
	}

	function timeout(what,when) {

		var datapreviousfail = DATATIMEOUT || 5000;
		if (DATATIMEOUT) {
			datapreviousfail = 2*datapreviousfail;
		}
		var metapreviousfail = METATIMEOUT || 5000;
		if (METATIMEOUT) {
			metapreviousfail = 2*metapreviousfail;
		}

		var obj = {
			"datadefault":{"timeout": DATATIMEOUT || 10000,"when":"time.min/max not given to validator, sampleStart/Stop not given, and no cadence is in /info response and a default request is made for startDate to startDate + P1D."},
			"datapreviousfail":{"timeout": datapreviousfail,"when":"a previous request for data failed or timed out."},
			"datasample10xcadence":{"timeout": DATATIMEOUT || 1000,"when":"time.min/max not given to validator, sampleStart/Stop not given, but cadence is in /info response."},
			"datasamplesuggested":{"timeout": DATATIMEOUT || 1000,"when":"time.min/max not given to validator but sampleStart/Stop is given in /info response."},
			"datasamplechosen":{"timeout": DATATIMEOUT || 1000,"when":"time.min/max given to validator"},
			"metadefault":{"timeout": METATIMEOUT || 200,"when":"request is for metadata."},
			"metapreviousfail":{"timeout": metapreviousfail,"when":"a previous request for metadata failed or timed out."}
		};

		if (!what) {
			return obj;
		}
		if (!when) {
			return obj[what]["timeout"];
		} else {
			return obj[what]["when"];
		}
	}
}
exports.run = run;


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
