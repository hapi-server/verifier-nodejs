# HAPI Server Verifier

Runs a suite of tests on a HAPI server via a web interface or the command line. The tests involve a combination of [JSON schema](https://github.com/hapi-server/verifier-nodejs/tree/master/schemas) validation and ad-hoc code.

A running instance, documentation, and example output is available at

http://hapi-server.org/verify

and

http://hapi-server.org/verify-dev

# Local Installation

Installation is only required if the server to test is not available from a public IP address.

## Install Node Version Manager (NVM)

### Linux/Mac

1. ```curl https://raw.githubusercontent.com/creationix/nvm/v0.39.3/install.sh | bash```
2. Open a new shell and enter `nvm` to verify `nvm` was installed.

### Windows

1. Download and execute [`nvm-setup.exe`](https://github.com/coreybutler/nvm-windows/releases/download/1.2.2/nvm-setup.exe)
2. Open a new PowerShell window and enter `nvm` to verify `nvm` was installed.

# Install Node and Verifier

```
# Install NodeJS 16
nvm install 16 

# Clone repository
git clone --recurse-submodules https://github.com/hapi-server/verifier-nodejs.git

# Install required Node.js packages
cd verifier-nodejs; npm install

# Run unit test
node verify.js --test
```

## Command-Line Usage

```
node verify.js
  --url URL
  [--dataset DATASETID
  --parameter PARAMETERNAME
  --start HAPIDATETIME
  --stop HAPIDATETIME]
```

If `--url URL` is provided, output is sent to stdout and a web server is not started. See `verify.html` for documentation.

See `node verify.js --help` for additional options.

## Server Usage

```
node verify.js [--port PORT] [--plotserver URL]
```

If no arguments are provided, a web server is started on port `9999` and `plotserver=http://hapi-server.org/plot`.

See http://localhost:9999/ for API documentation.

## 🌏  Open in the Cloud 

Click any of the buttons below to start a new development environment to demo or contribute to the codebase without having to install anything on your machine:

[![Open in VS Code](https://img.shields.io/badge/Open%20in-VS%20Code-blue?logo=visualstudiocode)](https://vscode.dev/github/hapi-server/verifier-nodejs)
[![Open in Glitch](https://img.shields.io/badge/Open%20in-Glitch-blue?logo=glitch)](https://glitch.com/edit/#!/import/github/hapi-server/verifier-nodejs)
[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/hapi-server/verifier-nodejs)
[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/edit/verify-nodejs-dev?file=README.md&file=md!README.md)[![Edit in Codesandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/hapi-server/verifier-nodejs)
[![Open in Repl.it](https://replit.com/badge/github/withastro/astro)](https://replit.com/github/hapi-server/verifier-nodejs)
[![Open in Codeanywhere](https://codeanywhere.com/img/open-in-codeanywhere-btn.svg)](https://app.codeanywhere.com/#https://github.com/hapi-server/verifier-nodejs)
[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/hapi-server/verifier-nodejs)


# Schema Validation Only

To execute a schema validation on file or URL, use

```
node validate.js <file|URL> [--version HAPIVERSION]
```

If `version` is not given, the value in the JSON is used.

**Examples**

```
node validate.js test/json/capabilities.json
node validate.js http://hapi-server.org/servers/TestData2.0/hapi/capabilities
```

# Contact

Submit questions, bug reports, and feature requests to the [issue tracker](https://github.com/hapi-server/verifier-nodejs/issues).
