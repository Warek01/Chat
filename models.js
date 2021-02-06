"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = exports.Image = exports.ConnectionLog = exports.TextMessage = void 0;
const mongoose_1 = require("mongoose");
exports.TextMessage = mongoose_1.model("Text Message", new mongoose_1.Schema({
    content: {
        type: String,
        required: true
    },
    sender: {
        type: String,
        required: true
    },
    timestamp: {
        type: Number,
        required: true
    },
    edited: {
        type: Boolean,
        default: false,
        required: false
    },
    name: {
        type: String,
        required: false,
        default: "text_message"
    }
}), "text_messages");
exports.ConnectionLog = mongoose_1.model("Connection Log", new mongoose_1.Schema({
    type: {
        type: String,
        lowercase: true,
        required: true
    },
    username: {
        type: String,
        required: true
    },
    timestamp: {
        type: Number,
        required: true
    },
    name: {
        type: String,
        required: false,
        default: "connection_log"
    }
}), "connection_logs");
exports.Image = mongoose_1.model("Image File", new mongoose_1.Schema({
    sender: {
        type: String,
        required: true
    },
    imageName: {
        type: String,
        required: true
    },
    timestamp: {
        type: Number,
        required: true
    },
    name: {
        type: String,
        required: false,
        default: "image"
    }
}), "image_files");
exports.Config = mongoose_1.model("Config", new mongoose_1.Schema({
    noConnectionLogs: Boolean
}), "config");
