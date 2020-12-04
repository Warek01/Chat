"use strict";
const login_form = $("#login-wrapper"), login_input = $("#username"), chat_form = $("#chat-wrapper"), chat_input = $("#chat-input"), chat_area = $("#chat-area"), dropdown = $("#dropdown"), user_field = $("#user"), edit_user_btn = $("#edit-user"), logout_btn = $("#change-username");
const socket = io("http://localhost:8000");
let currentUser;
$(document).ready(function (event) {
    if (document.cookie.match(/username/)) {
        currentUser = decodeURIComponent((document.cookie.match(/(?<=username=)\w+;?/) || [""])[0]);
        user_field.text(currentUser);
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
$(window)
    .keydown(function (event) { })
    .click(function (event) {
    if (dropdown.css("display") !== "none" &&
        $(event.target).attr("id") !== "dropdown" &&
        $(event.target).parent().attr("id") !== "dropdown" &&
        $(event.target).attr("id") !== "edit-user" &&
        $(event.target).parent().attr("id") !== "edit-user") {
        dropdown.hide();
        // alert(true);
    }
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
        login_input.val("");
        login_form.hide();
        chat_form.show();
        $("#login").off("click", login);
    }
}
function logout() {
    removeCookie("username");
    currentUser = null;
    chat_form.hide();
    login_form.css("display", "flex");
    $("#login").click(login);
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
    }
}
