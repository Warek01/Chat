"use strict";
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
const models_1 = require("./models");
const app = express_1.default(), server = http_1.createServer(app), io = require("socket.io")(server);
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
    .on("error", (err) => {
    console.log(chalk_1.default.hex("#e84118")("Database Error: "), err);
});
// Socket.io (websocket) connection
io.on("connection", (socket) => {
    console.log(chalk_1.default.hex("#95a5a6")("Client connected!"));
    socket.on("message", (message) => {
        console.log(message);
        socket.broadcast.emit("message", message);
        new models_1.Message({
            content: message.content,
            sender: message.sender,
            timestamp: message.timestamp
        }).save();
    });
    socket.on("user disconnected", (user) => {
        io.sockets.emit("user disconnected", user);
    });
    socket.on("user connected", (user) => {
        io.sockets.emit("user connected", user);
    });
});
app.use(express_1.default.static(path_1.default.join(__dirname, "public")), cors_1.default());
app.get("/messages", (req, res, next) => { });
app.get("/init", async (req, res, next) => {
    let tasks = await models_1.Message.find({});
    res.json(JSON.stringify(tasks));
});
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
