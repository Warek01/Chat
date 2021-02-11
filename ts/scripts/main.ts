import { MessageTypes as t, int,  } from "../db_types";
import { ContextMenu, Stack, Queue } from "./structures.js";
import {
  elements,
  elementsActive,
  variables,
  imageSettings,
  socket
} from "./declarations.js";

$(document).ready(function (event): void {
  if (document.cookie.match(/username/)) {
    variables.currentUser = decodeURIComponent(
      (document.cookie.match(/(?<=username=)\w+/) || [""])[0]
    );

    elements.user_field.text(variables.currentUser);
    init();
    elements.edit_user_btn.css("pointer-events", "all");

    socket.emit("connect_log", {
      type: "connect",
      username: variables.currentUser,
      timestamp: Date.now()
    } as t.ConnectionLog);
  } else {
    $("#login").click(login);
    elements.login_form.css("display", "flex");
    elements.chat_form.hide();
  }
  validatePreviousUserBtn();
});

elements.photo_input.change(sendPhoto);
elements.send_text_btn.click(sendMessage);
elements.change_username_btn.click(logout);

elements.clear_history_btn.click(e => {
  clearMsgHistory(true);
});

elements.clear_logs_btn.click(e => {
  clearAllLogs(true);
});

elements.edit_user_btn.click(function (event): void {
  if (!elementsActive.changeUserDropdown) {
    elements.dropdown.show();
    $("body").children().not("header").css({
      "pointer-events": "none",
      filter: "blur(2px)"
    });
  } else {
    elements.dropdown.hide();
    $("body").children().not("header").css({
      "pointer-events": "all",
      filter: "blur(0)"
    });
  }
  elementsActive.changeUserDropdown = !elementsActive.changeUserDropdown;
});

elements.advanced_tab_btn.click(function (event): void {
  if (elements.advanced_tab.css("display") === "none") {
    elements.advanced_tab.show();
    elements.dropdown.css("height", 230);
  } else {
    elements.advanced_tab.hide();
    elements.dropdown.css("height", 150);
  }
  elementsActive.advancedTab = !elementsActive.advancedTab;
});

elements.login_input.keypress(function (event): void {
  switch (event.key) {
    case "Enter":
      if ($(this).val()!.toString().trim() !== "") login();
      break;
  }
});

elements.chat_input.keypress(function (event): void {
  if (event.key === "Enter")
    if (event.shiftKey)
      elements.chat_input.val(elements.chat_input.val() + "\n");
    // Nu lucreaza \n la input
    else $("#sendBtn").trigger("click");
});

// Global listeners
socket
  .on("text_message", (message: t.TextMessage): void => {
    createTextMsg(message);
  })
  .on("connect_log", (obj: t.ConnectionLog): void => {
    createConnectionLog(obj);
  })
  .on("error", (err: Error): void => {
    console.warn("Socket Error: ", err);
  })
  .on("clear_history", () => {
    clearMsgHistory(false);
  })
  .on("reload", () => {
    location.reload();
  })
  .on("message_edit", (id: string, content: string) => {
    let message = findMessage(id);
    if (message?.find("edited-mark")?.length === 0) {
      message
        .find(".content")
        .html(replaceWithAnchor(content))
        .end()
        .css("margin-bottom", 20)
        .prepend(
          $("<span>", {
            html: "Edited",
            class: "edited-mark"
          })
        );
    } else throw new Error(`Message with id "${id}" not found`);
  })
  .on("clear_logs", () => {
    $(".connection").remove();
  })
  .on("delete_text_message", (id: string) => {
    let message = findMessage(id);
    if (message) message.remove();
    else throw new Error(`Message with id "${id}" not found`);
  })
  .on("image", (image: t.Image) => {
    createImg(image, null);
  })
  .on("remove_edit_marks", () => {
    $(".edited-mark")
      .parent(".message-wrap")
      .css("margin-bottom", 0)
      .end()
      .remove();
  })
  // Image implementation
  .on("image_data", (data: t.Image) => {
    if (!imageSettings.transition) {
      imageSettings.currentName = data.imageName;
      imageSettings.transition = true;
    }
  })
  .on("image_part", async (imageName: string, part: string) => {
    if (imageName === imageSettings.currentName) imageSettings.parts.push(part);
    else throw Error("Image name error");
  })
  .on("image_send_end", (data: t.Image, id: string) => {
    if (imageSettings.transition) {
      createImg(data, id);
      imageSettings.transition = false;
    }
  });

