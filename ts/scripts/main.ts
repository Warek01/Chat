import { MessageTypes as t, int, Socket } from "../Types";

const global: any = window;
const APP_TITLE = "Chat app";

const login_form = $("#login-wrapper"),
  login_input = $("#username"),
  chat_form = $("#chat-wrapper"),
  chat_input = $("#chat-input"),
  chat_area = $("#chat-area"),
  dropdown = $("#dropdown"),
  user_field = $("#user"),
  settings_window = $("#settings-window"),
  photo_input = $("#photoInput"),
  edit_user_btn = $("#edit-user"),
  send_photo_btn = $("#photoBtn"),
  send_text_btn = $("#sendBtn"),
  clear_history_btn = $("#clear-history"),
  change_username_btn = $("#change-username"),
  clear_logs_btn = $("#clear-connection-logs"),
  logout_btn = $("#change-username"),
  settings_window_btn = $("#toggle-settings-window"),
  connection_logs_switch = $("#switch-connection-logs"),
  close_settings_menu = $("#close-settings-window");

let currentUser: string = null,
  previousUser: string = null,
  contextMenu: ContextMenu = null,
  lostFocus: boolean = false,
  nrOfNotifications: number = 0,
  CONFIG: t.Config = {
    noConnectionLogs: false,
    noNotifications: false
  };

let imageSettings: {
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
    customContextMenu: boolean;
  } = {
    changeUserDropdown: false,
    settingsWindow: false,
    customContextMenu: false
  };

declare const io: Function;
const socket: Socket = io();

$(document).ready(function (event): void {
  if (document.cookie.match(/username/)) {
    currentUser = decodeURIComponent(
      (document.cookie.match(/(?<=username=)\w+/) || [""])[0]
    );

    user_field.text(currentUser);
    init();
    edit_user_btn.css("pointer-events", "all");

    socket.emit("connect_log", {
      type: "connect",
      author: currentUser,
      timestamp: Date.now()
    } as t.ConnectionLog);
  } else {
    $("#login").click(login);
    login_form.css("display", "flex");
    chat_form.hide();
    validatePreviousUserBtn();
  }
});

fetch("/config", {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache"
  }
})
  .then(res => res.json())
  .then(res => {
    CONFIG = res;
    (window as any).CONFIG = res;

    for (const [key, value] of Object.entries(CONFIG))
      if (value) $(`[data-config="${key}"]`).addClass("off");
  })
  .catch((err: Error) => {
    console.warn("Config error", err);
  });

photo_input.change(sendPhoto);
send_text_btn.click(sendMessage);
change_username_btn.click(logout);

clear_history_btn.click(e => {
  clearMsgHistory(true);
});

clear_logs_btn.click(e => {
  clearAllLogs(true);
});

edit_user_btn.click(function (event): void {
  if (!elementsActive.changeUserDropdown) {
    dropdown.show();
    $("body").children().not("header").css({
      "pointer-events": "none",
      filter: "blur(2px)"
    });
  } else {
    dropdown.hide();
    $("body").children().not("header").css({
      "pointer-events": "all",
      filter: "blur(0)"
    });
  }
  elementsActive.changeUserDropdown = !elementsActive.changeUserDropdown;
});

settings_window_btn.click(function (event): void {
  if (elementsActive.settingsWindow === false) {
    dropdown.hide();
    settings_window.show().trigger("click");
    edit_user_btn.css("pointer-events", "none");
    elementsActive.settingsWindow = true;
  }
});

close_settings_menu.click(function (event): void {
  settings_window.hide();
  elementsActive.settingsWindow = false;
  edit_user_btn.css("pointer-events", "all");
});

clear_history_btn.click(function (event): void {
  socket.emit("clear_history");
});

clear_logs_btn.click(function (event): void {
  socket.emit("clear_logs");
});

login_input.keypress(function (event): void {
  switch (event.key) {
    case "Enter":
      if ($(this).val()!.toString().trim() !== "") login();
      break;
  }
});

chat_input.on({
  keydown: function (event: KeyboardEvent): void {
    if (event.key === "Enter")
      if (event.shiftKey) {
        event.preventDefault();
        $("#sendBtn").trigger("click");
      }
  },
  focus: function (event: FocusEvent): void {
    if ($(this).val() === "  Message text  ") $(this).val("");
  },
  blur: function (event: FocusEvent): void {
    if ($(this).val() === "") $(this).val("  Message text  ");
  }
});

