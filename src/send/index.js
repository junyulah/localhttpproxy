const {
  fs: {
    readConfig
  },
  log: {
    log,
    logErr
  },
  net: {
    http: {
      request
    }
  }
} = require('general_lib');

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

    log('send-options', options);
    log('send-data', data);

    const {
      body,
      headers,
      statusCode
    } = await request({
      protocol,
      options,
      data
    });

    log('res-status', statusCode);
    log('res-headers', JSON.stringify(headers, null, 4));
    log('res-body', body);
  } catch (err) {
    logErr('request-err', err);
  }
};
