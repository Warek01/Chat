declare const io: Function;
const socket = io();

const login_form: JQuery = $("#login-wrapper"),
  login_input: JQuery = $("#username"),
  chat_form: JQuery = $("#chat-wrapper"),
  chat_input: JQuery = $("#chat-input"),
  chat_area: JQuery = $("#chat-area"),
  dropdown: JQuery = $("#dropdown"),
  user_field: JQuery = $("#user"),
  edit_user_btn: JQuery = $("#edit-user"),
  logout_btn: JQuery = $("#change-username"),
  advanced_tab_btn: JQuery = $("#toggle-advanced-tab"),
  advanced_tab: JQuery = $("#advanced-tab");

let currentUser: string | null,
  previousUser: string | null,
  contextMenu: ContextMenu | null,
  elementsActive: {
    changeUserDropdown: boolean;
    advancedTab: boolean;
    userContextMenu: boolean;
  } = {
    changeUserDropdown: false,
    advancedTab: false,
    userContextMenu: false
  };

$(document).ready(function (event): void {
  if (document.cookie.match(/username/)) {
    currentUser = decodeURIComponent(
      (document.cookie.match(/(?<=username=)\w+/) || [""])[0]
    );

    user_field.text(currentUser);
    init();
    edit_user_btn.css("pointer-events", "all");
    socket.emit("user connected", currentUser);
  } else {
    $("#login").click(login);
    login_form.css("display", "flex");
    chat_form.hide();
  }
  validatePreviousUserBtn();
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

advanced_tab_btn.click(function (event): void {
  if (advanced_tab.css("display") === "none") {
    advanced_tab.show();
    dropdown.css("height", 230);
  } else {
    advanced_tab.hide();
    dropdown.css("height", 150);
  }
  elementsActive.advancedTab = !elementsActive.advancedTab;
});

login_input.keypress(function (event): void {
  switch (event.key) {
    case "Enter":
      if ($(this).val()!.toString().trim() !== "") login();
      break;
  }
});

chat_input.keypress(function (event): void {
  if (event.key === "Enter")
    if (event.shiftKey) chat_input.val(chat_input.val() + "\n");
    // Nu lucreaza \n la input
    else $("#sendBtn").trigger("click");
});

// Global listeners
socket
  .on("message", (message: MessageBody): void => {
    createMessage(message);
  })
  .on("message id", (id: string) => {
    for (let message of $(".message-wrap")) {
      if (!$(message).attr("ms_id")) {
        $(message).attr("ms_id", id);
        break;
      }
    }
  })
  .on("user connected", (user: string): void => {
    createConnectionMessage(user);
  })
  .on("user disconnected", (user: string): void => {
    createConnectionMessage(user, true);
  })
  .on("error", (err: Error): void => {
    console.warn("Socket Error: ", err);
  })
  .on("clear history", () => {
    clearMessagehistory(false);
  })
  .on("reload", () => {
    location.reload();
  })
  .on("message edit", (id: string, content: string) => {
    for (let message of $(".message-wrap"))
      if ($(message).attr("ms_id") === id) {
        console.log(message);
        $(message)
          .find(".content")
          .text(content)
          .css("margin-bottom", 10)
          .append(
            $("<span>", {
              html: "Edited",
              class: "edited-mark"
            })
          );

        break;
      }
  })
  .on("clear logs", () => {
    $(".connection").remove();
  });

$(window).on({
  click: function (event): void {
    if (
      elementsActive.userContextMenu &&
      !$(event.target).hasClass("context-menu")
    ) {
      contextMenu?.disable();
      return;
    }

    if (
      elementsActive.advancedTab &&
      !elementsActive.userContextMenu &&
      $(event.target).attr("id") !== advanced_tab.attr("id") &&
      $(event.target).attr("id") !== advanced_tab_btn.attr("id")
    )
      advanced_tab_btn.trigger("click");

    if (
      elementsActive.changeUserDropdown &&
      !elementsActive.userContextMenu &&
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
      ($(event.target).hasClass("message") ||
        $(event.target).parents().hasClass("message")) &&
      !event.shiftKey
    ) {
      event.preventDefault();
      contextMenu = new ContextMenu(event);
    }
  },

  unload: function (event): void {
    socket.emit("user disconnected", currentUser);
  }
});

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

  socket.emit("user connected", currentUser);
}

function logout(): void {
  console.assert(currentUser !== null, "User in null");

  socket.emit("user disconnected", currentUser);
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
  if (chat_input.val()!.toString().trim() !== "") {
    const body: MessageBody = {
      content: chat_input.val() as string,
      sender: currentUser as string,
      timestamp: Date.now() as number
    };

    chat_input.val("");

    socket.emit("message", body);
  }
}

function init(): void {
  clearMessagehistory(false);

  fetch("/init")
    .then(res => res.json())
    .then(res => {
      for (const message of JSON.parse(res)) {
        if (message.type === "message") createMessage(message);
        else if (message.type === "connected")
          createConnectionMessage(message.sender);
        else if (message.type === "disconnected")
          createConnectionMessage(message.sender, true);
      }
    });
}

// https://stackoverflow.com/questions/8667070/javascript-regular-expression-to-validate-url
function validateUrl(value: string): boolean {
  return /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:[/?#]\S*)?$/i.test(
    value
  );
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

// Messages area
interface MessageBody {
  content: string;
  sender: string;
  timestamp: number;
  type?: string;
  _id?: string | number;
  edited?: boolean;
}

function createConnectionMessage(
  name: string,
  dissconected: boolean = false
): void {
  let container = $("<div>", { class: "connection" }),
    content = $("<p>", {
      html: `${name} ${dissconected ? "left" : "joined"} chat`,
      class: "username"
    });

  if (currentUser !== name) container.append(content).appendTo(chat_area);
}

function createMessage(message: MessageBody): void {
  let container = $("<div>", { class: "message-wrap" }),
    _message = $("<div>", { class: "message" }),
    content,
    sender = $("<span>", {
      html: message.sender,
      class: "sender"
    });

  if (validateUrl(message.content)) {
    content = $("<a>", {
      html: message.content.trim(),
      class: "content",
      href: message.content,
      target: "_blank"
    });
  } else {
    content = $("<span>", {
      html: message.content.trim(),
      class: "content"
    });
  }

  if (message.sender === currentUser) {
    container.addClass("sent");
    _message.append(sender, content);
  } else {
    _message.append(content, sender);
  }

  container.append(_message);
  chat_area.append(container);
  container.attr("ms_id", message._id as string);
  console.log(message);

  if (message.edited) {
    let editContainer = $("<span>", {
      html: "Edited",
      class: "edited-mark"
    });

    container.css("margin-bottom", 10).append(editContainer);
  }
}

function clearMessagehistory(clearFromDb: boolean = true): void {
  if (clearFromDb) {
    fetch("/clear")
      .then(res => res.text)
      .then(res => console.log(res));
    socket.emit("clear history");
  }

  chat_area.children().remove();
}

function clearAllLogs(clearFromDb: boolean = true): void {
  if (clearFromDb) socket.emit("clear logs");
  else $(".connection").remove();
}

// Custom context menu
class ContextMenu {
  public posX: number;
  public posY: Number;
  private menuElement: JQuery;
  private selectedElement: JQuery;
  private wrapElement: JQuery;
  private contentElement: JQuery;

  constructor(event: JQuery.ContextMenuEvent | JQuery.ClickEvent) {
    this.posX = event.clientX;
    this.posY = event.clientY;

    if ($(event.target).hasClass("message"))
      this.selectedElement = $(event.target);
    else this.selectedElement = $(event.target).parents(".message");
    this.contentElement = this.selectedElement.find(".content");

    elementsActive.userContextMenu = true;

    this.menuElement = $("<div>", { class: "context-menu" });
    this.wrapElement = this.selectedElement.parent(".message-wrap");

    let copyBtn = $("<span>", { html: "Copy" }),
      openLinkBtn = $("<span>", { html: "Open link here" }),
      openLinkNewTabBtn = $("<span>", { html: "Open link in new tab" }),
      editBtn = $("<span>", { html: "Edit" });

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

    if (this.contentElement[0].tagName !== "A") {
      openLinkBtn.addClass("button-disabled");
      openLinkNewTabBtn.addClass("button-disabled");
    }

    if (!this.wrapElement.hasClass("sent")) editBtn.addClass("button-disabled");

    this.menuElement
      .append(copyBtn, openLinkBtn, openLinkNewTabBtn, editBtn)
      .css({
        top: (this.posY as number) - 35,
        left: (this.posX as number) - 15
      })
      .appendTo($("body"));

    if (this.wrapElement.hasClass("sent")) {
      this.menuElement
        .addClass("right-side")
        .css("left", (this.posX as number) - 283);
    }
  }

  copyText(): void {
    let tempElement = $("<input>");
    $("body").append(tempElement);
    tempElement.val(this.contentElement.text()).trigger("select");
    document.execCommand("copy");
    tempElement.remove();
  }

  openLink(): void {
    location.assign(this.contentElement.text());
  }

  openLinkNewTab(): void {
    window.open(this.contentElement.text());
  }

  edit(): void {
    this.contentElement.attr("contenteditable", "true").trigger("focus");

    const endEdit = () => {
      if (this.contentElement.text().trim() != "") {
        socket.emit(
          "message edit",
          this.wrapElement.attr("ms_id")?.toString(),
          this.contentElement.text().trim()
        );
        this.contentElement.attr("contenteditable", "false");

        this.contentElement.off("focusout", endEdit);
      }
    };

    this.contentElement.focusout(endEdit);
  }

  disable(): void {
    elementsActive.userContextMenu = false;
    this.menuElement.remove();
  }
}
