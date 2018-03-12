const log = console.log; // eslint-disable-line

module.exports = (req, watchers) => {
    log(req.url);
    for (const id in watchers) {
        const watcher = watchers[id];
        watcher.res.write(req.url + '\n');
    }
};
