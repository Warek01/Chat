import { ContextMenu, Queue } from "./structures.js";
import { MessageTypes as t } from "../db_types";
import { Socket } from "socket.io";

export const global: any = window;
export const APP_TITLE = "Chat app";

export const elements = {
  login_form: $("#login-wrapper"),
  login_input: $("#username"),
  chat_form: $("#chat-wrapper"),
  chat_input: $("#chat-input"),
  chat_area: $("#chat-area"),
  dropdown: $("#dropdown"),
  user_field: $("#user"),
  settings_window: $("#settings-window"),
  photo_input: $("#photoInput"),

  buttons: {
    edit_user: $("#edit-user"),
    send_photo: $("#photoBtn"),
    send_text: $("#sendBtn"),
    clear_history: $("#clear-history"),
    change_username: $("#change-username"),
    clear_logs: $("#clear-connection-logs"),
    logout: $("#change-username"),
    settings_window: $("#toggle-settings-window"),
    connection_logs_switch: $("#switch-connection-logs"),
    close_settings_menu: $("#close-settings-window")
  }
};

export let variables: {
  currentUser: string;
  previousUser: string;
  contextMenu: ContextMenu;
  lostFocus: boolean;
  nrOfNotifications: number;
  CONFIG: t.Config;
} = {
  currentUser: null,
  previousUser: null,
  contextMenu: null,
  lostFocus: false,
  nrOfNotifications: 0,
  CONFIG: {
    noConnectionLogs: false,
    noNotifications: false
  }
};

export let imageSettings: {
    transition: boolean;
    parts: string[];
    title: string;
    id: string;
    element: JQuery;
    reset(): void;
  } = {
    transition: false,
    parts: [],
    title: null,
    id: null,
    element: null,
    reset() {
      this.parts = [];
      this.title = null;
      this.transition = false;
      this.id = null;
      // this.element = null;
    }
  },
  elementsActive: {
    changeUserDropdown: boolean;
    settingsWindow: boolean;
    userContextMenu: boolean;
  } = {
    changeUserDropdown: false,
    settingsWindow: false,
    userContextMenu: false
  };

declare const io: Function;
export const socket: Socket = io();
