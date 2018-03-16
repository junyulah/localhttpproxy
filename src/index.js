const http = require('http');
const url = require('url');
const uuidv4 = require('uuid/v4');
const fs = require('fs');
const {
    pipeRequest,
    tryJSONFormat
} = require('./util');
const {
    promisify
} = require('es6-promisify');
const mkdirp = promisify(require('mkdirp'));
const path = require('path');
const {
    getConfig
} = require('./config');

const writeFile = promisify(fs.writeFile);

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

const watchers = {};

const logInHttp = (req) => {
    console.log(req.url); // eslint-disable-line

    for (const id in watchers) {
        const watcher = watchers[id];
        watcher.res.write(req.url + '\n');
    }
};

// TODO pipe
const storeRequest = (storeHostRule, urlPath) => {
    if (matchHostPath(storeHostRule, urlPath)) {
        const resChunks = [];
        const reqChunks = [];
        let requestOptions = null;
        let responseHeaders = null;
        const {
            targetDir,
            fileNameRule = 'uuid'
        } = storeHostRule;
        return (eventType, data) => {
            if (eventType === 'req-options') {
                requestOptions = data;
            } else if (eventType === 'req-data') {
                reqChunks.push(data.toString());
            } else if (eventType === 'res-headers') {
                responseHeaders = data;
            } else if (eventType === 'res-data') {
                resChunks.push(data.toString());
            } else if (eventType === 'res-end') {
                const prefix = urlPath.replace(/\//g, '_') + '-';
                const fileName = prefix + (fileNameRule === 'uuid' ? uuidv4() : fileNameRule === 'time' ? new Date().toString() : 'tmp') + '.json';
                // store to target file
                mkdirp(targetDir).then(() => {
                    writeFile(path.join(targetDir, fileName), JSON.stringify({
                        request: {
                            options: requestOptions,
                            data: tryJSONFormat(reqChunks.join(''))
                        },
                        response: {
                            statusCode: responseHeaders.statusCode,
                            headers: responseHeaders.headers,
                            data: tryJSONFormat(resChunks.join(''))
                        }
                    }, null, 4), 'utf-8');
                });
            }
        };
    } else {
        return null;
    }
};

const matchHostPath = (hostRule, urlPath) => {
    return hostRule && (!hostRule.pathReg || new RegExp(hostRule.pathReg).test(urlPath));
};

getConfig().then((config) => {
    const server = http.createServer((req, res) => {
        const urlObject = url.parse(req.url, false);
        const storeOnEvent = storeRequest(config.store && config.store.host && config.store.host[req.headers.host], urlObject.path);

        if (req.headers.host !== '127.0.0.1:3130') {
            logInHttp(req, req.url);
            const hostRule = config.proxy && config.proxy.host && config.proxy.host[req.headers.host];
            // check path
            if (matchHostPath(hostRule, urlObject.path)) {
                logInHttp(req, `[proxy host]: ${req.headers.host} => ${hostRule.targetHost}`);
                return pipeRequest(proxyHost(req, hostRule.targetHost), req, res, storeOnEvent);
            }

            logInHttp(req, `[forward] to ${req.headers.host}`);
            // forward
            return pipeRequest(getForwardOption(req), req, res, storeOnEvent);
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