// Global listeners
socket
  .on("text_message", (message: t.TextMessage): void => {
    createTextMsg(message);
    if (lostFocus && !CONFIG.noNotifications) {
      nrOfNotifications++;
      notification(
        nrOfNotifications === 1
          ? `New message (${message.author})`
          : `${nrOfNotifications} new messages`
      );
    }
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
  .on("remove_edit_marks", () => {
    $(".edited-mark")
      .parent(".message-wrap")
      .css("margin-bottom", 0)
      .end()
      .remove();
  })
  .on("config_update", (config: t.Config) => {
    CONFIG = config;
    (window as any).CONFIG = config;

    for (const [key, value] of Object.entries(CONFIG))
      if (value) $(`[data-config="${key}"]`).addClass("off");
      else $(`[data-config="${key}"]`).removeClass("off");
  })
  // Image implementation
  .on("image_data", (image: t.Image) => {
    imageSettings.transition = true;
    imageSettings.id = image._id;
    imageSettings.parts = [];

    createImgMsg(image, null, true);
  })
  .on("image_part", async (image: t.Image, part: string) => {
    if (image._id === imageSettings.id) imageSettings.parts.push(part);
    else
      throw Error(`Image id error
    current id: ${imageSettings.id}; remote id: ${image._id}`);
  })
  .on("image_send_end", (data: t.Image) => {
    if (imageSettings.transition) {
      altImg(data);
      imageSettings.reset();

      if (downloadQueue.length) {
        downloadQueue.get().trigger("click");
      }
    }
  })
  .on("delete_image", (id: string) => {
    const img = findMessage(id);
    console.log(img);
    img.remove();
  });
// For local images with src
// .on("image_id", (id: string) => {
//   if (imageSettings.element) {
//     imageSettings.element.attr("ms_id", id);
//     imageSettings.element = null;
//   } else console.warn("Inexistent img element");
// });

$(window).on({
  click: function (event): void {
    if (
      elementsActive.customContextMenu &&
      !$(event.target).hasClass("context-menu")
    ) {
      contextMenu?.disable();
      return;
    }

    if (
      elementsActive.settingsWindow &&
      !elementsActive.customContextMenu &&
      $(event.target).attr("id") !== settings_window.attr("id") &&
      $(event.target).attr("id") !== settings_window.attr("id")
    )
      settings_window.trigger("click");

    if (
      elementsActive.changeUserDropdown &&
      !elementsActive.customContextMenu &&
      $(event.target).attr("id") !== "dropdown" &&
      $(event.target).parents().attr("id") !== "dropdown" &&
      $(event.target).attr("id") !== "edit-user" &&
      $(event.target).parent().attr("id") !== "edit-user"
    )
      edit_user_btn.trigger("click");
  },

  contextmenu: function (event): void {
    contextMenu?.disable();
    if (
      ($(event.target).hasClass("message-wrap") ||
        $(event.target).parents().hasClass("message-wrap")) &&
      !event.shiftKey
    ) {
      event.preventDefault();
      contextMenu = new ContextMenu(event);
    }
  },

  unload: function (event): void {
    socket.emit("connect_log", {
      type: "disconnect",
      author: currentUser,
      timestamp: Date.now()
    } as t.ConnectionLog);
  },

  // Blur & focus doesn't shoot when devtools are active
  blur: function (event): void {
    lostFocus = true;
  },

  focus: function (event): void {
    lostFocus = false;

    if (global.NT_TMOUT) {
      clearTimeout(global.NT_TMOUT);
      global.NT_TMOUT = null;

      document.title = APP_TITLE;
    }
  },

  keydown: function (event: KeyboardEvent): void {
    if (event.key === "F11") event.preventDefault();
  }
});

send_photo_btn.click(function (event: JQuery.ClickEvent): void {
  $("#photoInput").trigger("click");
});

$("button.switch").click(function (event): void {
  updateConfig($(this).data("config"));
});

$("#fullscreen").click(toggleFullscreen);

// --------------------------------------------------------------
// Functions

function toggleFullscreen(): void {
  if (!document.fullscreenEnabled) console.warn("Fullscreen is disabled");
  else if (
    (window.innerWidth === screen.width &&
      window.innerHeight === screen.height) ||
    document.fullscreenElement
  )
    document.exitFullscreen();
  else document.documentElement.requestFullscreen();
}

function notification(message: string): void {
  if (global.NT_TMOUT) {
    clearTimeout(global.NT_TMOUT);
    global.NT_TMOUT = null;
  }

  setTimeout(function changeTitle() {
    document.title = message;

    global.NT_TMOUT = setTimeout(() => {
      revertTitle(changeTitle);
    }, 1000);
  }, 500);

  function revertTitle(f: () => void): void {
    document.title = APP_TITLE;

    setTimeout(() => {
      f();
    }, 500);
  }
}

function updateConfig(data: string) {
  if (data in CONFIG)
    fetch("/config", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-cache"
      },
      body: data
    })
      .then(res => res.text())
      .then(res => console.log(`Config update; ${data}: ${res}`))
      .catch((err: Error) => {
        console.warn("Config update error", err);
      });
}

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
  if ((login_input.val() as string).trim() !== "") {
    currentUser = login_input.val() as string;
    user_field.text(currentUser);
    setCookie("username", currentUser);
    init();

    login_input.val("");

    login_form.hide();
    chat_form.show();
    edit_user_btn.css("pointer-events", "all");
    $("#login").off("click", login);
  }
  for (let message of $(".message"))
    if ($(message).find(".sender").text() === currentUser)
      $(message).addClass("sent").find(".sender").prependTo(message);

  socket.emit("connect_log", {
    type: "connect",
    author: currentUser
  } as t.ConnectionLog);
}

