const http = require('http');

function testGetEndpoint() {
  const options = {
    hostname: 'localhost',
    port: 9400,
    path: '/data-application/text/test123',
    method: 'GET',
    timeout: 5000
  };

  const req = http.request(options, (res) => {
    process.stdout.write('Status: ' + res.statusCode + '\n');
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      process.stdout.write('Response: ' + data + '\n');
    });
  });

  req.on('error', (err) => {
    process.stdout.write('Error: ' + err.message + '\n');
  });

  req.end();
}

testGetEndpoint();