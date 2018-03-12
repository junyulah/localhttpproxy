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

module.exports = {
    logPs
};
