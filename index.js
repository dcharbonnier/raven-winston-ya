"use strict";
const ravenClient = require("raven").Client;
const winston_1 = require("winston");
class Raven extends winston_1.Transport {
    constructor(options) {
        super(options);
        this.levels = options.levels || new Map([
            ["silly", "debug"],
            ["verbose", "debug"],
            ["info", "info"],
            ["debug", "debug"],
            ["warn", "warning"],
            ["error", "error"]
        ]);
        this.raven = options.raven || new ravenClient(options.dsn || false, options.ravenOptions || {});
        if (options.patchGlobal === true) {
            this.raven.patchGlobal();
        }
        this.raven.on("error", (error) => {
            let message = "Communication error with sentry.";
            if (error && error.reason) {
                message += ` Reason: ${error.reason}`;
            }
            // eslint-disable-next-line no-console
            console.log(message);
        });
    }
    static get name() {
        return "raven";
    }
    log(level, msg, meta = {}, callback) {
        if (this.silent) {
            return callback(null, true);
        }
        if (meta instanceof Error && msg === "") {
            msg = meta;
            meta = {};
        }
        if (msg && msg["extra"]) {
            let extra = msg["extra"];
            for (let key of Object.keys(extra)) {
                if (extra[key] instanceof Object) {
                    if (!meta[key]) {
                        meta[key] = {};
                    }
                    Object.assign(meta[key], extra[key]);
                }
                else {
                    meta[key] = extra[key];
                }
            }
            delete msg["extra"];
        }
        let ravenOptions = Object.keys(meta).reduce((res, key) => {
            if (Raven.RAVEN_PROCESS_ATTRIBUTES.has(key)) {
                res[key] = meta[key];
            }
            return res;
        }, {});
        ravenOptions["extra"] = Object.keys(meta).reduce((res, key) => {
            if (!Raven.RAVEN_PROCESS_ATTRIBUTES.has(key)) {
                res[key] = meta[key];
            }
            return res;
        }, ravenOptions["extra"] || {});
        ravenOptions.level = this.levels.get(level);
        if (msg instanceof Error) {
            this.raven.captureException(msg, ravenOptions, () => callback(null, true));
        }
        else {
            if (!msg) {
                this.raven.captureException(new Error("empty log message"), ravenOptions, () => callback(null, true));
            }
            else {
                this.raven.captureMessage(msg, ravenOptions, () => callback(null, true));
            }
        }
    }
}
exports.Raven = Raven;
Raven.RAVEN_PROCESS_ATTRIBUTES = new Set(["extra", "tags", "fingerprint",
    "level", "culprit", "request", "server_name", "environment", "logger",
    "user"
]);
