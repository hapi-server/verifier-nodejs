var fs   = require('fs');
var clc  = require('cli-color');
var argv = require('yargs')
				.default({
					"port": false,
					"id": "",
					"parameter": "",
					"timemax": "",
					"timemin": "",
					"url": "http://mag.gmu.edu/hapi"
				})
				.argv

var tests = require('./tests.js'); // Test runner

if (argv.port == false) {
	// Command-line mode
	tests.run(argv.url,argv.id,argv.parameter,argv["timemin"],argv["timemax"]);
} else {
	// Server mode
	var express = require('express');
	var app     = express();
	var server  = require("http").createServer(app);

	// Not working.
	app.use(function(err, req, res, next) {
  		res.end('Application error.');
	});

	app.get('/verify-hapi', function (req, res, next) {

		var addr = req.headers['x-forwarded-for'] || req.connection.remoteAddress
		console.log(new Date().toISOString() + " Request from " + addr + ": " + req.originalUrl)
		
		var url = req.query.url
		if (!url) { // Send html page if no url given in query string
			res.contentType("text/html");
			fs.readFile(__dirname + "/verify.html",function (err,html) {res.end(html);});
			return;
		}

		// TODO: Test that these make sense and check for unknown query parameters.
		var start = req.query["time.min"] || ""
		var stop  = req.query["time.max"] || ""
		var id    = req.query["id"] || ""
		var param = req.query["parameter"] || ""
		if (param) {
			if (param.split(",").length > 1) {
				res.end("Only one parameter may be specified.");
			}
		}
		tests.run(url,id,param,start,stop,res);

	})
	app.listen(argv.port)
	console.log("Listening on port " + argv.port + ". See http://localhost:" + argv.port + "/")
}

process.on('uncaughtException', function(err) {
	if (err.errno === 'EADDRINUSE') {
		console.log(clc.red("Port " + argv.port + " already in use."));
	} else {
		console.log(err.stack);
	}
})