function logout(): void {
  console.assert(currentUser !== null, "User in null");

  socket.emit("connect_log", {
    type: "disconnect",
    author: currentUser,
    timestamp: Date.now()
  } as t.ConnectionLog);

  previousUser = currentUser;
  currentUser = null;
  setCookie("previousUser", previousUser as string);
  removeCookie("username");
  validatePreviousUserBtn();

  chat_form.hide();
  login_form.css("display", "flex");
  $("#login").click(login);

  edit_user_btn.css("pointer-events", "none");
  dropdown.hide();
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
  if (chat_input.val() !== "  Message text  ") {
    const body: t.TextMessage = {
      content: chat_input.val() as string,
      author: currentUser as string,
      timestamp: Date.now() as number
    };

    chat_input.val("");

    socket.emit("text_message", body);
  }
}

async function init(): Promise<any> {
  clearMsgHistory(false);

  let req: Response = await fetch("/init"),
    res: (t.TextMessage | t.ConnectionLog | t.Image)[] = await req.json();

  for (let em of res) {
    switch (em.object_type) {
      case "text_message":
        createTextMsg(em as t.TextMessage);
        break;
      case "connection_log":
        createConnectionLog(em as t.ConnectionLog);
        break;
      case "image":
        createImgMsg(em);
        break;
    }
  }
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
    previousUser = decodeURIComponent(
      (document.cookie.match(/(?<=previousUser=)\w+/) || [""])[0]
    );

    $(".last-user").show();
    $("#last-user-name")
      .css("display", "block")
      .text(previousUser)
      .click(function (event) {
        login_input.val(previousUser as string);
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
  return pieces;
}

// --------------------------------------------------
// Messages area

function createConnectionLog(obj: t.ConnectionLog): void {
  let container = $("<div>", { class: "connection" }),
    content = $("<p>", {
      html: `${obj.author} ${
        obj.type === "disconnect" ? "left" : "joined"
      } chat`,
      class: "username"
    });

  // if (currentUser !== obj.username)
  container
    .append(content)
    .attr("object_type", obj.object_type)
    .appendTo(chat_area);
}

function createTextMsg(message: t.TextMessage): void {
  const container = $("<div>", { class: "message-wrap" }),
    _message = $("<div>", { class: "message" });

  const content = $("<span>", {
      html: replaceWithAnchor(message.content.trim()),
      class: "content"
    }),
    sender = $("<span>", {
      html: message.author,
      class: "sender"
    }),
    date = $("<span>", {
      html: getHour(message.timestamp),
      class: "date"
    });

  if (message.author === currentUser)
    _message.append(
      $("<div>", { class: "info-wrap", html: "" }).append(sender, date),
      content
    );
  else
    _message.append(
      content,
      $("<div>", { class: "info-wrap", html: "" }).append(sender, date)
    );

  if (message.is_edited)
    container.css("margin-bottom", 20).append(
      $("<span>", {
        html: "Edited",
        class: "edited-mark"
      })
    );

  if (message.author === currentUser) container.addClass("sent");

  for (let em of content.text().split(" "))
    if (em.length > 80) {
      content.css("word-break", "break-all");
      break;
    }

  container
    .attr("ms_id", message._id as string)
    .attr("object_type", message.object_type)
    .append(_message)
    .appendTo(chat_area);
}

function createImgMsg(
  image: t.Image,
  src?: string,
  noDownload?: boolean
): JQuery {
  const msgContainer = $("<div>", { class: "message-wrap" }),
    downloadContainer = $("<div>", { class: "download-container" }),
    downloadBtn = $("<button>", {
      class: "download-btn",
      html: ""
    });

  downloadBtn
    .click(function (event): void {
      try {
        if (imageSettings.transition) {
          downloadQueue.push($(this));
        }

        imageSettings.transition = true;
        const target = $(event.target);
        let id: string;

        if (
          target.parents(".message-wrap").attr("object_type") == "image" &&
          target.parents(".message-wrap").attr("ms_id")
        )
          id = target.parents(".message-wrap").attr("ms_id");

        socket.emit("image_request", id);
        imageSettings.id = id;
      } catch (err) {
        console.warn(err);
      }
    })
    .append(
      $("<img>", {
        alt: "",
        class: "",
        html: "",
        src: "./img/download.png"
      })
    );

  if (image.author === currentUser)
    msgContainer
      .addClass("sent")
      .append(
        $("<div>", { class: "info-wrap", html: "" }).append(
          $("<span>", { class: "sender", html: image.author }),
          $("<span>", { class: "date", html: getHour(image.timestamp) })
        )
      );

  msgContainer
    .attr("ms_id", image._id)
    .attr("object_type", "image")
    .append(
      $("<img>", { class: "img-message inactive" }),

      downloadContainer.append(downloadBtn)
    )
    .appendTo(chat_area);

  if (image.author !== currentUser)
    msgContainer.append(
      $("<div>", { class: "info-wrap", html: "" }).append(
        $("<span>", { class: "sender", html: image.author }),
        $("<span>", { class: "date", html: getHour(image.timestamp) })
      )
    );

  if (src) {
    noDownload = true;
    (msgContainer
      .find(".img-message")
      .removeClass("inactive")[0] as HTMLImageElement).src = src;
    imageSettings.element = msgContainer;
  }

  if (noDownload) downloadContainer.hide();

  return msgContainer;
}

function altImg(img: t.Image): void {
  let base64 = imageSettings.parts.join("");
  const container = findMessage(img._id);
  const imgElement = container.find(".img-message")[0] as HTMLImageElement;

  if (!base64.startsWith("data:image"))
    base64 = "data:image/jpeg;base64," + base64;

  imgElement.src = base64;
  $(imgElement).attr("ready", "");

  container.find(".download-container").hide();
  $(imgElement).removeClass("inactive");

  imageSettings.reset();
}

function clearMsgHistory(clearFromDb: boolean = true): void {
  if (clearFromDb) {
    fetch("/clear")
      .then(res => res.text())
      .then(res =>
        console.log("Cleared from db:", res === "OK" ? "yes" : "no")
      );
    socket.emit("clear_history");
  }

  chat_area.children().remove();
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

function sendPhoto(): void {
  const element = $("#photoInput");

  if (imageSettings.transition)
    setTimeout(() => {
      sendPhoto();
    }, 1000);

  if ((element[0] as any).files.length > 0) {
    imageSettings.transition = true;
    const file = (element[0] as any).files[0];
    const reader = new FileReader();

    const currentImg: t.Image = {
      author: currentUser,
      timestamp: Date.now(),
      title: file.name
    };

    reader.onloadstart = function (): void {
      console.group("Image processing");
      console.log("Image processing started");
    };

    reader.onloadend = function (): void {
      console.log("Image processing done");
      console.groupEnd();
    };

    reader.onerror = function (): void {
      console.log("Image processing error");
      console.log(this.error);
      console.groupEnd();
    };

    reader.onload = function (): void {
      let base64: string = this.result?.toString();

      let separatedElement: string[] = splitToLength(base64, 10 * 2 ** 10);
      console.log("Total parts:", separatedElement.length);

      let total: number = 0;
      for (let i of separatedElement) total += i.length;
      if (total !== base64?.length) throw Error("Error in image separation");

      base64 = null;
      total = null;

      socket.emit("image_data", currentImg);

      for (let part of separatedElement) {
        socket.emit("image_part", currentImg, part);
      }

      socket.emit("image_send_end", currentImg);

      photo_input.val("");
      imageSettings.transition = false;
    };

    reader.readAsDataURL(file);
  }
}

// ---------------------------------------------
// Classes

class ContextMenu {
  private id: string;
  private menuElement: JQuery;
  private selectedElement: JQuery;
  private wrapElement: JQuery;
  private target: JQuery;
  private objectType: t.object_type;
  private contentElement: JQuery = null;

  constructor(event: JQuery.ContextMenuEvent | JQuery.ClickEvent) {
    this.disableScrolling();
    elementsActive.customContextMenu = true;

    this.target = $(event.target);

    this.menuElement = $("<div>", { class: "context-menu" });
    this.wrapElement = this.target.hasClass("message-wrap")
      ? this.target
      : this.target.parents(".message-wrap");
    this.objectType = this.wrapElement.attr("object_type") as t.object_type;
    this.id = this.wrapElement.attr("ms_id");

    this.selectedElement = this.wrapElement.find(
      this.objectType === "text_message"
        ? ".message"
        : this.wrapElement.find(".img-message").attr("ready") != null
        ? ".img-message"
        : ".download-container"
    );
    this.contentElement = this.selectedElement.find(".content");

    const copyBtn = $("<span>", { html: "Copy", class: "button-disabled" }),
      openLinkBtn = $("<span>", {
        html: "Open link here",
        class: "button-disabled"
      }),
      openLinkNewTabBtn = $("<span>", {
        html: "Open link in new tab",
        class: "button-disabled"
      }),
      editBtn = $("<span>", {
        html: "Edit",
        class: "button-disabled"
      }),
      deleteBtn = $("<span>", {
        html: "Delete",
        class: "button-disabled"
      }),
      downloadBtn = $("<a>", {
        html: "Download",
        class: "button-disabled",
        href: (this.wrapElement.find(".img-message")[0] as any)?.src,
        download: "image"
      }),
      getImageBtn = $("<span>", {
        html: "Get",
        class: "button-disabled"
      });

    copyBtn.click(e => {
      this.copyText();
    });

    openLinkBtn.click(e => {
      this.openLink();
    });

    openLinkNewTabBtn.click(e => {
      this.openLinkNewTab();
    });

    editBtn.click(e => {
      this.edit();
    });

    deleteBtn.click(e => {
      this.delete();
    });

    getImageBtn.click(e => {
      this.wrapElement.find("button").trigger("click");
      this.disable();
    });

    this.menuElement.append(
      copyBtn,
      openLinkBtn,
      openLinkNewTabBtn,
      editBtn,
      deleteBtn,
      downloadBtn,
      getImageBtn
    );

    this.menuElement.appendTo(document.body);

    setTimeout(() => {
      this.menuElement.css({
        top: (this.selectedElement.offset()?.top as number) - 35,
        left:
          (this.selectedElement.offset()?.left as number) +
          this.selectedElement.width() -
          this.menuElement.width()
      });

      this.selectedElement.css("outline", "1px dotted #8b9194");
    });

    if (this.wrapElement.hasClass("sent")) {
      this.menuElement.addClass("right-side");
      deleteBtn.removeClass("button-disabled");

      this.menuElement.css(
        "margin-left",
        -Math.abs(this.selectedElement.width()) + 10
      );
    }

    switch (this.objectType) {
      case "text_message":
        copyBtn.removeClass("button-disabled");

        if (event.target.tagName === "A") {
          openLinkBtn.removeClass("button-disabled");
          openLinkNewTabBtn.removeClass("button-disabled");
        }

        if (this.wrapElement.hasClass("sent"))
          editBtn.removeClass("button-disabled");

        break;

      case "image":
        if ($(this.wrapElement).find(".img-message").attr("ready") != null)
          downloadBtn.removeClass("button-disabled");
        else getImageBtn.removeClass("button-disabled");

        this.menuElement.css({
          left: this.selectedElement.offset()?.left as number
        });
        break;
    }
  }

  private copyText(): void {
    let tempElement = $("<input>");
    $("body").append(tempElement);
    tempElement.val(this.contentElement.text()).trigger("select");
    document.execCommand("copy");
    tempElement.remove();
  }

  private delete(): void {
    socket.emit(
      this.objectType === "text_message"
        ? "delete_text_message"
        : "delete_image",
      this.id
    );

    this.disable();
  }

  private openLink(): void {
    location.assign(this.target[0].textContent as string);
  }

  private openLinkNewTab(): void {
    window.open(this.target[0].textContent as string);
  }

  private edit(): void {
    let initilaText: string = this.contentElement.text(),
      initialHtml: string = this.contentElement.html();
    this.contentElement.attr("contenteditable", "true").trigger("focus");

    const endEdit = () => {
      if (
        this.contentElement.text().trim() != "" &&
        initilaText !== this.contentElement.text()
      )
        socket.emit("message_edit", this.id, this.contentElement.text());
      else this.contentElement.html(initialHtml);

      this.contentElement.attr("contenteditable", "false");
      this.contentElement.off("focusout", endEdit);
    };

    this.contentElement.focusout(endEdit);
  }

  private disableScrolling(): void {
    let x = chat_area[0].scrollLeft,
      y = chat_area[0].scrollTop;

    chat_area[0].onscroll = function () {
      chat_area[0].scrollTo(x, y);
    };
  }

  private enableScrolling(): void {
    chat_area[0].onscroll = function () {};
  }

  public disable(): void {
    elementsActive.customContextMenu = false;
    this.menuElement.remove();
    this.enableScrolling();
    this.selectedElement.css("outline", "none");
  }
}

// ---------- Stack ----------
class Stack<Type> {
  private data: Type[] = [];
  private firstElement: Type = null;
  private lastElement: Type = null;

  constructor() {}

  /** Add an element to the stack */
  push(obj: Type): Stack<Type> {
    if (this.data.length === 0 && !this.firstElement && !this.lastElement) {
      this.firstElement = obj;
      this.lastElement = obj;
    } else {
      this.lastElement = obj;
    }
    this.data.push(obj);
    return this;
  }

  /** Remove first element */
  pop(): Stack<Type> {
    if (this.lastElement === this.firstElement && this.data.length === 1) {
      this.firstElement = null;
      this.lastElement = null;
    } else if (this.data.length > 2) {
      this.firstElement = this.data[1];
    } else if (this.data.length === 2) {
      this.firstElement = this.lastElement;
    }

    this.data.pop();
    return this;
  }

  /** Get first element of the stack then delete it */
  get(): Type {
    if (this.data.length > 0) {
      if (this.data.length === 1) {
        this.lastElement = null;
        this.firstElement = null;
      } else if (this.data.length === 2) this.firstElement = this.lastElement;
      else this.firstElement = this.data[1];

      return this.data.shift();
    }
  }

  /** Empty stack */
  empty(): Stack<Type> {
    this.data = [];
    this.firstElement = null;
    this.lastElement = null;
    return this;
  }

  /** Stack length */
  get length(): int {
    return this.data.length;
  }
}

// ---------- Queue ----------
class Queue<Type> {
  private data: Type[] = [];

  constructor() {}

  /** Push an element to the queue */
  push(element: Type | Type[]): Queue<Type> {
    if (Array.isArray(element) && element.length > 0)
      for (let em of element) this.data.push(em);
    else this.data.push(element as Type);

    return this;
  }

  /** Get the first element of the queue and remove it */
  get(): Type | null {
    if (this.data.length > 0) return this.data.shift();
    else return null;
  }

  isEmpty(): boolean {
    return this.data.length === 0;
  }

  /** Empty queue */
  empty(): Queue<Type> {
    if (this.data.length > 0) this.data = [];

    return this;
  }

  getEach(operation: (element: Type) => void): Queue<Type> {
    while (this.length) operation(this.get());

    return this;
  }

  forEach(operation: (element: Type) => void): Queue<Type> {
    this.data.forEach(operation);
    return this;
  }

  /** Queue length */
  get length(): int {
    return this.data.length;
  }
}

// Image download queue
const downloadQueue = new Queue<JQuery>();

// temp
global.splitToLength = global.split = splitToLength;
global.setCookie = setCookie;
global.removeCookie = removeCookie;
global.clearMsgHistory = clearMsgHistory;
global.clearAllLogs = clearAllLogs;
global.contextMenu = contextMenu;

global.SOCKET = socket;
global.CONFIG = CONFIG;

global.Queue = Queue;
global.Stack = Stack;
global.nt = global.notification = notification;
