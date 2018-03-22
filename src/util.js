const http = require('http');

const log = console.log; // eslint-disable-line
const error = console.error; // eslint-disable-line

const logPs = (ps) => {
  ps.stdout.on('data', (data) => {
    log(data.toString());
  });

  ps.stderr.on('data', (data) => {
    error(data.toString());
  });

  ps.on('close', (code) => {
    log(`process exited with code ${code}`);
  });
};

const pipeRequest = (reqOptions, req, res, onEvent) => {
  onEvent && onEvent('req-options', reqOptions);

  const httpReq = http.request(reqOptions, (httpRes) => {
    res.statusCode = httpRes.statusCode;
    for (const name in httpRes.headers) {
      res.setHeader(name, httpRes.headers[name]);
    }

    const headersAction = Promise.resolve(onEvent && onEvent('res-headers', {
      statusCode: httpRes.statusCode,
      headers: httpRes.headers
    }, res));

    httpRes.on('data', (chunk) => {
      headersAction.then(() => {
        onEvent && onEvent('res-data', chunk, res);
        res.write(chunk);
      });
    });

    httpRes.on('end', () => {
      headersAction.then(() => {
        return Promise.resolve(onEvent && onEvent('res-end', null, res)).then(() => {
          res.end();
        });
      });
    });
  });

  httpReq.on('error', (err) => {
    res.statusCode = 500;
    res.write(err.toString());
    res.end();
  });

  req.on('data', (chunk) => {
    onEvent && onEvent('req-data', chunk);
    httpReq.write(chunk);
  });

  req.on('end', () => {
    onEvent && onEvent('req-end');
    httpReq.end();
  });
};

const forwardRequestDiscardResponse = (reqOptions, req) => {
  const httpReq = http.request(reqOptions);

  // catch error
  httpReq.on('error', () => {
    //
  });

  req.on('data', (chunk) => {
    httpReq.write(chunk);
  });

  req.on('end', () => {
    httpReq.end();
  });
};

const tryJSONFormat = (str) => {
  try {
    return JSON.parse(JSON.stringify(JSON.parse(str), null, 4));
  } catch (err) {
    return str;
  }
};

const coalesce = (...funs) => {
  return (...args) => {
    return Promise.all(funs.map((fun) => {
      if (fun) {
        return fun(...args);
      }
    }));
  };
};

module.exports = {
  logPs,
  pipeRequest,
  forwardRequestDiscardResponse,
  tryJSONFormat,
  coalesce
};
