const fs = require('fs')
const path = require('path')
const clc = require('chalk')

function report (r, url, obj, opts) {
  const reqOpts = r.opts
  const res = r.res

  // Returns !(obj.error && (stop || abort))
  // stop means processing can't continue on current URL
  // Abort means can't move to testing next URL.
  // Note that abort = true implies stop = true.
  if (obj === false) return false // Case where test was not appropriate.

  let warn = false
  let stop = false
  let abort = false
  let shush = false

  if (opts) {
    warn = opts.warn || false // Warn not fail message on error
    stop = opts.stop || false // Need to stop tests on current URL
    abort = opts.abort || false // Stop and send abort all processing
    shush = opts.shush || false // Don't print unless warning, error, or url changed
  }

  shush = false
  stop = stop || abort // Make stop true when abort true.

  let firstshush = false
  if (shush && report.shushon === false) {
    // Don't print pass results for long list of similar tests.
    firstshush = true
  }
  report.shushon = shush

  if (!url) {
    // Print summary when report() called.
    summary(r)
    return
  }

  if (!url || !r.stats) {
    // First call to report(). Initialize and attach arrays to report object.

    if (!r.stats) {
      r.stats = {}
    }
    r.stats = { fails: [], passes: [], warns: [] }

    if (reqOpts.output === 'html') {
      res.write("<html><meta charset='UTF-8'><body>")
    }

    if (reqOpts.version) {
      const msg = 'Using HAPI schema version ' + reqOpts.version
      if (reqOpts.output === 'html') {
        let url = 'https://github.com/hapi-server/verifier-nodejs'
        url = url + '/tree/master/schemas/HAPI-data-access-schema-'
        const linkopen = "<a href='" + url + reqOpts.version + ".json'>"
        res.write('Using ' + linkopen + msg + '</a><br>')
      } else if (reqOpts.output === 'console') {
        console.log(msg)
      }
    }
    if (reqOpts.output === 'html') {
      // TODO: Can we determine if request originated from hapi-server.org
      //       and suppress feedback if not?
      res.write('https://hapi-server.org/verify has low memory limits. If feedback stops, memory may be exhausted. In this case, use command line version or reduce time range of request. See https://github.com/hapi-server/verifier-nodejs/issues/61')
    }

    // Parse is.js to get line numbers for test functions.
    let istext = fs.readFileSync(path.join(__dirname, 'is.js')).toString()
    istext = istext.split('\n')
    report.lineobj = {}
    // Store locations in report.lineobj array.
    // TODO: This should happen on server start not here.
    for (let i = 0; i < istext.length; i++) {
      if (istext[i].match(/^function/)) {
        const key = istext[i].replace(/^function (.*)?\(.*/, '$1')
        report.lineobj[key] = i + 1
      }
    }
  }

  if (report.url !== url) {
    // Display URL only if not the same as last one seen or requested to
    // be displayed when report() was called.
    if (reqOpts.output !== 'json') { writeURL(url, res) }
  }

  report.url = url
  if (!obj) {
    // If report(url) was called, only print URL.
    return
  };

  obj.url = url
  if (obj.error === true && warn === false) {
    r.stats.fails.push(obj)
    if (reqOpts.output !== 'json') { writeResult(obj, 'error', res) }
  } else if (obj.error === true && warn === true) {
    r.stats.warns.push(obj)
    if (reqOpts.output !== 'json') { writeResult(obj, 'warn', res) }
  } else {
    r.stats.passes.push(obj)
    if (firstshush) {
      if (reqOpts.output !== 'json') { writeNote('Passes are being suppressed.', '', res) }
    }
    if (report.shushon === false) {
      if (reqOpts.output !== 'json') { writeResult(obj, 'pass', res) }
    }
  }

  if (obj.error && stop) {
    if (abort) {
      const msg = 'Cannot continue any validation tests due to last failure.'
      if (reqOpts.output === 'html') {
        res.end(`<br><font style='color:red'>${msg}</font></body></html>`)
      } else if (reqOpts.output === 'console') {
        console.log('\n' + clc.red(msg + ' Exiting with signal 1.'))
        process.exit(1)
      }
    } else {
      const msg = 'Cannot continue tests on URL due to last failure.'
      if (reqOpts.output === 'html') {
        res.write(`<br><font style='color:red'>${msg}</font><br>`)
      } else if (reqOpts.output === 'console') {
        console.log('\n' + clc.red(msg))
      }
    }
  }

  // If no error, return true.  If stopping error, return false
  return !(obj.error && stop)
}
exports.report = report

function writeURL (url, res) {
  if (!res) {
    console.log('\n' + clc.blue(url))
    return
  }

  res.write("<hr style='border-bottom: 0px; border-top: 1px solid black'>" +
            "<font style='color:blue'><a href='" + url + "'>" +
            url.replace(/\&parameters/, '&amp;parameters') +
            '</a></font></br>')
}
exports.writeURL = writeURL

function rmHTML (str) {
  if (typeof str !== 'string') {
    return str
  }
  return str.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/<code>/g, '').replace(/<\/code>/g, '')
    .replace(/<pre>/g, '').replace(/<\/pre>/g, '')
    .replace(/<span .*?>(.*)<\/span>/gi, '$1')
    .replace(/<a .*?>(.*)<\/a>/gi, '$1')
}

