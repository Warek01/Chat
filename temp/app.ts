import express, { Application, Request, Response, NextFunction } from "express";
import { Http2Server } from "http2";
import { connect, connection, Document } from "mongoose";
require("mongoose").Promise = global.Promise;
import { createServer } from "http";
import chalk from "chalk";
import cors from "cors";
import path from "path";
import readline from "readline";
import { TextMessage, ConnectionLog, Image, Config, IPaddress } from "./models";
import { Socket, Server } from "socket.io";
import { stdin, stdout, exit as endProgram } from "process";
import {
  readFile,
  readdir,
  unlink,
  writeFile,
  appendFile,
  existsSync as exists,
} from "fs";
import { MessageTypes as t } from "./Types";
import sharp from "sharp";
import * as base64ToArrBuf from "base64-arraybuffer";
import optimist from "optimist";

// Catch global errors to append them to logs file
try {
  const app: Application = express(),
    server: Http2Server = createServer(app),
    io: Server = require("socket.io")(server);

  const IMG_PATH: string = path.join(__dirname, "saved_img");
  const argv = optimist
    .options("p", {
      alias: "port",
      describe: "Port where to run app",
      default: 8000,
    })
    .options("nologs", {
      default: true,
      alias: "no-connection-logs",
    }).argv;

  let CONFIG: t.Config = {
    noConnectionLogs: argv.nologs,
    noNotifications: false,
  };

  // Open mongodb connection
  connect("mongodb://localhost:27017/Chat", {
    useFindAndModify: true,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    numberOfRetries: 2,
  });

  Config.exists({}, async (err: Error, exists: boolean) => {
    if (err) throw err;

    if (exists) {
      Config.findOne({}).then(async (obj: Document) => {
        obj = await obj.toObject();
        CONFIG.noConnectionLogs = (obj as any).noConnectionLogs;
        CONFIG.noNotifications = (obj as any).noNotifications;
      });
    } else {
      new Config(CONFIG).save();
      console.log(
        chalk.hex("#f1c40f")("Config document not found. \nCreating a new one")
      );
    }
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
  io._connectTimeout = 10_000;
  io.on("connection", (socket: Socket): void => {
    console.log(chalk.hex("#95a5a6")("Client connected!"));

    socket.on("error", (err) => {
      console.log("Socket error");
      console.log(chalk.hex("#e84118")(err));
    });

    socket.on("text_message", async (message: t.TextMessage) => {
      const msg = new TextMessage(message);

      await msg.save().catch(function (err): void {
        console.log(chalk.hex("#e84118")(err), "Message saved");
      });

      io.sockets.emit("text_message", msg.toObject());
    });

    socket.on("connect_log", async (obj: t.ConnectionLog) => {
      if (!CONFIG.noConnectionLogs) {
        await new ConnectionLog(obj)
          .save()
          .catch(logError(socket, "Connect Log"));

        socket.broadcast.emit("connect_log", obj);
      }
    });

    socket.on("clear_history", async () => {
      if (exists(IMG_PATH))
        readdir(IMG_PATH, (err: Error, files: string[]) => {
          if (err) throw err;

          for (const fileName of files)
            unlink(path.join(IMG_PATH, fileName), (err) => {
              if (err) console.log(err);
            });
        });

      await TextMessage.deleteMany({}).catch(
        logError(socket, "Clear History, Text Messages")
      );
      await ConnectionLog.deleteMany({}).catch(
        logError(socket, "Clear History, Connection Logs")
      );
      await Image.deleteMany({}).catch(
        logError(socket, "Clear History, Images")
      );

      socket.broadcast.emit("clear_history");
    });

    socket.on("clear_logs", async () => {
      await ConnectionLog.deleteMany({}).catch(logError(socket, "Clear Logs"));
      io.sockets.emit("clear_logs");
    });

    socket.on("message_edit", async (id: string, content: string) => {
      await TextMessage.findByIdAndUpdate(id, {
        content: content,
        edited: true,
      }).catch(logError(socket, "Message Edit"));

      io.sockets.emit("message_edit", id, content);
    });

    socket.on("delete_text_message", async (id: string) => {
      await TextMessage.findByIdAndRemove(id).catch(
        logError(socket, "Delete Text Message")
      );
      io.sockets.emit("delete_text_message", id);
    });

    socket.on("remove_edit_marks", async () => {
      await TextMessage.updateMany(
        { edited: true },
        { $set: { edited: false } }
      );
      io.sockets.emit("remove_edit_marks");
    });

    // Images implementation
    let imageProcessing: boolean = false,
      parts: string[] = [],
      currentImg: t.Image;

    socket.on("image_request", async (id: string) => {
      const img = await (await Image.findById(id)).toObject();

      if (exists(path.join(IMG_PATH, img.title))) {
        imageProcessing = true;
        currentImg = img;

        readFile(
          path.join(IMG_PATH, img.title),
          { encoding: "base64" },
          (err: NodeJS.ErrnoException, data: string) => {
            if (err) throw err;
            parts = splitToLength(data, 20 * 2 ** 10);

            for (const part of parts) socket.emit("image_part", img, part);
            socket.emit("image_send_end", img);

            imageProcessing = false;
            currentImg = null;
          }
        );
      }
    });

    socket.on("image_data", async (image: t.Image) => {
      if (!imageProcessing) {
        imageProcessing = true;
        currentImg = image;
        parts = [];

        let document = (await new Image(image)
          .save()
          .catch(logError(socket, "Image Data"))) as Document;
        currentImg._id = document.toObject()._id.toString();

        io.sockets.emit("image_data", currentImg as t.Image);
      }
    });

    socket.on("image_part", async (image: t.Image, part: string) => {
      if (image.title === currentImg.title) parts.push(part);
      else if (image.title !== currentImg.title)
        throw Error("Image name error");
    });

    socket.on("image_send_end", (image: t.Image) => {
      if (imageProcessing && currentImg.title) {
        const base64 = parts.join("").replace(/^data:image\/\w*;base64,/, "");

        sharp(Buffer.from(base64ToArrBuf.decode(base64)))
          .resize(1280, 720, { fit: "outside" })
          .toFile(path.join(IMG_PATH, image.title))
          .catch((err) => {
            console.log("Error resizing file", err);
          })
          .then(() => {
            readFile(
              path.join(IMG_PATH, image.title),
              { encoding: "base64" },
              (err: Error, data: string) => {
                if (err) throw err;
                const raw: string[] = splitToLength(data, 20 * 2 ** 10);

                for (let part of raw)
                  io.sockets.emit("image_part", currentImg, part);
                io.sockets.emit("image_send_end", currentImg);

                imageProcessing = false;
                currentImg = null;
              }
            );
            parts = [];
          });
      }
    });

    socket.on("delete_image", async (id: string) => {
      const title = await (await Image.findById(id)).toObject().title;
      console.log(title);

      if (exists(path.join(IMG_PATH, title)))
        unlink(path.join(IMG_PATH, title), (err: Error) => {
          if (err) throw err;
        });

      io.sockets.emit("delete_image", id);
      Image.deleteOne({ _id: id });
    });
  });

  app.use(
    logNewClients({ writeToFile: true, writeToDb: true }),
    express.static(path.join(__dirname, "public")),
    cors()
  );

  // Initialization process (message history) sending to each new connected user
  app.get("/init", async (req: Request, res: Response, next: NextFunction) => {
    const textMessages: Document[] = await TextMessage.find({}),
      connectionLogs: Document[] = await ConnectionLog.find({}),
      images: Document[] = await Image.find({});

    let sorted: (
      | t.TextMessage
      | t.Image
      | t.ConnectionLog
    )[] = sortByTimestamp([textMessages, connectionLogs, images]);

    res.json(sorted);
  });

  app
    .route("/config")
    .get((req: Request, res: Response, next: NextFunction) => {
      try {
        res.json(CONFIG);
      } catch {
        res.sendStatus(500);
      }
    })
    .post(
      express.text({ defaultCharset: "utf-8" }),
      async (req: Request, res: Response, next: NextFunction) => {
        try {
          const body = req.body;
          CONFIG[body] = !CONFIG[body];

          if (!(body in CONFIG)) return res.end("Invalid key " + body);

          await Config.updateOne({}, CONFIG);
          io.sockets.emit("config_update", CONFIG);

          res.sendStatus(200);
        } catch (err) {
          res.sendStatus(500);
          throw err;
        }
      }
    );

  // Clear db history
  app.get("/clear", (req: Request, res: Response, next: NextFunction) => {
    try {
      Image.deleteMany({});
      TextMessage.deleteMany({});
      ConnectionLog.deleteMany({});
    } catch (err) {
      res.sendStatus(500);
      throw err;
    }
    res.sendStatus(200);
  });

  server.listen(argv.port, () => {
    console.log(`App started on port ${argv.port}`);
  });

  const rl = readline.createInterface({ input: stdin, output: stdout });
  rl.on("line", (str: string) => {
    switch (str) {
      case "":
        return;
      case "\n":
        return;
      case "cl-ip":
        IPaddress.deleteMany({}).then(() =>
          console.log(chalk.hex("#718093")("Addresses removed from db"))
        );

        if (exists(path.join(__dirname, "temp", "ip")))
          unlink(path.join(__dirname, "temp", "ip"), (err: Error) => {
            if (err) throw err;
          });
        break;
      case "cl-msg":
        TextMessage.deleteMany({}).then(() =>
          console.log(chalk.hex("#718093")("Text messages removed from db"))
        );
        break;
      case "cl-img":
        if (exists(IMG_PATH))
          readdir(IMG_PATH, (err: Error, files: string[]) => {
            if (err) throw err;

            for (const fileName of files)
              unlink(path.join(IMG_PATH, fileName), (err) => {
                if (err) console.log(err);
              });
          });

        Image.deleteMany({}).then(() =>
          console.log(chalk.hex("#718093")("Images removed from db"))
        );
        break;
      case "cl-logs":
        if (exists(path.join(__dirname, "logs.txt"))) {
          unlink(path.join(__dirname, "logs.txt"), (err: Error) => {
            if (err) throw err;
          });

          console.log("All logs removed");
        } else console.log(chalk.hex("#718093")("No logs available"));
        break;
      case "cl-cnlogs":
        ConnectionLog.deleteMany({}).then(() =>
          console.log(chalk.hex("#718093")("Connection logs removed from db"))
        );
        break;

      case "cl-all":
        if (exists(IMG_PATH))
          readdir(IMG_PATH, (err: Error, files: string[]) => {
            if (err) throw err;

            for (const fileName of files)
              unlink(path.join(IMG_PATH, fileName), (err) => {
                if (err) console.log(err);
              });
          });

        ConnectionLog.deleteMany({});
        Image.deleteMany({});
        TextMessage.deleteMany({});

        console.log(chalk.hex("#718093")("History cleared"));

        break;
      case "end":
        endProgram(0);
        break;

      default:
        throw Error(`No such command: ${str}`);
    }
  });

  function logError(
    socket: Socket | null = null,
    message: string | null = null
  ) {
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

  function splitToLength(str: string, len: number) {
    if (len > str.length) len = str.length;

    let range = new RegExp(`.{${len}}`, "g"),
      pieces = str.match(range),
      accumulated = pieces.length * len;
    if (str.length % accumulated) pieces.push(str.slice(accumulated));
    return pieces;
  }

  interface LogParams {
    writeToDb: boolean;
    writeToFile: boolean;
  }

  function logNewClients(
    params: LogParams = { writeToDb: false, writeToFile: false }
  ): (req: Request, res: Response, next: NextFunction) => void {
    return function (req: Request, res: Response, next: NextFunction): void {
      if (params.writeToFile)
        if (exists(path.join(__dirname, "temp", "ip")))
          appendFile(
            path.join(__dirname, "temp", "ip"),
            `\n\n${req.ip}  ${req.connection.remoteAddress}  ${req.headers["x-forwarded-for"]}`,
            (err: Error) => {
              if (err) throw err;
            }
          );
        else
          writeFile(
            path.join(__dirname, "temp", "ip"),
            `${req.ip}  ${req.connection.remoteAddress}  ${req.headers["x-forwarded-for"]}`,
            (err: Error) => {
              if (err) throw err;
            }
          );

      if (params.writeToDb)
        IPaddress.exists(
          {
            value: `${req.ip}  ${req.connection.remoteAddress}  ${req.headers["x-forwarded-for"]}`,
          },
          (err: Error, res: boolean) => {
            if (err) throw err;
            if (!exists)
              new IPaddress({
                value: `${req.ip}  ${req.connection.remoteAddress}  ${req.headers["x-forwarded-for"]}`,
              } as t.IPaddress).save();
          }
        );
      next();
    };
  }
} catch (err: unknown) {
  console.log(chalk.hex("#e74c3c")(err));

  const filePath = path.join(__dirname, "logs.txt");

  if (!exists(filePath))
    writeFile(filePath, String(err), () =>
      console.log("File logs.txt desnt exist. \nCreating a new one.")
    );
  else appendFile(filePath, "\n\n" + String(err), () => {});
}
