const _ = require('lodash');
const url = require('url');
const {
  pipeRequest,
  forwardRequestDiscardResponse,
  matchHostPath
} = require('../util');

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

module.exports = ({
  logInHttp,
  req,
  urlObject,
  config,
  pipeOnEventHandler,
  res,
}) => { // only consider other hosts than this server itself
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
};
