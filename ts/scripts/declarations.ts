import { ContextMenu } from "./structures.js";
import { Socket } from "socket.io";

export const elements = {
  login_form: $("#login-wrapper"),
  login_input: $("#username"),
  chat_form: $("#chat-wrapper"),
  chat_input: $("#chat-input"),
  chat_area: $("#chat-area"),
  dropdown: $("#dropdown"),
  user_field: $("#user"),
  edit_user_btn: $("#edit-user"),
  send_photo_btn: $("#photoBtn"),
  send_text_btn: $("#sendBtn"),
  clear_history_btn: $(".clear-history-button"),
  change_username_btn: $("#change-username"),
  clear_logs_btn: $(".clear-all-logs-button"),
  logout_btn: $("#change-username"),
  settings_window_btn: $("#toggle-settings-window"),
  settings_window: $("#settings-window"),
  photo_input: $("#photoInput")
};

export let variables: {
  currentUser: string;
  previousUser: string;
  contextMenu: ContextMenu;
} = {
  currentUser: null,
  previousUser: null,
  contextMenu: null
};

export let imageSettings: {
    transition: boolean;
    parts: string[];
    title: string;
    reset(): void;
  } = {
    transition: false,
    parts: [],
    title: null,
    reset() {
      this.parts = [];
      this.title = null;
      this.transition = false;
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
