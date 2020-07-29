module.exports = (hostRule, urlPath) => {
  return hostRule && (!hostRule.pathReg || new RegExp(hostRule.pathReg).test(urlPath));
};

