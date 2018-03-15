const http = require('http');
const url = require('url');
const uuidv4 = require('uuid/v4');
const {
    getConfig
} = require('./config');

const getForwardOption = (req) => {
    const urlObject = url.parse(req.url, false);
    const targetHost = urlObject.host || req.headers.host;
    const hostname = targetHost.split(':')[0].trim();
    const port = Number((targetHost.split(':')[1] || '').trim() || 80);
    return {
        host: hostname,
        port,
        method: req.method,
        path: urlObject.path,
        headers: Object.assign({}, req.headers)
    };
};

const proxyHost = (req, targetHost) => {
    const urlObject = url.parse(req.url, false);
    const hostname = targetHost.split(':')[0].trim();
    const port = Number((targetHost.split(':')[1] || '').trim() || 80);

    return {
        host: hostname,
        port,
        method: req.method,
        path: urlObject.path,
        headers: Object.assign({}, req.headers, {
            referer: urlObject.protocol + '//' + targetHost + '/',
            host: targetHost
        })
    };
};

const pipeRequest = (reqOptions, req, res) => {
    const httpReq = http.request(reqOptions, (httpRes) => {
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

const logInHttp = (req) => {
    console.log(req.url); // eslint-disable-line

    for (const id in watchers) {
        const watcher = watchers[id];
        watcher.res.write(req.url + '\n');
    }
};

getConfig().then((config) => {
    const server = http.createServer((req, res) => {
        const urlObject = url.parse(req.url, false);

        if (req.headers.host !== '127.0.0.1:3130') {
            logInHttp(req, req.url);
            const hostRule = config.proxy && config.proxy.host && config.proxy.host[req.headers.host];
            // check host
            if (hostRule) {
                if (!hostRule.pathReg || new RegExp(hostRule.pathReg).test(urlObject.path)) {
                    logInHttp(req, `[proxy host]: ${req.headers.host} => ${hostRule.targetHost}`);
                    return pipeRequest(proxyHost(req, hostRule.targetHost), req, res);
                }
            }

            logInHttp(req, `[forward] to ${req.headers.host}`);
            // forward
            return pipeRequest(getForwardOption(req), req, res);
        } else { // handler for current server request
            if (req.url === '/live') {
                return res.end('I am alive');
            } else if (req.url === '/shutdown') {
                res.end('about to shutdown');
                return process.exit(0);
            } else if (req.url === '/log') {
                const id = uuidv4();
                watchers[id] = {
                    res,
                    req
                };
                res.on('close', () => {
                    delete watchers[id];
                });
                return;
            } else {
                return res.end('no command for this');
            }
        }
    });

    server.listen(3130, '127.0.0.1', () => {
        console.log(`server start at ${server.address().port}`); // eslint-disable-line
    });
});
