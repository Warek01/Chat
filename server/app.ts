import express, { Application, Request, Response, NextFunction } from "express";
import { connect, connection } from "mongoose";
import { createServer } from "http";
import chalk from "chalk";
import cors from "cors";
import path from "path";
import { Message, MessageBody } from "./models";

const app: Application = express(),
  server = createServer(app),
  io = require("socket.io")(server);

// Open mongodb connection
connect("mongodb://localhost:27017/Chat", {
  useFindAndModify: true,
  useNewUrlParser: true,
  useUnifiedTopology: true,
  numberOfRetries: 1
});

connection
  .on("open", (): void => {
    console.log(chalk.hex("#2ecc71")("Database connected!"));
  })
  .on("close", (): void => {
    console.log(chalk.hex("#1a9c74")("Database disconnected!"));
  })
  .on("error", (err) => {
    console.log(chalk.hex("#e84118")("Database Error: "), err);
  });

// Socket.io (websocket) connection
io.on("connection", (socket: any): void => {
  console.log(chalk.hex("#95a5a6")("Client connected!"));

  socket.on("message", (message: MessageBody): void => {
    console.log(message);
    socket.broadcast.emit("message", message);

    new Message({
      content: message.content,
      sender: message.sender,
      timestamp: message.timestamp
    }).save();
  });

  socket.on("user disconnected", (user: string): void => {
    io.sockets.emit("user disconnected", user);
  });

  socket.on("user connected", (user: string): void => {
    io.sockets.emit("user connected", user);
  });
});

app.use(express.static(path.join(__dirname, "public")), cors());

app.get(
  "/messages",
  (req: Request, res: Response, next: NextFunction): void => {}
);

app.get("/init", async (req: Request, res: Response, next: NextFunction) => {
  let tasks = await Message.find({});
  res.json(JSON.stringify(tasks));
});

app.get("/clear", (req: Request, res: Response, next: NextFunction) => {
  try {
    connection.dropCollection("messages");
  } catch {
    return res.sendStatus(500);
  }
  res.sendStatus(200);
});

server.listen(5550);
