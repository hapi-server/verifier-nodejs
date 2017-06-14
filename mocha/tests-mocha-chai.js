var fs       = require('fs');
var should   = require('chai').should();
var expect   = require('chai').expect;
var assert   = require('chai').assert;
var validate = require('jsonschema').validate;
var moment   = require('moment');

var chaiHttp   = require('chai-http');
var chaiString = require('chai-string');
var chai = require('chai').use(chaiHttp).use(chaiString);

var ROOT = process.env.ROOT || 'http://localhost:8999/hapi';
// How long to wait for data request.
var DATATIMEOUT = 10*1000;
// How long to wait for non-data request.
var METATIMEOUT = 2000;

var TESTS = {};

// Set SYNC to true to run /info tests for each dataset id sequentually
// Set to false for load testing
// Note that tests for /, /capabilities, /catalog are set to run async only
var SYNC = true; // Only applies to /info requests

console.log("Testing " + process.env.ROOT);

// Helper function to compute product of array elements.
function prod(arr) {return arr.reduce(function(a,b){return a*b;})}
function isJSON(text){
    try {
        JSON.parse(text);
        return true;
    }
    catch (error){
        return false;
    }
}
////////////////////////////////////////////////////////////////////////
// TODO: Move this to separate file.
// Add isInteger test.
chai.use(function (_chai, utils) {
  var Assertion = _chai.Assertion;

	function assertInteger(options) {
		var obj = this._obj;

		this.assert(
		Number.isInteger(obj)
		, 'expected #{this} to be an integer'
		, 'expected #{this} to not be an integer'
		, obj
		, obj
		, false
		);
  }
  Assertion.addMethod('integer', assertInteger);
});

// TODO: Move this to separate file.
// Modify error message
// Based on jackfranklin https://github.com/mochajs/mocha/issues/545
// Keeps only line number of this file.
console.oldError = console.log;
console.log = function (args) {
	if (typeof arguments.stack !== 'undefined') {
		console.oldError.call(console, arguments.stack);
	} else {
		if (typeof arguments[4] !== 'undefined') {
			var traceToShow = arguments[4].split('\n').slice(0, 1);
			if (arguments[3].match("Validation error")) {
				arguments[3] = arguments[3].replace(/: expected.*/,"");
				arguments[3] = arguments[3].replace("Uncaught AssertionError:","");
			}
			arguments[4] = traceToShow.join('\n');
		}
		console.oldError.apply(console, arguments);
	}
}
////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////
// Tests start here.
////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////
describe('Test ' + ROOT, function() {

	it('Gives 200 and text/html content type', function(done) {
		this.timeout(METATIMEOUT);
		this.slow(0); // Always show timing
		chai
			.request(ROOT)
			.get('/')
			.end(function(err, res) {
				if (err) return;
				res.should.have.status(200);
				res.should.have.header('content-type', /^text\/html/);
				done();
				capabilities();
			});
	})

});
////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////
function capabilities() {
	describe('Test ' + ROOT + '/capabilities', function() {

		var SCHEMA = "";
		before(function() {
			SCHEMA = fs.readFileSync(__dirname + "/capabilities.json");
			SCHEMA = JSON.parse(SCHEMA);
		});

		it('Meets spec', function(done) {
			this.timeout(METATIMEOUT);
			this.slow(0); // Always show timing
			chai
				.request(ROOT)
				.get('/capabilities')
				.end(function(err, res) {
					if (err) return;
					res.should.have.status(200);
					res.should.have.header('content-type', /^application\/json/);
					res.should.be.json;
					v = validate(res.body,SCHEMA).errors;
					var msg = ""
					if (v[0]) {
						msg = "Validation error (1st shown): " + v[0].stack
						expect(v,msg).to.be.an('array').that.is.empty;
					}
					res.body.outputFormats.indexOf("csv").should.be.above(-1);
					catalog();
					done();
				});
		});
	});
}
////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////
function catalog() {
	describe('Test /catalog', function() {

		var SCHEMA = "";
		before(function() {
			SCHEMA = fs.readFileSync(__dirname + "/catalog.json");
			SCHEMA = JSON.parse(SCHEMA);
		});

		it('Meets spec', function(done) {
			this.timeout(METATIMEOUT);
			this.slow(0); // Always show timing
			chai
				.request(ROOT)
				.get('/catalog')
				.end(function(err, res) {
					if (err) return;
					res.should.have.status(200);
					res.should.have.header('content-type', /^application\/json/);
					res.should.be.json;
					v = validate(res.body,SCHEMA).errors;
					var msg = "";
					if (v[0]) {
						msg = "Validation error (1st shown): " + v[0].stack
						expect(v[0],msg).to.be.empty;
					}
					infoall(res.body.catalog);	
					done();
				});
		});
	});
}
////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////
// Test /info
// Get all dataset IDs and make /info requests for each
// Then make request for /data for Time parameter
function infoall(datasets) {	
	if (SYNC) {
		info(datasets,data);
	} else {
		for (var ds=0;ds < datasets.length;ds++) {
			info(datasets[ds]["id"],data);
		}			
	}
}