function writeNote (msg, style, res) {
  if (res) {
    res.write(msg + '<br>')
  } else {
    console.log(msg + 'Passes are being suppressed.')
  }
}

function writeResult (obj, status, res) {
  if (status === undefined) {
    status = obj.error === false ? 'pass' : 'error'
  }

  if (res === undefined) {
    let icon = clc.green.inverse('✓')
    if (status === 'warn') {
      icon = clc.yellowBright.inverse('⚠')
    }
    if (status === 'error') {
      icon = clc.inverse.red('✗')
    }

    let got = '' + rmHTML(obj.got) // "" to cast to string
    const desc = rmHTML(obj.description)
    let msg = '  ' + icon + ' ' + desc
    if (got !== '') {
      got = got.split('\n')
      got = got[0] + got.slice(1, got.length).join('\n       ')
      msg = msg + '\n  ' + clc.bold('Got: ') + got
    }
    console.log(msg)
    return
  }

  let icon = "<font style=''><b>✓</b></font>&nbsp;"
  if (status === 'warn') {
    icon = "<font style='background-color:yellow'><b>⚠</b></font>"
  }
  if (status === 'error') {
    icon = "<font style='background-color:red'><b>✗</b></font>"
  }

  // Get function name from description in obj and replace it
  // with a link to GitHub code.
  let desc = obj.description
  const key = desc.replace(/^is\.(.*?)\(.*/, '$1')
  const base = "<a href='https://github.com/hapi-server/verifier-nodejs/blob/master"
  desc = desc
    .replace(/^(is.*?):/, base + "/is.js#L__LINE__'>$1</a>: ")
    .replace(/__LINE__/, report.lineobj[key])
  const got = obj.got.toString().replace(/\n/g, '<br>')

  let line = `
              <table>
                <tr>
                  <th>${icon}</th>
                  <td>${desc}</td>
                </tr>
            `
  if (got !== '') {
    line += `
            <tr>
              <th></th>
              <td><b>Got</b>: ${got}</td>
            </tr>
            `
  }
  line += '</table>'

  res.write(line)
}
exports.writeResult = writeResult

function summary (r) {
  const res = r.res
  const reqOpts = r.opts
  const CATALOG = r.catalog
  const stats = r.stats

  if (reqOpts.output === 'html') {
    res.write('<p>End of validation tests. ' +
            'Summary: ' +
            "<font style='color:black;background:green'>Pass</font>: " +
            stats.passes.length + '; ' +
            "<font style='color:black;background:yellow'>Warns</font>: " +
            stats.warns.length + '; ' +
            "<font style='background:red;color:black'>Fails</font>: " +
            stats.fails.length + '. ')
    if (stats.warns.length + stats.fails.length > 0) {
      res.write('Warnings and failures repeated below.</p>')
    }
  }

  if (reqOpts.output === 'console') {
    let msg = '\nEnd of validation tests. ' +
              clc.green.inverse('Pass') +
              ': ' +
              stats.passes.length +
              '; ' +
              clc.yellowBright.inverse('Warn') +
              ': ' +
              stats.warns.length +
              '; ' +
              clc.inverse.red('Fail') +
              ': ' + stats.fails.length
    if (stats.warns.length + stats.fails.length > 0) {
      msg += '. Warnings and failures repeated below.'
    }
    console.log(msg + '\n')
  }

  if (reqOpts.output !== 'json') {
    for (let i = 0; i < stats.warns.length; i++) {
      writeURL(stats.warns[i].url, res)
      writeResult(stats.warns[i], 'warn', res)
    }
    for (let i = 0; i < stats.fails.length; i++) {
      writeURL(stats.fails[i].url, res)
      writeResult(stats.fails[i], 'error', res)
    }
  }

  if (reqOpts.output === 'html') {
    res.write('')
    res.write('<p><b>Use the following links for visual checks of data and stress testing server.</b></p>')
    for (let i = 0; i < CATALOG.catalog.length; i++) {
      const link = reqOpts.plotserver +
                  '?server=' +
                  reqOpts.url +
                  '&id=' +
                  CATALOG.catalog[i].id +
                  '&format=gallery'
      res.write("<a target='_blank' href='" + link + "'>" + link + '</a><br>')
    }
    res.end('</body></html>')
  } else if (reqOpts.output === 'console') {
    if (stats.fails.length === 0) {
      console.log('\nEnd of summary. Exiting with signal 0.')
      process.exit(0) // Normal exit.
    } else {
      console.log('\nEnd of summary. Exiting with signal 1 due to failure(s).')
      process.exit(1)
    }
  } else if (reqOpts.output === 'json') {
    const obj = {
      passes: stats.passes,
      warns: stats.warns,
      fails: stats.fails
    }
    if (res) {
      res.end(JSON.stringify(obj, null, 2))
    } else {
      console.log(JSON.stringify(obj, null, 2))
      if (stats.fails.length === 0) {
        process.exit(0) // Normal exit.
      } else {
        process.exit(1)
      }
    }
  }
}
