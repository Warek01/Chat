import express, { Application, Request, Response, NextFunction } from "express";
import { connect, connection } from "mongoose";
import { createServer } from "http";
import chalk from "chalk";
import cors from "cors";
import path from "path";
import * as models from "./models";
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

  socket.on("message", async (message: models.MessageBody) => {
    console.log(message);
    
    let msg = new models.Message({
      content: message.content,
      sender: message.sender,
      timestamp: message.timestamp
    });
    
    await msg.save().catch(function (err): void {
      console.log(chalk.hex("#e84118")(err), "Message saved");
    });
    
    io.sockets.emit("message", msg.toObject());
  });

  socket.on("user disconnected", (userName: string): void => {
    socket.broadcast.emit("user disconnected", userName);
    new models.Message({
      sender: userName,
      type: "disconnected"
    })
      .save()
      .catch(function (err): void {
        console.log(chalk.hex("#e84118")(err), "User disconnected");
      });
  });

  socket.on("user connected", (userName: string): void => {
    socket.broadcast.emit("user connected", userName);
    new models.Message({
      sender: userName,
      type: "connected"
    })
      .save()
      .catch(err => {
        console.log(chalk.hex("#e84118")(err), "User connected");
      });
  });

  socket.on("clear history", () => {
    socket.broadcast.emit("clear history");
  });

  socket.on("clear logs", async () => {
    await models.Message.deleteMany({ type: "disconnected" });
    await models.Message.deleteMany({ type: "connected" });

    io.sockets.emit("clear logs");
  });

  socket.on("message edit", async (id: string, content: string) => {
    console.log(id, content);
    await models.Message.findByIdAndUpdate(id, {
      content: content,
      edited: true
    }).catch(err => {
      console.log(chalk.hex("#e84118")(err), "Message edit");
      socket.emit("error", err);
    });

    io.sockets.emit("message edit", id, content);
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
    const messages = await models.Message.find({});
    res.json(JSON.stringify(messages));
  } catch {
    return res.sendStatus(500);
  }
});

// Clear db history
app.get("/clear", (req: Request, res: Response, next: NextFunction) => {
  try {
    connection.dropCollection("messages");
  } catch {
    return res.sendStatus(500);
  }
  res.sendStatus(200);
});

server.listen(5550);
