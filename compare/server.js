const http = require("http");
const url = require('url');
const fs = require('fs');

const host = 'localhost';
const port = 8000;

const testAndExit = process.argv[2];

const requestListener = function (req, res) {
    console.log("Request: " + req.url)
    if (req.url === "/") {
      res.writeHead(200, {'Content-Type': 'text/html; charset=UTF-8'});
      res.write(fs.readFileSync('compare.html'));
    }

    var queryData = url.parse(req.url, true).query;
    var commandLineArray = Object.keys(queryData).map(
      key => `--${key} '${queryData[key]}'`);
    res.writeHead(200, {'Content-Type': 'text/plain; charset=UTF-8'});
    spawn(res, commandLineArray);
};

const server = http.createServer(requestListener);
server.listen(port, host, () => {
  console.log(`Server is running on http://${host}:${port}`);
  if (testAndExit) test();
});

function spawn(res, commandLineArray) {

  const {spawn} = require('node:child_process');
  const ls = spawn('node', ['compare.js', ...commandLineArray]);
  
  console.log("Executing node compare.js " + commandLineArray.join(" "));
  ls.stdout.on('data', (data) => {
    res.write(data);
    //console.log(`stdout: ${data}`);
  });
  
  ls.stderr.on('data', (data) => {
    res.write(data);
    //console.error(`stderr: ${data}`);
  });
  
  ls.on('close', (code) => {
    res.end();
    //console.log(`child process exited with code ${code}`);
  });
}

function test() {

  setTimeout(function() {
    let args = require('./cli.js').cli();
    //console.log(args);
    const querystring = require('querystring');
    let queryString = querystring.stringify(args);
    //console.log(queryString)
    get(`http://localhost:${port}/?${queryString}`, (data) => {
      console.log(data);
      process.exit();
    });
  }, 100);

  function get(url, cb) {
    http.get(url, (resp) => {
      let data = '';

      // A chunk of data has been received.
      resp.on('data', (chunk) => {
        data += chunk;
      });

      // The whole response has been received. Print out the result.
      resp.on('end', () => {
        cb(data);
      });

    }).on("error", (err) => {
      console.log("Error: " + err.message);
    });
  }
}