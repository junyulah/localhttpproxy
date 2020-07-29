const http = require('http');
const url = require('url');
const uuidv4 = require('uuid/v4');
const path = require('path');
const {
  coalesce
} = require('./util');
const _ = require('lodash');
const {
  os: {
    getUserHome
  },
  fs: {
    readConfig,
  }
} = require('general_lib');

const proxyMid = require('./mids/proxy');
const injectorOnEventMid = require('./mids/injectorOnEvent');
const storeRequestMid = require('./mids/storeRequest');

const watchers = {};

const logInHttp = (req, str) => {
  console.log(str); // eslint-disable-line

  for (const id in watchers) {
    const watcher = watchers[id];
    watcher.res.write(str);
  }
};

const startServer = async () => {
  const configPath = path.join(getUserHome(), 'lhp.config.json');
  const config = await readConfig(configPath, {});

  const server = http.createServer((req, res) => {
    req.setTimeout(20 * 60 * 1000);

    const urlObject = url.parse(req.url, false);

    const pipeOnEventHandler = coalesce(
      storeRequestMid(_.get(config, 'store.host', {})[req.headers.host], urlObject.path),
      injectorOnEventMid(req,
        _.get(config, 'injector.host', {})[req.headers.host],
        urlObject.path)
    );

    if (req.headers.host !== '127.0.0.1:3130') { // only consider other hosts than this server itself
      return proxyMid({
        logInHttp,
        req,
        urlObject,
        config,
        pipeOnEventHandler,
        res,
      });
    } else { // handler for current server request
      if (req.url === '/live') {
        return res.end('I am alive');
      } else if (req.url === '/shutdown') {
        res.end('about to shutdown...');
        return process.exit(0);
      } else if (req.url === '/config') {
        res.end(JSON.stringify(config, null, 4));
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
};

startServer();
