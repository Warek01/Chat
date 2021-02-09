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
const fs_1 = require("fs");
const app = express_1.default(), server = http_1.createServer(app), io = require("socket.io")(server);
require("mongoose").Promise = global.Promise;
const saveImgPath = path_1.default.join(__dirname, "saved_img");
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
    socket.on("text_message", async (message) => {
        console.log(message);
        let msg = new models_1.TextMessage({
            content: message.content,
            sender: message.sender,
            timestamp: message.timestamp
        });
        await msg.save().catch(function (err) {
            console.log(chalk_1.default.hex("#e84118")(err), "Message saved");
        });
        io.sockets.emit("text_message", msg.toObject());
    });
    socket.on("connect_log", async (obj) => {
        await new models_1.ConnectionLog(obj).save().catch(logError(socket, "Connect Log"));
        socket.broadcast.emit("connect_log", obj);
    });
    socket.on("clear_history", async () => {
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
            edited: true
        }).catch(logError(socket, "Message Edit"));
        io.sockets.emit("message_edit", id, content);
    });
    socket.on("image", async (rawImg, timestamp, sender) => { });
    socket.on("delete_text_message", async (id) => {
        await models_1.TextMessage.findByIdAndRemove(id).catch(logError(socket, "Delete Text Message"));
        io.sockets.emit("delete_text_message", id);
    });
    socket.on("remove_edit_marks", async () => {
        await models_1.TextMessage.updateMany({ edited: true }, { $set: { edited: false } });
        io.sockets.emit("remove_edit_marks");
    });
    // Images implementation
    let imageProcessing = false;
    let currentImageName;
    let parts = [];
    let currentImgId;
    socket.on("request_image", (data) => { });
    socket.on("image_data", async (data) => {
        if (!imageProcessing) {
            currentImageName = data.imageName;
            imageProcessing = true;
            let document = (await new models_1.Image(data)
                .save()
                .catch(logError(socket, "Image Data")));
            currentImgId = document.toObject()._id;
        }
    });
    socket.on("image_part", async (imageName, part) => {
        if (imageName === currentImageName &&
            !fs_1.existsSync(path_1.default.join(saveImgPath, currentImageName)))
            parts.push(part);
        else if (imageName !== currentImageName)
            throw Error("Image name error");
    });
    socket.on("image_send_end", (data) => {
        if (imageProcessing && currentImageName) {
            const base64 = parts.join("").replace(/^data:image\/\w+;base64,/, "");
            fs_1.writeFile(path_1.default.join(saveImgPath, currentImageName), base64, { encoding: "base64" }, () => {
                io.sockets.emit("image_send_end");
                // Sending back
                io.sockets.emit("image_data", data);
                for (let part of parts)
                    io.sockets.emit("image_part", currentImageName, part);
                io.sockets.emit("image_send_end", data, currentImgId);
                imageProcessing = false;
                currentImageName = null;
                currentImgId = null;
                parts = [];
            });
        }
    });
});
app.use(express_1.default.static(path_1.default.join(__dirname, "public")), cors_1.default());
let imageProcessing = false;
app.get("/getImage/:_id/:part", (req, res, next) => {
    if (!imageProcessing) {
        if (Number(req.params.part) === 999) {
            imageProcessing = false;
        }
    }
});
// Initialization process (message history) sending to each new connected user
app.get("/init", async (req, res, next) => {
    try {
        const textMessages = await models_1.TextMessage.find({}), connectionLogs = await models_1.ConnectionLog.find({}), images = await models_1.Image.find({});
        let sorted = sortByTimestamp([
            textMessages,
            connectionLogs,
            images
        ]);
        res.json(sorted);
    }
    catch {
        return res.sendStatus(500);
    }
});
// Clear db history
app.get("/clear", (req, res, next) => {
    try {
        mongoose_1.connection.dropDatabase();
    }
    catch {
        return res.sendStatus(500);
    }
    res.sendStatus(200);
});
server.listen(5555);
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
if (!String.prototype.splitToLength) {
    String.prototype.splitToLength = function (len) {
        if (len === undefined || len > this.length) {
            len = this.length;
        }
        var yardstick = new RegExp(`.{${len}}`, "g");
        var pieces = this.match(yardstick);
        var accumulated = pieces.length * len;
        var modulo = this.length % accumulated;
        if (modulo)
            pieces.push(this.slice(accumulated));
        return pieces;
    };
}
