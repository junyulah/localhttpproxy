const {
  fs: {
    readConfig
  },
  log: {
    log,
    logErr
  }
} = require('general_lib');
const requestor = require('cl-requestor');

/**
 * send request
 *
 * TODO merge configuration with content of file
 */
module.exports = async (file) => {
  try {
    const {
      options,
      data = '',
      protocol = 'http'
    } = (await readConfig(file)).request;

    if (data) {
      options.headers = options.headers || {};
      options.headers['Content-Length'] = data.length;
    }

    log('send-options', options);
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    log('send-data', dataStr);
    const {
      body,
      headers,
      statusCode
    } = await requestor(protocol)(options, dataStr);

    log('res-status', statusCode);
    log('res-headers', JSON.stringify(headers, null, 4));
    log('res-body', body);
  } catch (err) {
    logErr('request-err', err);
  }
};
