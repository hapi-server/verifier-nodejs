# HAPI Server Verifier

Runs a suite of tests on a HAPI server via a web interface or the command line. The tests involve a combination of [JSON schema](https://github.com/hapi-server/verifier-nodejs/tree/master/schemas) validation and ad-hoc code.

A running instance, documentation, and example output is available at http://hapi-server.org/verify

To run tests from the command line or to run a local server, see below.

# Installation

Installation is only required if you do not want to test a server using http://hapi-server.org/verify

```
# Install Node Version Manager (NVM)
curl https://raw.githubusercontent.com/creationix/nvm/v0.33.2/install.sh | bash
# Install node.js 6
nvm install 6
# Clone repository
git clone https://github.com/hapi-server/verifier-nodejs.git
# Install required Node packages
cd verifier-nodejs; npm install
```

# Command-Line Usage

```
node verify.js 
	--url URL 
	[--id DATASETID 
	--parameter PARAMETERNAME 
	--timemin HAPITIME 
	--timemax HAPITIME]
```

If `--url URL` is provided, then output goes to stdout and a web server is not started. See `verify.html` for documentation.

# Server Usage

```
node verify.js [--port PORT]
```

If no arguments are provided, a web server is started on port `9999`. See http://localhost:9999/ for documentation.

# Contact

Bob Weigel <rweigel@gmu.edu>