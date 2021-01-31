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
const app = express_1.default(), server = http_1.createServer(app), io = require("socket.io")(server);
require("mongoose").Promise = global.Promise;
// Open mongodb connection
mongoose_1.connect("mongodb://localhost:27017/Chat", {
    useFindAndModify: true,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    numberOfRetries: 1
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
    socket.on("message", (message) => {
        console.log(message);
        socket.broadcast.emit("message", message);
        new models.Message({
            content: message.content,
            sender: message.sender,
            timestamp: message.timestamp
        })
            .save()
            .catch(function (err) {
            console.log(chalk_1.default.hex("#e84118")(err), "Message saved");
        });
    });
    socket.on("user disconnected", (userName) => {
        io.sockets.emit("user disconnected", userName);
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
        io.sockets.emit("user connected", userName);
        new models.Message({
            sender: userName,
            type: "connected"
        })
            .save()
            .catch(function (err) {
            console.log(chalk_1.default.hex("#e84118")(err), "User connected");
        });
    });
    socket.on("clear history", () => {
        socket.broadcast.emit("clear history");
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
server.listen(5550);
