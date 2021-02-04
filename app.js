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
const http_1 = require("http");
const chalk_1 = __importDefault(require("chalk"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const models = __importStar(require("./models"));
const express_fileupload_1 = __importDefault(require("express-fileupload"));
const app = express_1.default(), server = http_1.createServer(app), io = require("socket.io")(server);
require("mongoose").Promise = global.Promise;
// Open mongodb connection
mongoose_1.connect("mongodb://localhost:27017/Chat", {
    useFindAndModify: true,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    numberOfRetries: 2
});
mongoose_1.connection
    .on("open", () => {
    console.log(chalk_1.default.hex("#2ecc71")("Database connected!"));
})
    .on("close", () => {
    console.log(chalk_1.default.hex("#1a9c74")("Database disconnected!"));
})
    .on("error", err => {
    console.log(chalk_1.default.hex("#e84118")("Database Error: "), err);
});
// Socket.io (websocket) connection
io.on("connection", (socket) => {
    console.log(chalk_1.default.hex("#95a5a6")("Client connected!"));
    socket.on("error", err => {
        console.log("Socket error");
        console.log(chalk_1.default.hex("#e84118")(err));
    });
    socket.on("message", async (message) => {
        console.log(message);
        let msg = new models.Message({
            content: message.content,
            sender: message.sender,
            timestamp: message.timestamp
        });
        await msg.save().catch(function (err) {
            console.log(chalk_1.default.hex("#e84118")(err), "Message saved");
        });
        io.sockets.emit("message", msg.toObject());
    });
    socket.on("user disconnected", (userName) => {
        socket.broadcast.emit("user disconnected", userName);
        new models.Message({
            sender: userName,
            type: "disconnected"
        })
            .save()
            .catch(function (err) {
            console.log(chalk_1.default.hex("#e84118")(err), "User disconnected");
        });
    });
    socket.on("user connected", (userName) => {
        socket.broadcast.emit("user connected", userName);
        new models.Message({
            sender: userName,
            type: "connected"
        })
            .save()
            .catch(err => {
            console.log(chalk_1.default.hex("#e84118")(err), "User connected");
        });
    });
    socket.on("clear history", () => {
        socket.broadcast.emit("clear history");
    });
    socket.on("clear logs", async () => {
        await models.Message.deleteMany({ type: "disconnected" });
        await models.Message.deleteMany({ type: "connected" });
        io.sockets.emit("clear logs");
    });
    socket.on("message edit", async (id, content) => {
        console.log(id, content);
        await models.Message.findByIdAndUpdate(id, {
            content: content,
            edited: true
        }).catch(err => {
            console.log(chalk_1.default.hex("#e84118")(err), "Message edit");
            socket.emit("error", err);
        });
        io.sockets.emit("message edit", id, content);
    });
    socket.on("image", async (rawImg, timestamp, sender) => {
        // let buffer: Uint8Array = new Uint8Array(rawImg.split(" ") as any);
        console.log(rawImg);
        // for (let elem of Buffer.from(img)) buffer.push(elem.toString());
        // let savedImg = new models.Message({
        //   type: "image",
        //   timestamp: timestamp,
        //   sender: sender,
        //   content: buffer.join(" ")
        // });
        // await savedImg.save();
        // io.sockets.emit("image", savedImg);
    });
    socket.on("delete", async (id) => {
        await models.Message.findByIdAndRemove(id).catch(err => {
            console.log(chalk_1.default.hex("#e84118")(err), "Message edit");
            socket.emit("error", err);
        });
        io.sockets.emit("delete", id);
    });
});
app.use(express_1.default.static(path_1.default.join(__dirname, "public")), cors_1.default());
app.get("/messages", (req, res, next) => { });
// Initialization process (message history) sending to each new connected user
app.get("/init", async (req, res, next) => {
    try {
        const messages = await models.Message.find({});
        res.json(JSON.stringify(messages));
    }
    catch {
        return res.sendStatus(500);
    }
});
app.post("/img", express_fileupload_1.default(), (req, res, next) => {
    /////////////////////////////
    console.log(req.files);
});
// Clear db history
app.get("/clear", (req, res, next) => {
    try {
        mongoose_1.connection.dropCollection("messages");
    }
    catch {
        return res.sendStatus(500);
    }
    res.sendStatus(200);
});
server.listen(5555);
