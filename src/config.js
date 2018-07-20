const fs = require('fs');
const {
  promisify
} = require('es6-promisify');
const path = require('path');

const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

const isWindow = () => process.platform === 'win32';

const getUserHome = () => {
  return process.env[isWindow() ? 'USERPROFILE' : 'HOME'];
};

const existsFile = (filePath) => {
  return new Promise((resolve) => {
    stat(filePath).then((statObj) => {
      resolve(statObj.isFile());
    }).catch(() => {
      resolve(false);
    });
  });
};

const getConfig = () => {
  const configPath = path.join(getUserHome(), 'lhp.config.json');
  return existsFile(configPath).then((has) => {
    if (!has) {
      return {};
    } else {
      return readFile(configPath, 'utf-8').then((txt) => {
        try {
          return JSON.parse(txt);
        } catch (err) {
            console.log(err);
            throw err;
        }
      });
    }
  });
};

module.exports = {
  getConfig
};
