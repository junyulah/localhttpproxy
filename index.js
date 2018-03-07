const http = require('http');
const url = require('url');
const log = console.log; // eslint-disable-line

const server = http.createServer((req, res) => {
    log(req.url);
    forward(req, res);
});

const forward = (req, res) => {
    const urlObject = url.parse(req.url, false);
    const targetHost = urlObject.host || req.headers.host;

    const hostname = targetHost.split(':')[0].trim();
    const port = Number((targetHost.split(':')[1] || '').trim() || 80);

    const httpReq = http.request({
        host: hostname,
        port,
        method: req.method,
        path: urlObject.path,
        headers: req.headers
    }, (httpRes) => {
        res.statusCode = httpRes.statusCode;
        for (const name in httpRes.headers) {
            res.setHeader(name, httpRes.headers[name]);
        }

        httpRes.on('data', (chunk) => {
            res.write(chunk);
        });
        httpRes.on('end', () => {
            res.end();
        });
    });

    req.on('data', (chunk) => {
        httpReq.write(chunk);
    });

    req.on('end', () => {
        httpReq.end();
    });
};

server.listen(3130, '127.0.0.1', () => {
    log(`server start at ${server.address().port}`);
});
