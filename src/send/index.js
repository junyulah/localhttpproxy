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

    log('send', options);
    const {
      body,
      headers,
      statusCode
    } = await requestor(protocol)(options, typeof data === 'string' ? data : JSON.stringify(data));

    log('res-status', statusCode);
    log('res-headers', JSON.stringify(headers, null, 4));
    log('res-body', body);
  } catch (err) {
    logErr('request-err', err);
  }
};
