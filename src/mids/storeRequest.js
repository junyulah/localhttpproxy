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

module.exports = (storeHostRules = [], urlPath) => {
  return coalesce(...storeHostRules.map((storeHostRule) => handleStoreHostRule(storeHostRule, urlPath)));
};

const handleStoreHostRule = (storeHostRule, urlPath) => {
  if (matchHostPath(storeHostRule, urlPath)) {
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
