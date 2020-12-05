declare const io: Function;

const login_form: JQuery = $("#login-wrapper"),
  login_input: JQuery = $("#username"),
  chat_form: JQuery = $("#chat-wrapper"),
  chat_input: JQuery = $("#chat-input"),
  chat_area: JQuery = $("#chat-area"),
  dropdown: JQuery = $("#dropdown"),
  user_field: JQuery = $("#user"),
  edit_user_btn: JQuery = $("#edit-user"),
  logout_btn: JQuery = $("#change-username");

const socket = io("http://83.218.206.8:12345");

let currentUser: string | null;

$(document).ready(function (event): void {
  if (document.cookie.match(/username/)) {
    currentUser = decodeURIComponent(
      (document.cookie.match(/(?<=username=)\w+;?/) || [""])[0]
    );
    user_field.text(currentUser);

    init();

    socket.emit("user connected", currentUser);
  } else {
    $("#login").click(login);
    login_form.css("display", "flex");
    chat_form.hide();
  }
});

edit_user_btn.click(function (event): void {
  dropdown.show();
});

login_input.keypress(function (event): void {
  switch (event.key) {
    case "Enter":
      if ($(this).val()!.toString().trim() !== "") login();
      break;
  }
});

chat_input.keypress(function (event): void {
  if (event.key === "Enter") $("#sendBtn").trigger("click");
});

$(window)
  .keydown(function (event): void {})
  .click(function (event): void {
    if (
      dropdown.css("display") !== "none" &&
      $(event.target).attr("id") !== "dropdown" &&
      $(event.target).parent().attr("id") !== "dropdown" &&
      $(event.target).attr("id") !== "edit-user" &&
      $(event.target).parent().attr("id") !== "edit-user"
    ) {
      dropdown.hide();
    }
  });

socket
  .on("message", (message: MessageBody): void => {
    createMessage(message);
  })
  .on("user connected", (user: string): void => {
    createConnectionMessage(user);
  })
  .on("user disconnected", (user: string): void => {
    createConnectionMessage(user, true);
  })
  .on("error", (err: Error): void => {
    console.warn("Socket Error: ", err);
  });

$(window).on("unload", function (event): void {
  socket.emit("user disconnected", currentUser);
});

function removeCookie(cookie: string): string {
  document.cookie = `${encodeURIComponent(cookie)}=0; max-age=1`;
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
    $("#login").off("click", login);
  }
  for (let message of $(".message"))
    if ($(message).find(".sender").text() === currentUser)
      $(message).addClass("sent").find(".sender").prependTo(message);

  socket.emit("user connected", currentUser);
}

function logout(): void {
  socket.emit("user disconnected", currentUser);
  removeCookie("username");
  currentUser = null;

  chat_form.hide();
  login_form.css("display", "flex");
  $("#login").click(login);

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
    createMessage(body);
  }
}

function init(): void {
  fetch("/init")
    .then((res) => res.json())
    .then((res) => {
      for (let message of JSON.parse(res)) createMessage(message);
    });
}
