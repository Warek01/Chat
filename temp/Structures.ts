import { longInt } from "./Types";

export class ParsedDate extends Date {
  constructor(timestamp?: longInt) {
    if (timestamp) super(timestamp);
    else super();
  }

  dateAndTime(): string {
    return (
      `${this.getDate()}.${this.getMonth()}.${this.getFullYear()}  ` +
      `${this.getHours()}:${this.getMinutes()}:${this.getSeconds()}`
    );
  }
}

export class CommandUnknown extends TypeError {
  constructor(command: string, message: string = "Unknown command: ") {
    super(message + command);
    this.name = "UnknownCommandError";
  }
}

export class ImageParsingError extends Error {
  constructor(message: string = "Image parsing error") {
    super(message);
    this.name = "ImageParsingError";
  }
}
