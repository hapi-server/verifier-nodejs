# HAPI Server Verifier

Runs a suite of tests on a HAPI server via a web interface or the command line. The tests involve a combination of [JSON schema](https://github.com/hapi-server/verifier-nodejs/tree/master/schemas) validation and ad-hoc code.

A running instance, documentation, and example output is available at

http://hapi-server.org/verify

and

http://hapi-server.org/verify-dev

See below to run tests from the command line or a local server.

# Local Installation

Installation is only required if the server to test is not available from a public IP address.

```
# Install Node Version Manager (NVM)
curl https://raw.githubusercontent.com/creationix/nvm/v0.39.3/install.sh | bash
nvm install
# Clone repository
git clone https://github.com/hapi-server/verifier-nodejs.git
# Install required Node.js packages
cd verifier-nodejs; npm install
```

## Command-Line Usage

```
node verify.js
  --url URL
  [--id DATASETID
  --parameter PARAMETERNAME
  --timemin HAPITIME
  --timemax HAPITIME]
```

If `--url URL` is provided, output goes to stdout, and a web server is not started. See `verify.html` for documentation.

## Server Usage

```
node verify.js [--port PORT] [--plotserver URL]
```

If no arguments are provided, a web server is started on port `9999` and `plotserver=http://hapi-server.org/plot`.

See http://localhost:9999/ for API documentation.

# StackBlitz

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/edit/verify-nodejs-dev?file=README.md&file=md!README.md)

# Contact

Submit questions, bug reports, and feature requests to the [issue tracker](https://github.com/hapi-server/verifier-nodejs/issues).
