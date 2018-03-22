const http = require('http');
const url = require('url');
const uuidv4 = require('uuid/v4');
const fs = require('fs');
const {
  pipeRequest,
  forwardRequestDiscardResponse,
  coalesce
} = require('./util');
const {
  promisify
} = require('es6-promisify');
const {
  getConfig
} = require('./config');
const _ = require('lodash');
const matchHostPath = require('./matchHostPath');
const storeRequest = require('./storeRequest');

const readFile = promisify(fs.readFile);

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

const logInHttp = (req, str) => {
  console.log(str); // eslint-disable-line

  for (const id in watchers) {
    const watcher = watchers[id];
    watcher.res.write(req.url + '\n');
  }
};

// TODO pipe
const injectorOnEvent = (injectorHostRule, urlPath) => {
  if (matchHostPath(injectorHostRule, urlPath)) {
    const {
      part,
      position,
      contentFile
    } = injectorHostRule;

    return (eventType, data, res) => {
      if (eventType === 'res-headers') {
        if (part === 'response') {
          res.setHeader('Transfer-Encoding', 'chunked');
        }
        if (part === 'response' && position === 'before') {
          return readFile(contentFile, 'utf-8').then((str) => {
            res.write(str);
          });
        }
      }
      if (eventType === 'res-data') {
        //
      } else if (eventType === 'res-end') {
        if (part === 'response' && position === 'after') {
          return readFile(contentFile, 'utf-8').then((str) => {
            res.write(str);
          });
        }
      }
    };
  } else {
    return null;
  }
};

getConfig().then((config) => {
  const server = http.createServer((req, res) => {
    const urlObject = url.parse(req.url, false);
    const pipeOnEventHandler = coalesce(
      storeRequest(_.get(config, 'store.host', {})[req.headers.host], urlObject.path),
      injectorOnEvent(_.get(config, 'injector.host', {})[req.headers.host], urlObject.path)
    );

    if (req.headers.host !== '127.0.0.1:3130') { // only consider other hosts than this server itself
      logInHttp(req, `[access] ${req.url}`);

      // deliver rule, just send request data to another server without response
      const deliverHostRules = _.get(config, 'deliver.host', {})[req.headers.host] || [];
      for (let i = 0, n = deliverHostRules.length; i < n; i++) {
        const hostRule = deliverHostRules[i];
        // check path
        if (matchHostPath(hostRule, urlObject.path)) {
          logInHttp(req, `[proxy host]: ${req.url}, ${req.headers.host} => ${hostRule.targetHost}`);
          forwardRequestDiscardResponse(proxyHost(req, hostRule.targetHost), req);
        }
      }

      // proxy rule
      const proxyHostRules = _.get(config, 'proxy.host', {})[req.headers.host] || [];
      for (let i = 0, n = proxyHostRules.length; i < n; i++) {
        const hostRule = proxyHostRules[i];
        // check path
        if (matchHostPath(hostRule, urlObject.path)) {
          logInHttp(req, `[proxy host]: ${req.url}, ${req.headers.host} => ${hostRule.targetHost}`);
          return pipeRequest(proxyHost(req, hostRule.targetHost), req, res, pipeOnEventHandler);
        }
      }

      logInHttp(req, `[forward] ${req.url} to ${req.headers.host}`);
      // forward
      return pipeRequest(getForwardOption(req), req, res, pipeOnEventHandler);
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
