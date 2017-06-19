# HAPI Server Verifier

Runs a suite of tests on a HAPI server. The tests involve a combination of [JSON schema](https://github.com/hapi-server/verifier-nodejs) validation and ad-hoc code.

A running instance and examples are available at http://tsds.org/verify-hapi

To run tests on the command line or to run a server, see the below.

# Installation

```
# Install Node Version Manager (NVM)
curl -O https://raw.githubusercontent.com/creationix/nvm/v0.33.2/install.sh | bash
# Install node.js 4
nvm install 4
# Install required Node packages
npm install
```

# Command-Line Usage

```
node test.js 
	--url URL 
	--id DATASETID 
	--parameter PARAMETERNAME 
	--timemin ISO8601 
	--timemax ISO8601
```

Only `URL` is required.   Default is to check all datasets and all parameters and use `timemin=sampleStartDate` and `timemax=sampleStopDate` if both given, otherwise `timemin=startDate` and `timemax=startDate+P1D` are used.

# Server Usage

```
node verify.js --port PORT
```

# TODO

1. Combine repeated JSON Schema information in [JSON schema files](https://github.com/hapi-server/verifier-nodejs/schemas).
2. Add to schema optional HAPI entities.
3. Add tests for HAPI Binary and JSON format (first/last lines of CSV only tested now).
4. Check response when no parameters or all parameters are given (`/info` and `/data` tests are for one parameter at a time).  This can catch some errors where the ordering in the response from `/info` is not consistent ordering of data in output file (only when at least one parameter has a different type than others). Will need to compare actual numbers when one parameter is requested and all to catch all ordering errors, however.
5. Send invalid query parameters and check error responses.

# Contact

Bob Weigel <rweigel@gmu.edu>