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

    const startTime = new Date();

    const {
      body,
      headers,
      statusCode
    } = await request({
      protocol,
      options,
      data,
      beforeSend: (options, str) => {
        log('send-options', options);
        log('send-data', str);
        log('curl-example', '\n' + toCurlCmd(protocol, options, str));
      }
    });

    const endTime = new Date();
    log('process-time', `${(endTime.getTime() - startTime.getTime()) / 1000}s`);
    log('res-status', statusCode);
    log('res-headers', JSON.stringify(headers, null, 4));
    log('res-body', tryJson(body));
  } catch (err) {
    logErr('request-err', err);
  }
};

const tryJson = (body) => {
  try {
    return JSON.stringify(JSON.parse(body), null, 4);
  } catch (err) {
    return body;
  }
};

const toCurlCmd = (protocol, options, str) => {
  const headers = options.headers || {};
  const headerLines = [];
  for (let key in headers) {
    const value = headers[key];
    const kv = `${key}: ${value}`;
    headerLines.push(`-H ${JSON.stringify(kv)}`);
  }
  const url = `${protocol}://${options.host}:${options.port}${options.path}`;
  return `curl -X ${options.method || 'GET'} ${url} \\
${headerLines.join(' \\\n')} \\
--data ${JSON.stringify(str)}`;
};
