export type int = number;
export type longInt = number;
export type double = number;

export namespace MessageTypes {
  export interface TextMessage {
    content: string;
    sender: string;
    timestamp: longInt;
    type?: string;
    edited?: boolean;
    _id?: string;
    name?: string;
  }

  export interface ConnectionLog {
    type: string;
    username: string;
    timestamp: longInt;
    _id?: string;
    name?: string;
  }

  export interface Image {
    sender: string;
    imageName: string;
    timestamp: longInt;
    _id?: string;
    name?: string;
  }

  export interface Config {
    noConnectionLogs: boolean;
  }
}
