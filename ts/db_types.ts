export { Socket, Server } from "socket.io";
export type int = number;
export type longInt = number;
export type double = number;

export namespace MessageTypes {
  export interface TextMessage {
    content: string;
    author: string;
    timestamp: longInt;
    is_edited?: boolean;
    _id?: string;
    object_type?: object_type & "text_message";
  }

  export interface ConnectionLog {
    type: "connect" | "disconnect";
    author: string;
    timestamp: longInt;
    _id?: string;
    object_type?: object_type & "connection_log";
  }

  export interface Image {
    author: string;
    title: string;
    timestamp: longInt;
    _id?: string;
    object_type?: object_type & "image";
  }

  export interface Config {
    noConnectionLogs: boolean;
  }

  export type object_type = "text_message" | "connection_log" | "image";
}
