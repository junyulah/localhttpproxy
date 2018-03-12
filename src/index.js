const http = require('http');
const url = require('url');
const logHttp = require('./logHttp');
const uuidv4 = require('uuid/v4');
const log = console.log; // eslint-disable-line

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

const watchers = {};

const server = http.createServer((req, res) => {
    if (req.headers.host !== '127.0.0.1:3130') {
        logHttp(req, watchers);
        forward(req, res);
    } else { // handler for current server request
        if (req.url === '/live') {
            res.end('I am alive');
        } else if (req.url === '/shutdown') {
            res.end('about to shutdown');
            process.exit(0);
        } else if (req.url === '/log') {
            const id = uuidv4();
            watchers[id] = {
                res,
                req
            };
            res.on('close', () => {
                delete watchers[id];
            });
        } else {
            res.end('no command for this');
        }
    }
});

server.listen(3130, '127.0.0.1', () => {
    log(`server start at ${server.address().port}`);
});
