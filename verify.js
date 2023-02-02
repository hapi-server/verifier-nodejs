var fs   = require('fs');
var clc  = require('chalk');
var argv = require('yargs')
						.default({
							"port": 9999,
							"url": "",
							"id": "",
							"parameter": "",
							"timemax": "",
							"timemin": "",
							"version": "",
							"plotserver":"http://hapi-server.org/plot"
						})
						.argv

var tests = require('./tests.js'); // Test runner
var versions = require('./is.js').versions;

const nodever  = parseInt(process.version.slice(1).split('.')[0]);

if (parseInt(nodever) < 8) {
	// TODO: On windows, min version is 8
	console.log(clc.red("!!! node.js version >= 8 required.!!! "
		+ "node.js -v returns " + process.version
		+ ".\nConsider installing https://github.com/creationix/nvm and then 'nvm install 8'.\n"));
	process.exit(1);
}

function fixurl(url, q) {

	// Allow typical copy/paste error
	//   ?url=http://server/hapi/info?id=abc
	// and treat as equivalent to 
	//   ?url=http://server/hapi&id=abc
	// for web interface and similar for command line.

	if (/\?id=/.test(q['url'])) {
		q['id'] = q['url'].split("?id=")[1];
		q['url'] = q['url']
									.split("?id=")[0]
									.replace(/\/info$|\/data$|\/catalog$/,"")
									.replace(/\/$/,"")
	}

}

if (argv.url !== "") {
	// Command-line mode

	fixurl(argv.url, argv);

	argv.parameter = argv.parameter || argv.parameters || "";
	
	if (argv.version !== "" && !versions().includes(argv.version)) {
		console.log("Version must be one of ",versions());
	}

	tests.run(argv.url,argv.id,argv.parameter,argv["timemin"],argv["timemax"],argv["version"],argv.plotserver);
} else {
	// Server mode
	var express = require('express');
	var app     = express();
	var server  = require("http").createServer(app);

	// Not working.
	app.use(function(err, req, res, next) {
			res.end('Application error.');
	});

	app.get('/favicon.ico', function (req, res, next) {
		res.setHeader('Content-Type', 'image/x-icon');
		fs.readFile(__dirname + "/favicon.ico",function (err,data) {res.end(data);});
	});

	app.get('/', function (req, res, next) {

		var addr = req.headers['x-forwarded-for'] || req.connection.remoteAddress
		console.log(new Date().toISOString() + " [verifier] Request from " + addr + ": " + req.originalUrl)
		
		if (!req.query.url) { // Send html page if no url given in query string
			res.contentType("text/html");
			fs.readFile(__dirname + "/verify.html",function (err,html) {res.end(html);});
			return;
		}

		var allowed = ["url","id","dataset","parameter","parameters","time.min","start","time.max","stop","version","datatimeout","metatimeout"];
		for (var key in req.query) {
			if (!allowed.includes(key)) {
				res.end("Only allowed parameters are " + allowed.join(",") + " (not "+key+").");
				return;
			}
		}

		fixurl(req.query.url, req.query);

		var url   = req.query["url"]       || ""
		var id    = req.query["id"]        || req.query["dataset"] || ""
		var param = req.query["parameter"] || req.query["parameters"] || ""
		var start = req.query["time.min"]  || req.query["start"] || ""
		var stop  = req.query["time.max"]  || req.query["start"] || ""
		var datatimeout = parseInt(req.query["datatimeout"]) || ""
		var metatimeout = parseInt(req.query["metatimeout"]) || ""

		var version = req.query["version"] || argv.version;
		if (version && !versions().includes(version)) {
			res.status(400).end("version must be one of " + JSON.stringify(versions()));
		}

		if (param) {
			if (param.split(",").length > 1) {
				res.end("Only one parameter may be specified.");
			}
		}
		tests.run(url,id,param,start,stop,version,datatimeout,metatimeout,req,res,argv.plotserver);

	})

	app.listen(argv.port);
	console.log(new Date().toISOString() + " [verifier] HAPI verifier listening on port " + argv.port + ". See http://localhost:" + argv.port + "/");
	console.log(new Date().toISOString() + " [verifier] Using plotserver " + argv.plotserver);
}

process.on('uncaughtException', function(err) {
	if (err.errno === 'EADDRINUSE') {
		console.log(clc.red("Port " + argv.port + " already in use."));
	} else {
		console.log(err.stack);
	}
})
