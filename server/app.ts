import express, { Application, Request, Response, NextFunction } from "express";
import { connect, connection, Document } from "mongoose";
import { createServer } from "http";
import chalk from "chalk";
import cors from "cors";
import path from "path";
import { TextMessage, ConnectionLog, Image } from "./models";
import { Socket, Server } from "socket.io";

const app: Application = express(),
  server = createServer(app),
  io: Server = require("socket.io")(server);

require("mongoose").Promise = global.Promise;

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

  socket.on("text_message", async (message: TextMessage) => {
    console.log(message);

    let msg = new TextMessage({
      content: message.content,
      sender: message.sender,
      timestamp: message.timestamp
    } as TextMessage);

    await msg.save().catch(function (err): void {
      console.log(chalk.hex("#e84118")(err), "Message saved");
    });

    io.sockets.emit("text_message", msg.toObject());
  });

  socket.on("connect_log", async (obj: ConnectionLog) => {
    await new ConnectionLog(obj).save().catch(logError(socket, "Connect Log"));
    socket.broadcast.emit("connect_log", obj);
  });

  socket.on("clear_history", async () => {
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
    io.sockets.emit("clear logs");
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
});

app.use(express.static(path.join(__dirname, "public")), cors());

app.get(
  "/messages",
  (req: Request, res: Response, next: NextFunction): void => {}
);

// Initialization process (message history) sending to each new connected user
app.get("/init", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const textMessages: Document[] = await TextMessage.find({}),
      connectionLogs: Document[] = await ConnectionLog.find({});
    let sorted: (TextMessage | Image | ConnectionLog)[] = sortByTimestamp([
      textMessages,
      connectionLogs
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
): (TextMessage | Image | ConnectionLog)[] {
  let allElements: (TextMessage | Image | ConnectionLog)[] = [];

  for (let arr of arrays)
    for (let element of arr) allElements.push(element.toObject());

  allElements.sort(
    (
      a: TextMessage | Image | ConnectionLog,
      b: TextMessage | Image | ConnectionLog
    ) => a.timestamp - b.timestamp
  );

  return allElements;
}