function info(datasets,cb) {

	if (typeof(datasets) === "string") {
		// Async mode.
		var id = datasets;
	} else {
		if (datasets.length == 0) return;
		var id = datasets[0]["id"];
		datasets.shift(); // Remove first element	
	}

	var tname = 'Test ' + ROOT + '/info?id=' + id
	describe(tname, function(tname) {

		TESTS[tname] = [];
		var t = 0;

		var SCHEMA = "";
		before(function() {
			SCHEMA = fs.readFileSync(__dirname + "/info.json");
			SCHEMA = JSON.parse(SCHEMA);
		});

		it('Meets spec', function(done) {
			this.timeout(METATIMEOUT);
			this.slow(0); // Always show timing
			chai
				.request(ROOT)
				.get('/info' + "?id=" + id)
				.end(function(err, res) {
					if (err) return;
					TESTS[tname][t] = {"description":'Expect HTTP status = 200',"error":false,"message":"OK"}
					if (res.status != 200) {
						TESTS[tname][t]["error"] = true;
						TESTS[tname][t]["error"] = "Got " + res.status;
					}
					t++;
					res.should.have.status(200);

					TESTS[tname][t] = {"description":'Expect content-type /^application\/json/',"error":false,"message":"OK"}
					if (!/^application\/json/.test()) {
						TESTS[tname][t]["error"] = true;
						TESTS[tname][t]["message"] = "Got " + res.header["content-type"];						
					}
					t++;
					res.should.have.header('content-type', /^application\/json/);

					TESTS[tname][t] = {"description":'Expect JSON.parse(body) to not throw error',"error":false,"message":"OK"}
					if (!isJSON(res.body)) {
						TESTS[tname][t]["error"] = true;
						TESTS[tname][t]["message"] = "Got error.";
					}
					t++;
					res.should.be.json;
					
					verr = validate(res.body,SCHEMA).errors;
					TESTS[tname][t] = {"description":'Expect body to be schema valid',"error":false,"message":"OK"}
					if (!isJSON(res.body)) {
						TESTS[tname][t]["error"] = true;
						TESTS[tname][t]["message"] = verr.join("\n");
					}
					t++;	
					var msg = "";
					if (verr[0]) {
						msg = ROOT + "/info" + "?id=" + id + " Validation error (1st shown): " + v[0].stack
						expect(v[0],msg).to.be.empty;
					}

					var parameters = res.body.parameters;
					p1name = parameters[0]["name"]
					TESTS[tname][t] = {"description":'Expect first parameter in JSON to have name=Time',"error":false,"message":"OK"}
					if (!(p1name === "Time")) {
						TESTS[tname][t]["error"] = true;
						TESTS[tname][t]["message"] = "Got " + p1name;
					}
					t++;
					expect(p1name,"First parameter must have name=Time").to.equal("Time")

					for (var i = 0;i<parameters.length;i++) {
						msg = "parameter " + parameters[i].name + " must have a length";
						if (parameters[i].type === "string" || parameters[i].type === "isotime") {
							TESTS[tname][t] = {"description":'Expect parameters of type string and isotime have integer length specified',"error":false,"message":"OK"}
							if (!Number.isInteger(parameters[i]["length"])) {
								TESTS[tname][t]["error"] = true;
								TESTS[tname][t]["message"] = "Got " + parameters[i]["length"];
							}
							t++;
							expect(parameters[i]["length"],msg).to.be.an.integer();							
						} else {
							TESTS[tname][t] = {"description":'Expect parameters not of type string and isotime to not have length specified',"error":false,"message":"OK"}
							if (typeof(parameters[i]["length"]) !== 'undefined') {
								TESTS[tname][t]["error"] = true;
								TESTS[tname][t]["message"] = "Got " + parameters[i]["length"];
							}
							t++;
							expect(parameters[i]["length"],msg).to.equal(undefined);							
						}
					}

					if (typeof(datasets) !== "string") {
						// Sync mode.
						info(datasets);
					}
					cb(id,res.body,0); // cb() is data()
					done();
				});
		});
	});
}

