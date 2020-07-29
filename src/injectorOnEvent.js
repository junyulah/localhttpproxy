const matchHostPath = require('./matchHostPath');
const {
  fs: {
    readTxt
  }
} = require('general_lib');

// TODO pipe
module.exports = (req, injectorHostRule, urlPath) => {
  if (matchHostPath(injectorHostRule, urlPath)) {
    const {
      part,
      position,
      contentFile
    } = injectorHostRule;

    return async (eventType, data, res) => {
      if (eventType === 'res-headers') {
        if (part === 'response') {
          res.setHeader('Transfer-Encoding', 'chunked');
        }
        if (part === 'response' && position === 'before') {
          const str = await readTxt(contentFile);
          res.write(str);
        }
      }
      if (eventType === 'res-data') {
        //
      } else if (eventType === 'res-end') {
        if (part === 'response' && position === 'after') {
          const str = await readTxt(contentFile);
          res.write(str);
        }
      }
    };
  } else {
    return null;
  }
};
