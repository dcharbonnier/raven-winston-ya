const ravenClient = require("raven").Client;

declare class RavenClient {
    patchGlobal: ()=>void;
    captureException: (...args:any[]) => void;
    captureMessage: (...args:any[]) => void;
    on: (event: "error", handler: (error: Error) => void) => void;
}

import {Transport, TransportInstance} from "winston";


type RavenLevel = "debug" | "info" | "warning" | "error";

export interface Options {
    raven?: RavenClient;
    levels?: Map<string,RavenLevel>;
    dsn?: string;
    ravenOptions?: any;
    patchGlobal?: boolean;
}

export class Raven extends Transport implements TransportInstance {

    static readonly RAVEN_PROCESS_ATTRIBUTES = new Set(["extra", "tags", "fingerprint",
    "level", "culprit", "request", "server_name", "environment", "logger",
    "user"
    ]);

    private levels: Map<string,RavenLevel>;
    private raven: RavenClient;

    constructor(options: Options) {
        super(options);

        this.levels = options.levels || new Map<string,RavenLevel>([
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

        this.raven.on("error", (error: Error) => {
            let message = "Communication error with sentry.";
            if (error && (<any>error).reason) {
                message += ` Reason: ${(<any>error).reason}`;
            }
            // eslint-disable-next-line no-console
            console.log(message);
        });
    }

    log(level: string, msg: Error|any, meta: any = {}, callback: (error: Error, success: boolean)=>void) {

        if (this.silent) {
            return callback(null, true);
        }

        if (meta instanceof Error && msg === "") {
            msg = meta;
            meta = {};
        }
        if (msg && msg["extra"]) {
            let extra:any = msg["extra"];
            for (let key of Object.keys(extra)) {
                if (extra[key] instanceof Object) {
                    if (!meta[key]) {
                        meta[key] = {};
                    }
                    Object.assign(meta[key], extra[key]);
                } else {
                    meta[key] = extra[key];
                }
            }
            delete msg["extra"];
        }
        let ravenOptions: any = Object.keys(meta).reduce((res: any, key: string) => {
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
        } else {
            if (!msg) {
                this.raven.captureException(new Error("empty log message"), ravenOptions, () => callback(null, true));
            } else {
                this.raven.captureMessage(msg, ravenOptions, () => callback(null, true));
            }
        }

    }
}

