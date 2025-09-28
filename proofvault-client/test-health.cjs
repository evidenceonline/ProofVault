const http = require('http');

function testHealthEndpoint() {
  const options = {
    hostname: 'localhost',
    port: 9400,
    path: '/node/health',
    method: 'GET',
    timeout: 5000
  };

  const req = http.request(options, (res) => {
    process.stdout.write('Health Status: ' + res.statusCode + '\n');
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      process.stdout.write('Health Response: ' + data + '\n');
    });
  });

  req.on('error', (err) => {
    process.stdout.write('Health Error: ' + err.message + '\n');
  });

  req.end();
}

testHealthEndpoint();