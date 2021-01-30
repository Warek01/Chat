"use strict";
const login_form = $("#login-wrapper"), login_input = $("#username"), chat_form = $("#chat-wrapper"), chat_input = $("#chat-input"), chat_area = $("#chat-area"), dropdown = $("#dropdown"), user_field = $("#user"), edit_user_btn = $("#edit-user"), logout_btn = $("#change-username");
const socket = io();
let currentUser;
let previousUser;
let changeUserDropdownIsActive = false;
$(document).ready(function (event) {
    if (document.cookie.match(/username/)) {
        currentUser = decodeURIComponent((document.cookie.match(/(?<=username=)\w+/) || [""])[0]);
        user_field.text(currentUser);
        init();
        socket.emit("user connected", currentUser);
    }
    else {
        $("#login").click(login);
        login_form.css("display", "flex");
        chat_form.hide();
    }
    if (document.cookie.match(/previousUser/)) {
        previousUser = decodeURIComponent((document.cookie.match(/(?<=previousUser=)\w+/) || [""])[0]);
        $("#last-user-name")
            .css("display", "block")
            .text(previousUser)
            .click(function (event) {
            login_input.val(previousUser);
            login();
        });
    }
    else {
        $(".last-user").hide();
    }
});
edit_user_btn.click(function (event) {
    if (!changeUserDropdownIsActive) {
        dropdown.show();
        $("body").children().not("header").css({
            "pointer-events": "none",
            filter: "blur(2px)"
        });
    }
    else {
        dropdown.hide();
        $("body").children().not("header").css({
            "pointer-events": "all",
            filter: "blur(0)"
        });
    }
    changeUserDropdownIsActive = !changeUserDropdownIsActive;
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
// Global listeners
$(window).on({
    click: function (event) {
        if (changeUserDropdownIsActive &&
            $(event.target).attr("id") !== "dropdown" &&
            $(event.target).parents().attr("id") !== "dropdown" &&
            $(event.target).attr("id") !== "edit-user" &&
            $(event.target).parent().attr("id") !== "edit-user") {
            dropdown.hide();
            $("body").children().not("header").css({
                "pointer-events": "all",
                filter: "blur(0)"
            });
            changeUserDropdownIsActive = false;
        }
    }
});
function removeCookie(cookie) {
    document.cookie = `${encodeURIComponent(cookie)}=0; max-age=0`;
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
    console.assert(currentUser !== null, "User in null");
    previousUser = currentUser;
    currentUser = null;
    setCookie("previousUser", previousUser);
    removeCookie("username");
    socket.emit("user disconnected", currentUser);
    chat_form.hide();
    login_form.css("display", "flex");
    $("#login").click(login);
    dropdown.hide();
    $("body").children().not("header").css({
        "pointer-events": "all",
        filter: "blur(0)"
    });
    changeUserDropdownIsActive = false;
    for (let message of $(".message.sent")) {
        $(message).removeClass("sent").find(".sender").appendTo(message);
    }
}
function sendMessage() {
    if (chat_input.val().toString().trim() !== "") {
        const body = {
            content: chat_input.val(),
            sender: currentUser,
            timestamp: Date.now(),
        };
        chat_input.val("");
        socket.emit("message", body);
        createMessage(body);
    }
}
function init() {
    clearMessagehistory(false);
    fetch("/init")
        .then(res => res.json())
        .then(res => {
        for (const message of JSON.parse(res)) {
            if (message.type === "message")
                createMessage(message);
            else if (message.type === "connected")
                createConnectionMessage(message.sender);
            else if (message.type === "disconnected")
                createConnectionMessage(message.sender, true);
        }
    });
}
// https://stackoverflow.com/questions/8667070/javascript-regular-expression-to-validate-url
function validateUrl(value) {
    return /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:[/?#]\S*)?$/i.test(value);
}
function createConnectionMessage(name, dissconected = false) {
    if (currentUser === name)
        return;
    let container = $("<div>", { class: "connection" }), content = $("<p>", {
        html: `${name} ${dissconected ? "left" : "joined"} chat`,
        class: "username"
    });
    container.append(content).appendTo(chat_area);
}
function createMessage(message) {
    let container = $("<div>", { class: "message-wrap" }), _message = $("<div>", { class: "message" }), content, sender = $("<span>", {
        html: message.sender,
        class: "sender"
    });
    if (validateUrl(message.content)) {
        content = $("<a>", {
            html: message.content,
            class: "content",
            href: message.content,
            target: "_blank"
        });
    }
    else {
        content = $("<span>", {
            html: message.content,
            class: "content"
        });
    }
    if (message.sender === currentUser) {
        container.addClass("sent");
        _message.append(sender, content);
    }
    else {
        _message.append(content, sender);
    }
    container.append(_message);
    chat_area.append(container);
}
function clearMessagehistory(clearFromDb = true) {
    if (clearFromDb)
        fetch("/clear")
            .then((res) => res.text)
            .then((res) => console.log(res));
    chat_area.children().remove();
}
