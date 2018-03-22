const matchHostPath = require('./matchHostPath');
const path = require('path');
const urlParser = require('url');
const {
  tryJSONFormat,
} = require('./util');
const uuidv4 = require('uuid/v4');
const fs = require('fs');
const {
  coalesce
} = require('./util');
const requestor = require('cl-requestor');
const {
  promisify
} = require('es6-promisify');
const mkdirp = promisify(require('mkdirp'));

const writeFile = promisify(fs.writeFile);
const httpRequest = requestor('http');

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

const storeToPath = (storeHostRule, urlPath, fullReqData) => {
  const {
    url,
    fileNameRule = 'uuid'
  } = storeHostRule;

  if (/^http:\/\//.test(url)) {
    const urlObject = urlParser.parse(url, false);

    return httpRequest({
      hostname: urlObject.hostname,
      port: urlObject.port,
      path: urlObject.path
    });
  } else {
    const prefix = urlPath.replace(/\//g, '_') + '-';
    const fileName = prefix + (fileNameRule === 'uuid' ? uuidv4() : fileNameRule === 'time' ? new Date().toString() : 'tmp') + '.json';

    // store to target file
    return mkdirp(url).then(() => {
      writeFile(path.join(url, fileName), fullReqData, 'utf-8');
    });
  }
};
