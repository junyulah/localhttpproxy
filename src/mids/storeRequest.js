const path = require('path');
const urlParser = require('url');
const {
  tryJSONFormat,
  coalesce,
  matchHostPath
} = require('../util');
const uuidv4 = require('uuid/v4');
const mkdirp = require('mkdirp');
const http = require('http');
const {
  fs: {
    writeTxt
  }
} = require('general_lib');
const _ = require('lodash');

module.exports = ({
  req,
  config,
  urlObject,
  logInHttp
}) => {
  const storeHostRules = _.get(config, 'store.host', {})[req.headers.host] || [];
  const urlPath = urlObject.path;

  return coalesce(...storeHostRules.map((storeHostRule) => handleStoreHostRule(req, storeHostRule, urlPath, logInHttp)));
};

const handleStoreHostRule = (req, storeHostRule, urlPath, logInHttp) => {
  if (matchHostPath(storeHostRule, urlPath)) {
    logInHttp(req, `[store] ${urlPath}`);
    const resChunks = [];
    const reqChunks = [];
    let requestOptions = null;
    let responseHeaders = null;

    // handle
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
        const fullReqData = JSON.stringify({
          url: urlPath,
          request: {
            options: requestOptions,
            data: tryJSONFormat(reqChunks.join(''))
          },
          response: {
            statusCode: responseHeaders.statusCode,
            headers: responseHeaders.headers,
            data: tryJSONFormat(resChunks.join(''))
          }
        }, null, 4);
        storeToPath(storeHostRule, urlPath, fullReqData);
      }
    };
  } else {
    return null;
  }
};

const storeToPath = async (storeHostRule, urlPath, fullReqData) => {
  const {
    url,
    fileNameRule = 'uuid'
  } = storeHostRule;

  if (/^http:\/\//.test(url)) {
    const urlObject = urlParser.parse(url, false);

    const httpReq = http.request({
      hostname: urlObject.hostname,
      port: urlObject.port,
      path: urlObject.path,
      method: 'POST'
    }).on('error', () => {
      // TODO
    });
    httpReq.write(fullReqData);
    httpReq.end();
  } else {
    const prefix = urlPath.replace(/\//g, '_') + '-';
    const fileName = prefix + (fileNameRule === 'uuid' ? uuidv4() : fileNameRule === 'time' ? new Date().toString() : 'tmp') + '.json';

    // store to target file
    await mkdirp(url);
    return writeTxt(path.join(url, fileName), fullReqData);
  }
};
