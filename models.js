"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = exports.Image = exports.ConnectionLog = exports.TextMessage = void 0;
const mongoose_1 = require("mongoose");
exports.TextMessage = mongoose_1.model("Text Message", new mongoose_1.Schema({
    content: {
        type: String,
        required: true
    },
    author: {
        type: String,
        required: true
    },
    timestamp: {
        type: Number,
        required: true
    },
    is_edited: {
        type: Boolean,
        default: false,
        required: false
    },
    object_type: {
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
    author: {
        type: String,
        required: true
    },
    timestamp: {
        type: Number,
        required: true
    },
    object_type: {
        type: String,
        required: false,
        default: "connection_log"
    }
}), "connection_logs");
exports.Image = mongoose_1.model("Image File", new mongoose_1.Schema({
    author: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    timestamp: {
        type: Number,
        required: true
    },
    object_type: {
        type: String,
        required: false,
        default: "image"
    }
}), "image_files");
exports.Config = mongoose_1.model("Config", new mongoose_1.Schema({
    noConnectionLogs: Boolean
}), "config");
