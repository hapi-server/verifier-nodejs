# HAPI Server Verifier

Runs a suite of tests on a HAPI server via a web interface or the command line. The tests involve a combination of [JSON schema](https://github.com/hapi-server/verifier-nodejs/tree/master/schemas) validation and ad-hoc code.

A running instance and example output is available at http://tsds.org/verify-hapi

To run tests from the command line or to run a server, see the below.

# Installation

Installation is only required if you do not want to test a server using http://tsds.org/verify-hapi

```
# Install Node Version Manager (NVM)
curl https://raw.githubusercontent.com/creationix/nvm/v0.33.2/install.sh | bash
# Install node.js 4
nvm install 4
# Clone repository
git clone https://github.com/hapi-server/verifier-nodejs.git
# Install required Node packages
cd verifier-nodejs; npm install
```

# Command-Line Usage

```
node verify.js 
	--url URL 
	--id DATASETID 
	--parameter PARAMETERNAME 
	--timemin ISO8601 
	--timemax ISO8601
```

If no arguments are provided, a web server is started on port 9999, which can be accessed at "http://localhost:9999/".  If `URL` is provided, then output goes to stdout.

Default is to check all datasets and all parameters and use `timemin=sampleStartDate` and `timemax=sampleStopDate` if both given, otherwise `timemin=startDate` and `timemax=startDate+P1D` are used.

# Server Usage

```
node verify.js
```
The default port is 9999.

# TODO

1. Add tests for HAPI Binary and JSON format (only first set of lines of CSV are tested).
2. Check response when no parameters or all parameters are given (`/info` and `/data` tests are for one parameter at a time).  This can catch some errors where the ordering in the response from `/info` is not consistent ordering of data in output file (only when at least one parameter has a different type than others). Will need to compare actual numbers when one parameter is requested and all to catch all ordering errors, however.
3. Try data request with different but equivalent representations of time and verify that response does not change.

# Contact

Bob Weigel <rweigel@gmu.edu>
