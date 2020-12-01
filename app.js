"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = require("mongoose");
const http_1 = require("http");
const chalk_1 = __importDefault(require("chalk"));
const path_1 = __importDefault(require("path"));
const app = express_1.default(), server = http_1.createServer(app), io = require("socket.io")(server);
// Open mongodb connection
mongoose_1.connect("mongodb://localhost:27017/Chat", {
    useFindAndModify: true,
    useNewUrlParser: true,
    useUnifiedTopology: true
});
mongoose_1.connection.on("open", () => {
    console.log(chalk_1.default.hex("#2ecc71")("Database connected!"));
}).on("close", () => {
    console.log(chalk_1.default.hex("#1a9c74")("Database disconnected!"));
});
// Socket.io (websocket) connection
io.on("connection", socket => {
    console.log(chalk_1.default.hex("#95a5a6")("Client connected!"));
    socket.on("message", message => {
        /*  */
    });
});
app.use(express_1.default.static(path_1.default.join(__dirname, "public")));
app.route("/messages").get((req, res, next) => {
});
server.listen(8000, () => {
    console.log();
});
