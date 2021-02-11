import express, { Application, Request, Response, NextFunction } from "express";
import { connect, connection, Document } from "mongoose";
import { createServer } from "http";
import chalk from "chalk";
import cors from "cors";
import path from "path";
import { TextMessage, ConnectionLog, Image } from "./models";
import { Socket, Server } from "socket.io";
import { writeFile, readFile, existsSync as exists } from "fs";
import { MessageTypes as t } from "./db_types";

const app: Application = express(),
  server = createServer(app),
  io: Server = require("socket.io")(server);

require("mongoose").Promise = global.Promise;

const saveImgPath: string = path.join(__dirname, "saved_img");

// Open mongodb connection
connect("mongodb://localhost:27017/Chat", {
  useFindAndModify: true,
  useNewUrlParser: true,
  useUnifiedTopology: true,
  numberOfRetries: 2
});

connection
  .on("open", (): void => {
    console.log(chalk.hex("#2ecc71")("Database connected!"));
  })
  .on("close", (): void => {
    console.log(chalk.hex("#1a9c74")("Database disconnected!"));
  })
  .on("error", err => {
    console.log(chalk.hex("#e84118")("Database Error: "), err);
  });

// Socket.io (websocket) connection
io.on("connection", (socket: Socket): void => {
  console.log(chalk.hex("#95a5a6")("Client connected!"));

  socket.on("error", err => {
    console.log("Socket error");
    console.log(chalk.hex("#e84118")(err));
  });

  socket.on("text_message", async (message: t.TextMessage) => {
    console.log(message);

    let msg = new TextMessage({
      content: message.content,
      sender: message.sender,
      timestamp: message.timestamp
    } as t.TextMessage);

    await msg.save().catch(function (err): void {
      console.log(chalk.hex("#e84118")(err), "Message saved");
    });

    io.sockets.emit("text_message", msg.toObject());
  });

  socket.on("connect_log", async (obj: t.ConnectionLog) => {
    await new ConnectionLog(obj).save().catch(logError(socket, "Connect Log"));
    socket.broadcast.emit("connect_log", obj);
  });

  socket.on("clear_history", async () => {
    console.log("Clearing history")
    await TextMessage.deleteMany({}).catch(
      logError(socket, "Clear History, Text Messages")
    );
    await ConnectionLog.deleteMany({}).catch(
      logError(socket, "Clear History, Connection Logs")
    );
    await Image.deleteMany({}).catch(logError(socket, "Clear History, Images"));
    socket.broadcast.emit("clear_history");
  });

  socket.on("clear_logs", async () => {
    await ConnectionLog.deleteMany({}).catch(logError(socket, "Clear Logs"));
    io.sockets.emit("clear_logs");
  });

  socket.on("message_edit", async (id: string, content: string) => {
    await TextMessage.findByIdAndUpdate(id, {
      content: content,
      edited: true
    }).catch(logError(socket, "Message Edit"));

    io.sockets.emit("message_edit", id, content);
  });

  socket.on(
    "image",
    async (rawImg: any, timestamp: number, sender: string) => {}
  );

  socket.on("delete_text_message", async (id: string) => {
    await TextMessage.findByIdAndRemove(id).catch(
      logError(socket, "Delete Text Message")
    );
    io.sockets.emit("delete_text_message", id);
  });

  socket.on("remove_edit_marks", async () => {
    await TextMessage.updateMany({ edited: true }, { $set: { edited: false } });
    io.sockets.emit("remove_edit_marks");
  });

  // Images implementation
  let imageProcessing: boolean = false;
  let currentImageName: string;
  let parts: string[] = [];
  let currentImgId: string;

  socket.on("request_image", (data: t.Image) => {});

  socket.on("image_data", async (data: t.Image) => {
    if (!imageProcessing) {
      currentImageName = data.imageName;
      imageProcessing = true;
      let document = (await new Image(data)
        .save()
        .catch(logError(socket, "Image Data"))) as Document;
      currentImgId = document.toObject()._id;
    }
  });

  socket.on("image_part", async (imageName: string, part: string) => {
    if (
      imageName === currentImageName &&
      !exists(path.join(saveImgPath, currentImageName))
    )
      parts.push(part);
    else if (imageName !== currentImageName) throw Error("Image name error");
  });

  socket.on("image_send_end", (data: t.Image) => {
    if (imageProcessing && currentImageName) {
      const base64 = parts.join("").replace(/^data:image\/\w+;base64,/, "");

      writeFile(
        path.join(saveImgPath, currentImageName),
        base64,
        { encoding: "base64" },
        () => {
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
        }
      );
    }
  });
});

app.use(express.static(path.join(__dirname, "public")), cors());

let imageProcessing: boolean = false;
app.get(
  "/getImage/:_id/:part",
  (req: Request, res: Response, next: NextFunction): void => {
    if (!imageProcessing) {
      if (Number(req.params.part) === 999) {
        imageProcessing = false;
      }
    }
  }
);

// Initialization process (message history) sending to each new connected user
app.get("/init", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const textMessages: Document[] = await TextMessage.find({}),
      connectionLogs: Document[] = await ConnectionLog.find({}),
      images: Document[] = await Image.find({});

    let sorted: (t.TextMessage | t.Image | t.ConnectionLog)[] = sortByTimestamp([
      textMessages,
      connectionLogs,
      images
    ]);

    res.json(sorted);
  } catch {
    return res.sendStatus(500);
  }
});

// Clear db history
app.get("/clear", (req: Request, res: Response, next: NextFunction) => {
  try {
    connection.dropDatabase();
  } catch {
    return res.sendStatus(500);
  }
  res.sendStatus(200);
});

server.listen(5555);

function logError(socket: Socket | null = null, message: string | null = null) {
  return function (err: Error): void {
    console.log(
      message ? chalk.hex("#f0932b")(message + ": ") : "",
      chalk.hex("#e84118")(err)
    );
    if (socket) socket.emit("error", err, message);
  };
}

function sortByTimestamp(
  arrays: Document[][]
): (t.TextMessage | t.Image | t.ConnectionLog)[] {
  let allElements: (t.TextMessage | t.Image | t.ConnectionLog)[] = [];

  for (let arr of arrays)
    for (let element of arr) allElements.push(element.toObject());

  for (let i = 0; i < allElements.length; i++)
    for (let j = i + 1; j < allElements.length; j++)
      if (allElements[i].timestamp > allElements[j].timestamp) {
        let temp = allElements[i];
        allElements[i] = allElements[j];
        allElements[j] = temp;
      }

  return allElements;
}

if (!(String as any).prototype.splitToLength) {
  (String as any).prototype.splitToLength = function (len: number) {
    if (len === undefined || len > this.length) {
      len = this.length;
    }
    var yardstick = new RegExp(`.{${len}}`, "g");
    var pieces = this.match(yardstick);
    var accumulated = pieces.length * len;
    var modulo = this.length % accumulated;
    if (modulo) pieces.push(this.slice(accumulated));
    return pieces;
  };
}
