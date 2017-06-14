# HAPI Server Verifier

Runs a suite of API tests on a HAPI server.  Most of the tests are for things that are required for a basic HAPI client to work.

A running instance is available at http://tsds.org/verify-hapi

To run tests on the command line, see the installation notes.

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
node test.js --url URL --id DATASETID --time.min TIME --time.max TIME
```

Only `URL` is required.  Default `time.min=startDate` and `time.max=startDate+P1D`.  Default is to check all dataset ids.

# Server Usage

```
node test.js --port PORT
```

# TODO

1. Combine repeated JSON Schema information in [JSON schema files](https://github.com/hapi-server/verifier-nodejs)
2. Allow warnings for optional but "should" HAPI elements/functionality
3. Add schema for optional HAPI entities and write code for additional associated verifications can't be verified with a schema.
4. Add tests for HAPI Binary and JSON (first/last lines of CSV only tested now)
5. If `sampleStartDate` and `sampleStartDate` are given in `/info` response, use them instead of `time.min=startDate` and `time.max=startDate+1D`.
6. Check for monotonic Time
7. Check for correct errors for `time.max` and `time.min`
8. Check for correct errors for invalid parameters
9. Check response when no parameters or all parameters are given
