var Mocha = require('mocha');
var fs    = require('fs');
var path = require('path');

// Instantiate a Mocha instance.
var mocha = new Mocha();

var testDir = __dirname + '/tests';

process.env.ROOT = process.argv[2] || 'http://localhost:8999/hapi';

// Add each .js file in testDir mocha instance
fs
	.readdirSync(testDir)
	.filter(function(file){return file.substr(-3) === '.js';})
	.forEach(function(file){
		mocha.addFile(
			path.join(testDir, file)
		);
});

// Run the tests.
// See https://stackoverflow.com/questions/29050720/run-mocha-programatically-and-pass-results-to-variable-or-function
// for controlling output.
mocha
	.run(function(failures){
  		process.on('exit', function () {
    		process.exit(failures);  // exit with non-zero status if there were failures
  	})
});