$(window).on({
  click: function (event): void {
    if (
      elementsActive.userContextMenu &&
      !$(event.target).hasClass("context-menu")
    ) {
      variables.contextMenu?.disable();
      return;
    }

    if (
      elementsActive.advancedTab &&
      !elementsActive.userContextMenu &&
      $(event.target).attr("id") !== elements.advanced_tab.attr("id") &&
      $(event.target).attr("id") !== elements.advanced_tab_btn.attr("id")
    )
      elements.advanced_tab_btn.trigger("click");

    if (
      elementsActive.changeUserDropdown &&
      !elementsActive.userContextMenu &&
      $(event.target).attr("id") !== "dropdown" &&
      $(event.target).parents().attr("id") !== "dropdown" &&
      $(event.target).attr("id") !== "edit-user" &&
      $(event.target).parent().attr("id") !== "edit-user"
    )
      elements.edit_user_btn.trigger("click");
  },

  contextmenu: function (event): void {
    variables.contextMenu?.disable();
    if (
      ($(event.target).hasClass("message") ||
        $(event.target).parents().hasClass("message")) &&
      !event.shiftKey
    ) {
      event.preventDefault();
      variables.contextMenu = new ContextMenu(event);
    }
  },

  unload: function (event): void {
    socket.emit("connect_log", {
      type: "disconnect",
      username: variables.currentUser,
      timestamp: Date.now()
    } as t.ConnectionLog);
  }
});

elements.send_photo_btn.click(function (event: JQuery.ClickEvent): void {
  const imgInput = $("#photoInput");

  imgInput.trigger("click");
});

// --------------------------------------------------------------
// Functions

function removeCookie(cookie: string): string {
  document.cookie = `${encodeURIComponent(cookie)}=0; max-age=0`;
  return cookie;
}

