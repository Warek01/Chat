"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = require("mongoose");
require("mongoose").Promise = global.Promise;
const http_1 = require("http");
const chalk_1 = __importDefault(require("chalk"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const readline_1 = __importDefault(require("readline"));
const models_1 = require("./models");
const process_1 = __importStar(require("process"));
const fs_1 = require("fs");
const sharp_1 = __importDefault(require("sharp"));
const base64ToArrBuf = __importStar(require("base64-arraybuffer"));
const optimist_1 = __importDefault(require("optimist"));
const Structures_1 = require("./Structures");
// Catch global errors to append them to logs file
try {
    const app = express_1.default(), server = http_1.createServer(app), io = require("socket.io")(server);
    const IMG_PATH = path_1.default.join(__dirname, "saved_img");
    const argv = optimist_1.default
        .options("p", {
        alias: "port",
        describe: "Port where to run app",
        default: 8000,
    })
        .options("nologs", {
        default: true,
        alias: "no-connection-logs",
    }).argv;
    argv.nologs = argv["no-connection-logs"] = argv.nologs === "true";
    let CONFIG = {
        noConnectionLogs: argv.nologs,
        noNotifications: false,
    };
    // Open mongodb connection
    mongoose_1.connect("mongodb://localhost:27017/Chat", {
        useFindAndModify: true,
        useNewUrlParser: true,
        useUnifiedTopology: true,
        numberOfRetries: 2,
        dbName: "Chat",
    });
    models_1.Config.exists({}, async (err, exists) => {
        if (err)
            throw err;
        if (exists) {
            models_1.Config.findOne({}).then(async (obj) => {
                obj = await obj.toObject();
                if (CONFIG.noConnectionLogs !== obj.noConnectionLogs)
                    models_1.Config.findOneAndUpdate({}, { noConnectionLogs: CONFIG.noConnectionLogs });
                else
                    CONFIG.noConnectionLogs = obj.noConnectionLogs;
                if (CONFIG.noNotifications !== obj.noNotifications)
                    models_1.Config.findOneAndUpdate({}, { noNotifications: CONFIG.noNotifications });
                else
                    CONFIG.noNotifications = obj.noNotifications;
            });
        }
        else {
            new models_1.Config(CONFIG).save();
            console.log(chalk_1.default.hex("#f1c40f")("Config document not found. \nCreating a new one"));
        }
    });
    mongoose_1.connection.on("open", () => {
        console.log(chalk_1.default.hex("#2ecc71")("Database connected!"));
    })
        .on("close", () => {
        console.log(chalk_1.default.hex("#1a9c74")("Database disconnected!"));
    })
        .on("error", (err) => {
        console.log(chalk_1.default.hex("#e84118")("Database Error: "), err);
    });
    // Socket.io (websocket) connection
    io._connectTimeout = 10_000;
    io.on("connection", (socket) => {
        console.log(chalk_1.default.hex("#95a5a6")("Client connected!"));
        socket.on("error", (err) => {
            console.log("Socket error");
            console.log(chalk_1.default.hex("#e84118")(err));
        });
        socket.on("text_message", async (message) => {
            const msg = new models_1.TextMessage(message);
            await msg.save().catch(function (err) {
                console.log(chalk_1.default.hex("#e84118")(err), "Message saved");
            });
            io.sockets.emit("text_message", msg.toObject());
        });
        socket.on("connect_log", async (obj) => {
            if (!CONFIG.noConnectionLogs) {
                await new models_1.ConnectionLog(obj)
                    .save()
                    .catch(logError(socket, "Connect Log"));
                socket.broadcast.emit("connect_log", obj);
            }
        });
        socket.on("clear_history", async () => {
            if (fs_1.existsSync(IMG_PATH))
                fs_1.readdir(IMG_PATH, (err, files) => {
                    if (err)
                        throw err;
                    for (const fileName of files)
                        fs_1.unlink(path_1.default.join(IMG_PATH, fileName), (err) => {
                            if (err)
                                console.log(err);
                        });
                });
            await models_1.TextMessage.deleteMany({}).catch(logError(socket, "Clear History, Text Messages"));
            await models_1.ConnectionLog.deleteMany({}).catch(logError(socket, "Clear History, Connection Logs"));
            await models_1.Image.deleteMany({}).catch(logError(socket, "Clear History, Images"));
            socket.broadcast.emit("clear_history");
        });
        socket.on("clear_logs", async () => {
            await models_1.ConnectionLog.deleteMany({}).catch(logError(socket, "Clear Logs"));
            io.sockets.emit("clear_logs");
        });
        socket.on("message_edit", async (id, content) => {
            await models_1.TextMessage.findByIdAndUpdate(id, {
                content: content,
                edited: true,
            }).catch(logError(socket, "Message Edit"));
            io.sockets.emit("message_edit", id, content);
        });
        socket.on("delete_text_message", async (id) => {
            await models_1.TextMessage.findByIdAndRemove(id).catch(logError(socket, "Delete Text Message"));
            io.sockets.emit("delete_text_message", id);
        });
        socket.on("remove_edit_marks", async () => {
            await models_1.TextMessage.updateMany({ edited: true }, { $set: { edited: false } });
            io.sockets.emit("remove_edit_marks");
        });
        // Images implementation
        let imageProcessing = false, parts = [], currentImg;
        socket.on("image_request", async (id) => {
            const img = await (await models_1.Image.findById(id)).toObject();
            if (fs_1.existsSync(path_1.default.join(IMG_PATH, img.title))) {
                imageProcessing = true;
                currentImg = img;
                fs_1.readFile(path_1.default.join(IMG_PATH, img.title), { encoding: "base64" }, (err, data) => {
                    if (err)
                        throw err;
                    parts = splitToLength(data, 20 * 2 ** 10);
                    for (const part of parts)
                        socket.emit("image_part", img, part);
                    socket.emit("image_send_end", img);
                    imageProcessing = false;
                    currentImg = null;
                });
            }
        });
        socket.on("image_data", async (image) => {
            if (!imageProcessing) {
                imageProcessing = true;
                currentImg = image;
                parts = [];
                let document = (await new models_1.Image(image)
                    .save()
                    .catch(logError(socket, "Image Data")));
                currentImg._id = document.toObject()._id.toString();
                io.sockets.emit("image_data", currentImg);
            }
        });
        socket.on("image_part", async (image, part) => {
            if (image.title === currentImg.title)
                parts.push(part);
            else if (image.title !== currentImg.title)
                throw new Structures_1.ImageParsingError();
        });
        socket.on("image_send_end", (image) => {
            if (imageProcessing && currentImg.title) {
                const base64 = parts.join("").replace(/^data:image\/\w*;base64,/, "");
                sharp_1.default(Buffer.from(base64ToArrBuf.decode(base64)))
                    .resize(1280, 720, { fit: "outside" })
                    .toFile(path_1.default.join(IMG_PATH, image.title))
                    .catch((err) => {
                    console.log("Error resizing file", err);
                })
                    .then(() => {
                    fs_1.readFile(path_1.default.join(IMG_PATH, image.title), { encoding: "base64" }, (err, data) => {
                        if (err)
                            throw err;
                        const raw = splitToLength(data, 20 * 2 ** 10);
                        for (let part of raw)
                            io.sockets.emit("image_part", currentImg, part);
                        io.sockets.emit("image_send_end", currentImg);
                        imageProcessing = false;
                        currentImg = null;
                    });
                    parts = [];
                });
            }
        });
        socket.on("delete_image", async (id) => {
            const title = await (await models_1.Image.findById(id)).toObject().title;
            if (fs_1.existsSync(path_1.default.join(IMG_PATH, title)))
                fs_1.unlink(path_1.default.join(IMG_PATH, title), (err) => {
                    if (err)
                        throw err;
                });
            io.sockets.emit("delete_image", id);
            models_1.Image.deleteOne({ _id: id });
        });
    });
    app.use(logNewClients({ writeToFile: true, writeToDb: true }), express_1.default.static(path_1.default.join(__dirname, "public")), cors_1.default());
    // Initialization process (message history) sending to each new connected user
    app.get("/init", async (req, res, next) => {
        const textMessages = await models_1.TextMessage.find({}), connectionLogs = await models_1.ConnectionLog.find({}), images = await models_1.Image.find({});
        let sorted = sortByTimestamp([textMessages, connectionLogs, images]);
        res.json(sorted);
    });
    app
        .route("/config")
        .get((req, res, next) => {
        try {
            res.json(CONFIG);
        }
        catch (err) {
            res.sendStatus(500);
            throw err;
        }
    })
        .post(express_1.default.text({ defaultCharset: "utf-8" }), async (req, res, next) => {
        try {
            const body = req.body;
            CONFIG[body] = !CONFIG[body];
            if (!(body in CONFIG))
                return res.end("Invalid key " + body);
            await models_1.Config.updateOne({}, CONFIG);
            io.sockets.emit("config_update", CONFIG);
            res.sendStatus(200);
        }
        catch (err) {
            res.sendStatus(500);
            throw err;
        }
    });
    // Clear db history
    app.get("/clear", (req, res, next) => {
        try {
            models_1.Image.deleteMany({});
            models_1.TextMessage.deleteMany({});
            models_1.ConnectionLog.deleteMany({});
        }
        catch (err) {
            res.sendStatus(500);
            throw err;
        }
        res.sendStatus(200);
    });
    server.listen(argv.port, () => {
        console.log(`App started on port ${argv.port}`);
    });
    const rl = readline_1.default.createInterface({ input: process_1.stdin, output: process_1.stdout });
    rl.on("line", (str) => {
        switch (str) {
            case "":
                return;
            case "\n":
                return;
            case "cl-ip":
                models_1.IPaddress.deleteMany({}).then(() => console.log(chalk_1.default.hex("#718093")("Addresses removed from db")));
                if (fs_1.existsSync(path_1.default.join(__dirname, "temp", "ip")))
                    fs_1.unlink(path_1.default.join(__dirname, "temp", "ip"), (err) => {
                        if (err)
                            throw err;
                    });
                break;
            case "cl-msg":
                models_1.TextMessage.deleteMany({}).then(() => console.log(chalk_1.default.hex("#718093")("Text messages removed from db")));
                break;
            case "cl-img":
                if (fs_1.existsSync(IMG_PATH))
                    fs_1.readdir(IMG_PATH, (err, files) => {
                        if (err)
                            throw err;
                        for (const fileName of files)
                            fs_1.unlink(path_1.default.join(IMG_PATH, fileName), (err) => {
                                if (err)
                                    console.log(err);
                            });
                    });
                models_1.Image.deleteMany({}).then(() => console.log(chalk_1.default.hex("#718093")("Images removed from db")));
                break;
            case "cl-logs":
                if (fs_1.existsSync(path_1.default.join(__dirname, "logs.txt"))) {
                    fs_1.unlink(path_1.default.join(__dirname, "logs.txt"), (err) => {
                        if (err)
                            throw err;
                    });
                    console.log("All logs removed");
                }
                else
                    console.log(chalk_1.default.hex("#718093")("No logs available"));
                break;
            case "cl-cnlogs":
                models_1.ConnectionLog.deleteMany({}).then(() => console.log(chalk_1.default.hex("#718093")("Connection logs removed from db")));
                break;
            case "cl-all":
                if (fs_1.existsSync(IMG_PATH))
                    fs_1.readdir(IMG_PATH, (err, files) => {
                        if (err)
                            throw err;
                        for (const fileName of files)
                            fs_1.unlink(path_1.default.join(IMG_PATH, fileName), (err) => {
                                if (err)
                                    console.log(err);
                            });
                    });
                models_1.ConnectionLog.deleteMany({});
                models_1.Image.deleteMany({});
                models_1.TextMessage.deleteMany({});
                console.log(chalk_1.default.hex("#718093")("History cleared"));
                break;
            case "end":
                process_1.exit(0);
                break;
            case "cfg":
                console.log(CONFIG);
                break;
            default:
                throw new Structures_1.CommandUnknown(str);
        }
    });
    process_1.default.once("exit", () => console.log("\nBye\n"));
    function logError(socket = null, message = null) {
        return function (err) {
            console.log(message ? chalk_1.default.hex("#f0932b")(message + ": ") : "", chalk_1.default.hex("#e84118")(err));
            if (socket)
                socket.emit("error", err, message);
        };
    }
    function sortByTimestamp(arrays) {
        let allElements = [];
        for (let arr of arrays)
            for (let element of arr)
                allElements.push(element.toObject());
        for (let i = 0; i < allElements.length; i++)
            for (let j = i + 1; j < allElements.length; j++)
                if (allElements[i].timestamp > allElements[j].timestamp) {
                    let temp = allElements[i];
                    allElements[i] = allElements[j];
                    allElements[j] = temp;
                }
        return allElements;
    }
    function splitToLength(str, len) {
        if (len > str.length)
            len = str.length;
        let range = new RegExp(`.{${len}}`, "g"), pieces = str.match(range), accumulated = pieces.length * len;
        if (str.length % accumulated)
            pieces.push(str.slice(accumulated));
        return pieces;
    }
    function logNewClients(params = { writeToDb: false, writeToFile: false }) {
        return function (req, res, next) {
            if (params.writeToFile)
                if (fs_1.existsSync(path_1.default.join(__dirname, "temp", "ip")))
                    fs_1.appendFile(path_1.default.join(__dirname, "temp", "ip"), `\n\n${req.ip}  ${req.connection.remoteAddress}  ${req.headers["x-forwarded-for"]}`, (err) => {
                        if (err)
                            throw err;
                    });
                else
                    fs_1.writeFile(path_1.default.join(__dirname, "temp", "ip.txt"), `${req.ip}  ${req.connection.remoteAddress}  ${req.headers["x-forwarded-for"]}   ${new Structures_1.ParsedDate().dateAndTime()}`, (err) => {
                        if (err)
                            throw err;
                    });
            if (params.writeToDb)
                models_1.IPaddress.exists({
                    value: `${req.ip}  ${req.connection.remoteAddress}  ${req.headers["x-forwarded-for"]}`,
                }, (err, res) => {
                    if (err)
                        throw err;
                    if (!fs_1.existsSync)
                        new models_1.IPaddress({
                            value: `${req.ip}  ${req.connection.remoteAddress}  ${req.headers["x-forwarded-for"]}`,
                        }).save();
                });
            next();
        };
    }
}
catch (err) {
    console.log(chalk_1.default.hex("#e74c3c")(err));
    const filePath = path_1.default.join(__dirname, "logs.txt");
    if (!fs_1.existsSync(filePath))
        fs_1.writeFile(filePath, `${err}  ${new Structures_1.ParsedDate().dateAndTime()}`, () => console.log("File logs.txt desnt exist. \nCreating a new one."));
    else
        fs_1.appendFile(filePath, `\n\n${err}  ${new Structures_1.ParsedDate().dateAndTime()}`, () => { });
}
