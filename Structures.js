"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageParsingError = exports.CommandUnknown = exports.ParsedDate = void 0;
class ParsedDate extends Date {
    constructor(timestamp) {
        if (timestamp)
            super(timestamp);
        else
            super();
    }
    dateAndTime() {
        return (`${this.getDate()}.${this.getMonth()}.${this.getFullYear()}  ` +
            `${this.getHours()}:${this.getMinutes()}:${this.getSeconds()}`);
    }
}
exports.ParsedDate = ParsedDate;
class CommandUnknown extends TypeError {
    constructor(command, message = "Unknown command: ") {
        super(message + command);
        this.name = "UnknownCommandError";
    }
}
exports.CommandUnknown = CommandUnknown;
class ImageParsingError extends Error {
    constructor(message = "Image parsing error") {
        super(message);
        this.name = "ImageParsingError";
    }
}
exports.ImageParsingError = ImageParsingError;