function setCookie(key: string, value: string): string {
  document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(
    value
  )}; max-age=999999999`;
  return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

function login(): void {
  if ((elements.login_input.val() as string).trim() !== "") {
    variables.currentUser = elements.login_input.val() as string;
    elements.user_field.text(variables.currentUser);
    setCookie("username", variables.currentUser);
    init();

    elements.login_input.val("");

    elements.login_form.hide();
    elements.chat_form.show();
    elements.edit_user_btn.css("pointer-events", "all");
    $("#login").off("click", login);
  }
  for (let message of $(".message"))
    if ($(message).find(".sender").text() === variables.currentUser)
      $(message).addClass("sent").find(".sender").prependTo(message);

  socket.emit("connect_log", {
    type: "connect",
    username: variables.currentUser
  } as t.ConnectionLog);
}

function logout(): void {
  console.assert(variables.currentUser !== null, "User in null");

  socket.emit("connect_log", {
    type: "disconnect",
    username: variables.currentUser,
    timestamp: Date.now()
  } as t.ConnectionLog);

  variables.previousUser = variables.currentUser;
  variables.currentUser = null;
  setCookie("previousUser", variables.previousUser as string);
  removeCookie("username");
  validatePreviousUserBtn();

  elements.chat_form.hide();
  elements.login_form.css("display", "flex");
  $("#login").click(login);

  elements.edit_user_btn.css("pointer-events", "none");
  elements.dropdown.hide();
  $("body").children().not("header").css({
    "pointer-events": "all",
    filter: "blur(0)"
  });
  elementsActive.changeUserDropdown = false;

  for (let message of $(".message.sent")) {
    $(message).removeClass("sent").find(".sender").appendTo(message);
  }
}

function sendMessage(): void {
  if (elements.chat_input.val()!.toString().trim() !== "") {
    const body: t.TextMessage = {
      content: elements.chat_input.val() as string,
      sender: variables.currentUser as string,
      timestamp: Date.now() as number
    };

    elements.chat_input.val("");

    socket.emit("text_message", body);
  }
}

async function init(): Promise<any> {
  clearMsgHistory(false);
  const stack = new Stack<t.Image>();

  let req: Response = await fetch("/init"),
    res: (t.TextMessage | t.ConnectionLog | t.Image)[] = await req.json();

  for (let em of res) {
    switch (em.name) {
      case "text_message":
        createTextMsg(em as t.TextMessage);
        break;
      case "connection_log":
        createConnectionLog(em as t.ConnectionLog);
        break;
      case "image":
        stack.push(em as t.Image);
        break;
    }
  }
  requestImages(stack);
}

// https://stackoverflow.com/questions/8667070/javascript-regular-expression-to-validate-url
function validateUrl(value: string): boolean {
  return /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:[/?#]\S*)?$/i.test(
    value
  );
}

function replaceWithAnchor(content: string) {
  let exp_match = /(\b(https?|):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|\\])/gi,
    element_content = content.replace(exp_match, "<a href='$1'>$1</a>"),
    new_exp_match = /(^|[^\/])(www\.[\S]+(\b|$))/gim,
    new_content = element_content.replace(
      new_exp_match,
      '$1<a target="_blank" href="http://$2">$2</a>'
    );
  return new_content;
}

function findMessage(id: string): JQuery | null {
  for (let message of $(".message-wrap"))
    if ($(message).attr("ms_id") === id) return $(message);
  return null;
}

function validatePreviousUserBtn(): void {
  if (document.cookie.match(/previousUser/)) {
    variables.previousUser = decodeURIComponent(
      (document.cookie.match(/(?<=previousUser=)\w+/) || [""])[0]
    );

    $(".last-user").show();
    $("#last-user-name")
      .css("display", "block")
      .text(variables.previousUser)
      .click(function (event) {
        elements.login_input.val(variables.previousUser as string);
        login();
      });
  } else $(".last-user").hide();
}

function splitToLength(str: string, len: number) {
  if (len === undefined || len > str.length) {
    len = str.length;
  }
  var yardstick = new RegExp(`.{${len}}`, "g");
  var pieces = str.match(yardstick);
  var accumulated = pieces.length * len;
  var modulo = str.length % accumulated;
  if (modulo) pieces.push(str.slice(accumulated));
  console.log(pieces.length)
  return pieces;
}

// --------------------------------------------------
// Messages area

function createConnectionLog(obj: t.ConnectionLog): void {
  let container = $("<div>", { class: "connection" }),
    content = $("<p>", {
      html: `${obj.username} ${
        obj.type === "disconnect" ? "left" : "joined"
      } chat`,
      class: "username"
    });

  // if (currentUser !== obj.username)
  container.append(content).appendTo(elements.chat_area);
}

function createTextMsg(message: t.TextMessage): void {
  let container = $("<div>", { class: "message-wrap" }),
    _message = $("<div>", { class: "message" });

  let content = $("<span>", {
      html: replaceWithAnchor(message.content.trim()),
      class: "content"
    }),
    sender = $("<span>", {
      html: message.sender,
      class: "sender"
    }),
    date = $("<span>", {
      html: getHour(message.timestamp),
      class: "date"
    });

  if (message.sender === variables.currentUser) {
    _message.append(sender, date, content);
  } else {
    _message.append(content, sender, date);
  }

  if (message.edited) {
    let editContainer = $("<span>", {
      html: "Edited",
      class: "edited-mark"
    });

    container.css("margin-bottom", 20).append(editContainer);
  }

  if (message.sender === variables.currentUser) container.addClass("sent");

  container.attr("ms_id", message._id as string);
  container.append(_message);
  elements.chat_area.append(container);
}

function createImg(image: t.Image, base64?: string): void {
  let container = $("<div>", {
    class: "message-wrap"
  });

  if (imageSettings.parts.length > 0 && image._id !== null) {
    const base64 = imageSettings.parts.join("");

    let imageElement = new Image();
    imageElement.src = base64;
    imageElement.className = "img-message";

    container.append(imageElement);

    imageSettings.parts = [];
    imageSettings.currentName = null;
  } else {
  }

  $("body").append(container);
}

function clearMsgHistory(clearFromDb: boolean = true): void {
  if (clearFromDb) {
    fetch("/clear")
      .then(res => res.text())
      .then(res => console.log(res));
    socket.emit("clear_history");
  }

  elements.chat_area.children().remove();
}

function removeEditMarks(): void {
  socket.emit("remove_edit_marks");
}

function clearAllLogs(clearFromDb: boolean = true): void {
  if (clearFromDb) socket.emit("clear_logs");
  else $(".connection").remove();
}

function getHour(timestamp: number): string {
  return `${new Date(timestamp).getHours()}:${
    new Date(timestamp).getMinutes().toString().length === 1
      ? new Date(timestamp).getMinutes() + "0"
      : new Date(timestamp).getMinutes()
  }`;
}

async function sendPhoto(): Promise<any> {
  const element = $("#photoInput");
  if (imageSettings.transition) return;

  if ((element[0] as any).files.length > 0) {
    imageSettings.transition = true;
    const file = (element[0] as any).files[0];
    const reader = new FileReader();

    const fileName = file.name;
    const fileSender = variables.currentUser;
    const fileTimestamp = Date.now();

    reader.onloadstart = function () {
      console.log("Image processing started");
    };

    reader.onloadend = function () {
      console.log("Image processing done");
    };

    reader.onload = function () {
      let base64: string = this.result?.toString();

      let separatedElement: string[] = splitToLength(base64, 5000);

      let total: number = 0;
      for (let i of separatedElement) total += i.length;
      if (total !== base64?.length) throw Error("Error in image separation");

      base64 = null;
      total = null;

      socket.emit("image_data", {
        imageName: fileName,
        sender: fileSender,
        timestamp: fileTimestamp
      } as t.Image);

      for (let part of separatedElement) {
        socket.emit("image_part", fileName, part);
      }

      socket.emit("image_send_end", {
        imageName: fileName,
        timestamp: fileTimestamp,
        sender: fileSender
      } as t.Image);
    };

    reader.readAsDataURL(file);
  }
}

async function requestImages(stack: Stack<t.Image>): Promise<any> {
  while (stack.length) {
    const current: t.Image = stack.get();

    let index: number = 0;
    let parts: string[] = [];

    while (parts.length <= 1000) {
      let req = await fetch(`/getImage/${current._id}/${index}`, {
        method: "GET",
        headers: {
          "Content-Type": "text/plain",
          "Cache-Control": "no-cache"
        }
      });

      let res = await req.text();
      parts.push(res);
    }

    let raw: string = parts.join("");
    createImg(current, raw);
  }
}
