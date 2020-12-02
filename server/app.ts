import express, { Application, Request, Response, NextFunction } from "express";
import { connect, connection } from "mongoose";
import { createServer } from "http";
import chalk from "chalk";
import cors from "cors";
import path from "path";
import { Message } from "./models";

const app: Application = express(),
  server = createServer(app),
  io = require("socket.io")(server);

// Open mongodb connection
connect("mongodb://localhost:27017/Chat", {
  useFindAndModify: true,
  useNewUrlParser: true,
  useUnifiedTopology: true
});

connection.on("open", (): void => {
  console.log(chalk.hex("#2ecc71")("Database connected!"));
}).on("close", (): void => {
  console.log(chalk.hex("#1a9c74")("Database disconnected!"));
});

// Socket.io (websocket) connection
io.on("connection", socket => {
  console.log(chalk.hex("#95a5a6")("Client connected!"));

  socket.on("message", message => {
    /*  */
  });
});

app.use(express.static(path.join(__dirname, "public")));

app.route("/messages").get((req: Request, res: Response, next: NextFunction): void => {

});

server.listen(8000, (): void => {
  console.log();
});
