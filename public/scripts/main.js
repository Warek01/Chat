"use strict";
const login_form = $("#login-wrapper"), login_input = $("#username"), chat_form = $("#chat-wrapper"), chat_input = $("#chat-input"), chat_area = $("#chat-area"), dropdown = $("#dropdown"), user_field = $("#user"), edit_user_btn = $("#edit-user"), logout_btn = $("#change-username");
const socket = io("http://83.218.206.8:12345");
let currentUser;
$(document).ready(function (event) {
    if (document.cookie.match(/username/)) {
        currentUser = decodeURIComponent((document.cookie.match(/(?<=username=)\w+;?/) || [""])[0]);
        user_field.text(currentUser);
        init();
        socket.emit("user connected", currentUser);
    }
    else {
        $("#login").click(login);
        login_form.css("display", "flex");
        chat_form.hide();
    }
});
edit_user_btn.click(function (event) {
    dropdown.show();
});
login_input.keypress(function (event) {
    switch (event.key) {
        case "Enter":
            if ($(this).val().toString().trim() !== "")
                login();
            break;
    }
});
chat_input.keypress(function (event) {
    if (event.key === "Enter")
        $("#sendBtn").trigger("click");
});
$(window)
    .keydown(function (event) { })
    .click(function (event) {
    if (dropdown.css("display") !== "none" &&
        $(event.target).attr("id") !== "dropdown" &&
        $(event.target).parent().attr("id") !== "dropdown" &&
        $(event.target).attr("id") !== "edit-user" &&
        $(event.target).parent().attr("id") !== "edit-user") {
        dropdown.hide();
    }
});
socket
    .on("message", (message) => {
    createMessage(message);
})
    .on("user connected", (user) => {
    createConnectionMessage(user);
})
    .on("user disconnected", (user) => {
    createConnectionMessage(user, true);
})
    .on("error", (err) => {
    console.warn("Socket Error: ", err);
});
$(window).on("unload", function (event) {
    socket.emit("user disconnected", currentUser);
});
function removeCookie(cookie) {
    document.cookie = `${encodeURIComponent(cookie)}=0; max-age=1`;
    return cookie;
}
function setCookie(key, value) {
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; max-age=999999999`;
    return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}
function login() {
    if (login_input.val().trim() !== "") {
        currentUser = login_input.val();
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
function logout() {
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
function sendMessage() {
    if (chat_input.val().toString().trim() !== "") {
        const body = {
            content: chat_input.val(),
            sender: currentUser,
            timestamp: Date.now()
        };
        chat_input.val("");
        socket.emit("message", body);
        createMessage(body);
    }
}
function init() {
    fetch("/init")
        .then((res) => res.json())
        .then((res) => {
        for (let message of JSON.parse(res))
            createMessage(message);
    });
}
