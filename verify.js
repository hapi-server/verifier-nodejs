checkNodeJSVersion()

const fs = require('fs')
const path = require('path')
const argv = require('yargs')
  .help()
  .default({
    port: 9999,
    url: '',
    id: '',
    dataset: '',
    parameter: '',
    timemax: '',
    start: '',
    timemin: '',
    stop: '',
    version: '',
    datatimeout: 0,
    metatimeout: 0,
    output: 'console',
    test: false,
    plotserver: 'https://hapi-server.org/plot'
  })
  .describe('port', 'If URL not given, starts verifier server on this port.')
  .describe('url', 'URL to test. No server is started.')
  .describe('dataset', 'Start with "^" to indicate a regular expression')
  .describe('parameter', '')
  .describe('start', '')
  .describe('stop', '')
  .describe('version', 'Validate against a HAPI version. Defaults to what given in JSON responses.')
  .describe('datatimeout', '')
  .describe('metatimeout', '')
  .describe('output', '')
  .describe('test', 'Run a unit test and exit. All other arguments ignored.')
  .boolean('test')
  .describe('plotserver', '')
  .deprecateOption('id', 'use --dataset')
  .deprecateOption('timemin', 'use --start')
  .deprecateOption('timemax', 'use --stop')
  .choices('output', ['console', 'json'])
  .argv

const tests = require('./tests.js') // Test runner

function fixurl (q) {
  // Allow typical copy/paste error
  //   ?url=http://server/hapi/info?{id,dataset}=abc
  // and treat as equivalent to
  //   ?url=http://server/hapi&{id,dataset}=abc
  // for web interface and similar for command line.

  if (/\?id=/.test(q.url)) {
    q.id = q.url.split('?id=')[1]
    q.url = q.url
      .split('?id=')[0]
      .replace(/\/info$|\/data$|\/catalog$/, '')
  }
  if (/\?dataset=/.test(q.url)) {
    q.id = q.url.split('?datset=')[1]
    q.url = q.url
      .split('?dataset=')[0]
      .replace(/\/info$|\/data$|\/catalog$/, '')
  }
  q.url = q.url.replace(/\/$/, '')
}

if (argv.url !== '' || argv.test === true) {
  // Command-line mode

  if (argv.test) {
    argv.url = 'https://hapi-server.org/servers/TestData2.0/hapi'
    argv.id = 'dataset1'
  }

  fixurl(argv)
  tests.run(argv)
} else {
  // Server mode
  const express = require('express')
  const app = express()

  app.get('/', function (req, res, next) {
    const addr = req.headers['x-forwarded-for'] || req.connection.remoteAddress
    console.log(new Date().toISOString() +
              ' [verifier] Request from ' + addr + ': ' + req.originalUrl)

    if (!req.query.url) {
      // Send HTML page if no URL given in query string
      res.contentType('text/html')
      fs.readFile(path.join(__dirname, 'verify.html'),
        (err, html) => {
          if (err) {
            res.status(404).send('verify.html not found.')
          }
          res.end(html)
        })
      return
    }

    console.log(req.query.url)
    const allowed = ['url', 'id', 'dataset', 'parameter', 'parameters',
      'time.min', 'start', 'time.max', 'stop', 'version',
      'datatimeout', 'metatimeout', 'output']
    for (const key in req.query) {
      if (!allowed.includes(key)) {
        res.end(`Allowed parameters are ${allowed.join(',')} (not ${key}).`)
        return
      }
    }

    const url = req.query.url
    // Because this service echos links in the response, it is used to post
    // links such as verify?url=some_non_hapi_content and this links show up
    // in a Google search.
    if (!url.endsWith('hapi/') && !url.endsWith('hapi')) {
      res.status(404).end("URL must end with 'hapi/' or 'hapi'")
      return
    }
    fixurl(req.query)
    tests.run(req.query, req, res)
  })

  app.use(errorHandler)
  app.listen(argv.port)
  console.log(new Date().toISOString() +
              ' [verifier] HAPI verifier listening on port ' +
              argv.port + '. See http://localhost:' + argv.port + '/')
  console.log(new Date().toISOString() +
              ' [verifier] Using plotserver ' + argv.plotserver)
}

// Uncaught errors in API request code.
function errorHandler (err, req, res, next) {
  console.error(err.stack)
  res.end('<div style="border: 2px solid black; color: red; font-weight: bold; ">' +
        ' Problem with verification server (Uncaught Exception).' +
        ' Aborting. Please report last URL shown above in report to the' +
        ' <a href="https://github.com/hapi-server/verifier-nodejs/issues">' +
        '   issue tracker' +
        ' </a>.' +
        '</div>')
}

process.on('uncaughtException', function (err) {
  const clc = require('chalk')
  if (err.errno === 'EADDRINUSE') {
    console.log(clc.red('Port ' + argv.port + ' is already in use.'))
  } else {
    console.log(err.stack)
  }
})

function checkNodeJSVersion () {
  const minVersion = 12
  const clc = require('chalk')
  const nodever = parseInt(process.version.slice(1).split('.')[0])
  if (parseInt(nodever) < minVersion) {
    const msg = `Error: Node.js version >=${minVersion} required. ` +
            `node.js -v returns ${process.version}.\n` +
            'Consider installing https://github.com/creationix/nvm' +
            ` and then 'nvm install ${minVersion}'.\n`
    console.log(clc.red(msg))
    process.exit(1)
  }
}