function data(id, header, pn) {

	//if (pn == header.parameters.length-1) {
	if (pn == header.parameters.length-3) { // Skip spectra
		return; // All parameters have been checked.
	}
	var start = header["startDate"];
	var stop  = header["stopDate"];
	//stop = new Date(start).valueOf() + 86400*1000; // Add one day
	stop = new Date(start).valueOf() + 1000; // Add one second
	stop = new Date(stop).toISOString().slice(0,-1); // -1 to remove Z

	if (pn == 0) {
		var parameterlist = header.parameters[pn].name; // Check Time alone
	} else {
		var parameterlist = header.parameters[pn+1].name;
	}
	// TODO: Check if sampleStartDate and sampleStopDate is given. If yes, use them.
	url = '/data' + "?id=" + id + '&parameters=' + parameterlist + '&time.min=' + start + '&time.max=' + stop;

	var tname = 'Test ' + ROOT + url;
	describe(tname, function(tname) {
		TESTS[tname] = [];
		var t = 0;
		it('Meets spec', function(done) {
			this.timeout(DATATIMEOUT);
			this.slow(0); // Always show timing
			chai
				.request(ROOT)
				.get(url)
				.end(function(err, res) {
					if (err) return;

					TESTS[tname][t] = {"description":'Expect HTTP status = 200',"error":false,"message":"OK"}
					if (res.status != 200) {
						TESTS[tname][t]["error"] = true;
						TESTS[tname][t]["error"] = "Got " + res.status;
					}
					t++;
					res.should.have.status(200);

					TESTS[tname][t] = {"description":'Expect content-type /^application\/json/',"error":false,"message":"OK"}
					if (!/^application\/json/.test()) {
						TESTS[tname][t]["error"] = true;
						TESTS[tname][t]["message"] = "Got " + res.header["content-type"];						
					}
					t++;
					res.should.have.header('content-type', /^text\/csv/);

					TESTS[tname][t] = {"description":'Expect CSV response to have trailing newline',"error":false,"message":"OK"}
					if (res.text.slice(-1) !== "\n") {
						TESTS[tname][t]["error"] = true;
						TESTS[tname][t]["message"] = "Got " + res.body.slice(-1);;
					}
					t++;
					expect(res.text,"CSV should have trailing newline").to.endWith("\n");

					TESTS[tname][t] = {"description":'Expect CSV response to exactly one trailing newline',"error":false,"message":"OK"}
					if (res.text.slice(-2) !== "\n\n") {
						TESTS[tname][t]["error"] = true;
						TESTS[tname][t]["message"] = "Got " + res.text.slice(-1);;
					}
					t++;					
					expect(res.text,"CSV should have one traling newline").not.to.endWith("\n\n");

					lines = res.text.split("\n");
					line1 = lines[0].split(",");
					time1 = line1[0].trim();
					timeLength = header.parameters[0].length; // Time length
					msg = "(trimmed length of first column string in CSV) - (parameters.Time.length-1) should be zero. Found (" + (time1.length) + ") - (" + (timeLength-1) + ")"
					expect(time1.length - (timeLength - 1),msg).to.be.equal(0);

					msg = "First time value is not a valid ISO-8601:2004 string.";
					expect(moment(time1,moment.ISO_8601).isValid(),msg).to.be.true;

					var knownparams = [];
					for (var i = 0;i < header.parameters.length;i++) {
						knownparams[i] = header.parameters[i].name;
					}

					var pnames = parameterlist.split(",");
					var ptypes = [];
					nr = 1; // For time, must will be there even if not requested
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
							if (ptypes[i] == "isotime") {
								var test = moment(time1,moment.ISO_8601).isValid()
								console.log(line1[j] + " " + ptypes[i] + " " + test.toString())
							}
							if (ptypes[i] == "integer") {
								var test = parseInt(line1[j]) == parseFloat(line1[j])
								console.log(line1[j] + " " + ptypes[i] + " " + test.toString())
							}
							if (ptypes[i] == "double") {
								var test = /^-?\d*(\.\d+)?$/.test(line1[j].trim()) || line1[j].trim().toLowerCase() === "nan"
								console.log(line1[j] + " " + ptypes[i] + " " + test.toString())
							}
						}
						var nr = nr + w;
					}
					msg = "Number of columns in first line of CSV should be " + (nr) + " for this request."
					//console.log(msg)
					expect(line1.length,msg).to.be.equal(nr);											
					data(id,header,pn+1); // Check next parameter
					done();
				});
		});
	});
}
////////////////////////////////////////////////////////////////////////
