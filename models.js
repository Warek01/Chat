"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Message = void 0;
const mongoose_1 = require("mongoose");
exports.Message = mongoose_1.model("message", new mongoose_1.Schema({
    content: {
        type: String,
        required: true
    },
    sender: {
        type: String,
        required: true
    },
    date: {
        type: Number,
        required: true
    }
}), "messages");
