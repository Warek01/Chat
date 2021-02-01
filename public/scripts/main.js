"use strict";
const socket = io();
const login_form = $("#login-wrapper"), login_input = $("#username"), chat_form = $("#chat-wrapper"), chat_input = $("#chat-input"), chat_area = $("#chat-area"), dropdown = $("#dropdown"), user_field = $("#user"), edit_user_btn = $("#edit-user"), logout_btn = $("#change-username"), advanced_tab_btn = $("#toggle-advanced-tab"), advanced_tab = $("#advanced-tab");
let currentUser, previousUser, contextMenu, elementsActive = {
    changeUserDropdown: false,
    advancedTab: false,
    userContextMenu: false
};
$(document).ready(function (event) {
    if (document.cookie.match(/username/)) {
        currentUser = decodeURIComponent((document.cookie.match(/(?<=username=)\w+/) || [""])[0]);
        user_field.text(currentUser);
        init();
        edit_user_btn.css("pointer-events", "all");
        socket.emit("user connected", currentUser);
    }
    else {
        $("#login").click(login);
        login_form.css("display", "flex");
        chat_form.hide();
    }
    validatePreviousUserBtn();
});
edit_user_btn.click(function (event) {
    if (!elementsActive.changeUserDropdown) {
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
    elementsActive.changeUserDropdown = !elementsActive.changeUserDropdown;
});
advanced_tab_btn.click(function (event) {
    if (advanced_tab.css("display") === "none") {
        advanced_tab.show();
        dropdown.css("height", 230);
    }
    else {
        advanced_tab.hide();
        dropdown.css("height", 150);
    }
    elementsActive.advancedTab = !elementsActive.advancedTab;
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
        if (event.shiftKey)
            chat_input.val(chat_input.val() + "\n");
        // Nu lucreaza \n la input
        else
            $("#sendBtn").trigger("click");
});
// Global listeners
socket
    .on("message", (message) => {
    createMessage(message);
})
    .on("message id", (id) => {
    for (let message of $(".message-wrap")) {
        if (!$(message).attr("ms_id")) {
            $(message).attr("ms_id", id);
            break;
        }
    }
})
    .on("user connected", (user) => {
    createConnectionMessage(user);
})
    .on("user disconnected", (user) => {
    createConnectionMessage(user, true);
})
    .on("error", (err) => {
    console.warn("Socket Error: ", err);
})
    .on("clear history", () => {
    clearMessagehistory(false);
})
    .on("reload", () => {
    location.reload();
})
    .on("message edit", (id, content) => {
    for (let message of $(".message-wrap"))
        if ($(message).attr("ms_id") === id) {
            $(message)
                .find(".content")
                .text(content)
                .css("margin-bottom", 10)
                .append($("<span>", {
                html: "Edited",
                class: "edited-mark"
            }));
            break;
        }
})
    .on("clear logs", () => {
    $(".connection").remove();
});
$(window).on({
    click: function (event) {
        if (elementsActive.userContextMenu &&
            !$(event.target).hasClass("context-menu")) {
            contextMenu?.disable();
            return;
        }
        if (elementsActive.advancedTab &&
            !elementsActive.userContextMenu &&
            $(event.target).attr("id") !== advanced_tab.attr("id") &&
            $(event.target).attr("id") !== advanced_tab_btn.attr("id"))
            advanced_tab_btn.trigger("click");
        if (elementsActive.changeUserDropdown &&
            !elementsActive.userContextMenu &&
            $(event.target).attr("id") !== "dropdown" &&
            $(event.target).parents().attr("id") !== "dropdown" &&
            $(event.target).attr("id") !== "edit-user" &&
            $(event.target).parent().attr("id") !== "edit-user")
            edit_user_btn.trigger("click");
    },
    contextmenu: function (event) {
        contextMenu?.disable();
        if (($(event.target).hasClass("message") ||
            $(event.target).parents().hasClass("message")) &&
            !event.shiftKey) {
            event.preventDefault();
            contextMenu = new ContextMenu(event);
        }
    },
    unload: function (event) {
        socket.emit("user disconnected", currentUser);
    }
});
// Functions
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
        edit_user_btn.css("pointer-events", "all");
        $("#login").off("click", login);
    }
    for (let message of $(".message"))
        if ($(message).find(".sender").text() === currentUser)
            $(message).addClass("sent").find(".sender").prependTo(message);
    socket.emit("user connected", currentUser);
}
function logout() {
    console.assert(currentUser !== null, "User in null");
    socket.emit("user disconnected", currentUser);
    previousUser = currentUser;
    currentUser = null;
    setCookie("previousUser", previousUser);
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
function replaceWithAnchor(content) {
    let exp_match = /(\b(https?|):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|\\])/gi, element_content = content.replace(exp_match, "<a href='$1'>$1</a>"), new_exp_match = /(^|[^\/])(www\.[\S]+(\b|$))/gim, new_content = element_content.replace(new_exp_match, '$1<a target="_blank" href="http://$2">$2</a>');
    return new_content;
}
function validatePreviousUserBtn() {
    if (document.cookie.match(/previousUser/)) {
        previousUser = decodeURIComponent((document.cookie.match(/(?<=previousUser=)\w+/) || [""])[0]);
        $(".last-user").show();
        $("#last-user-name")
            .css("display", "block")
            .text(previousUser)
            .click(function (event) {
            login_input.val(previousUser);
            login();
        });
    }
    else
        $(".last-user").hide();
}
function createConnectionMessage(name, dissconected = false) {
    let container = $("<div>", { class: "connection" }), content = $("<p>", {
        html: `${name} ${dissconected ? "left" : "joined"} chat`,
        class: "username"
    });
    if (currentUser !== name)
        container.append(content).appendTo(chat_area);
}
function createMessage(message) {
    let container = $("<div>", { class: "message-wrap" }), _message = $("<div>", { class: "message" }), content, sender = $("<span>", {
        html: message.sender,
        class: "sender"
    });
    content = $("<span>", {
        html: replaceWithAnchor(message.content.trim()),
        class: "content"
    });
    if (message.sender === currentUser) {
        container.addClass("sent");
        _message.append(sender, content);
    }
    else {
        _message.append(content, sender);
    }
    container.append(_message);
    chat_area.append(container);
    container.attr("ms_id", message._id);
    if (message.edited) {
        let editContainer = $("<span>", {
            html: "Edited",
            class: "edited-mark"
        });
        container.css("margin-bottom", 10).append(editContainer);
    }
}
function clearMessagehistory(clearFromDb = true) {
    if (clearFromDb) {
        fetch("/clear")
            .then(res => res.text)
            .then(res => console.log(res));
        socket.emit("clear history");
    }
    chat_area.children().remove();
}
function clearAllLogs(clearFromDb = true) {
    if (clearFromDb)
        socket.emit("clear logs");
    else
        $(".connection").remove();
}
// Custom context menu
class ContextMenu {
    constructor(event) {
        this.posX = event.clientX;
        this.posY = event.clientY;
        this.target = event.target;
        if ($(event.target).hasClass("message"))
            this.selectedElement = $(event.target);
        else
            this.selectedElement = $(event.target).parents(".message");
        this.contentElement = this.selectedElement.find(".content");
        elementsActive.userContextMenu = true;
        this.menuElement = $("<div>", { class: "context-menu" });
        this.wrapElement = this.selectedElement.parent(".message-wrap");
        let copyBtn = $("<span>", { html: "Copy" }), openLinkBtn = $("<span>", {
            html: "Open link here",
            "class": "button-disabled"
        }), openLinkNewTabBtn = $("<span>", {
            html: "Open link in new tab",
            "class": "button-disabled"
        }), editBtn = $("<span>", { html: "Edit" });
        copyBtn.click(e => {
            this.copyText();
        });
        openLinkBtn.click(event => {
            this.openLink(event);
        });
        openLinkNewTabBtn.click(event => {
            this.openLinkNewTab(event);
        });
        editBtn.click(e => {
            this.edit();
        });
        if (event.target.tagName === "A") {
            openLinkBtn.removeClass("button-disabled");
            openLinkNewTabBtn.removeClass("button-disabled");
        }
        if (!this.wrapElement.hasClass("sent"))
            editBtn.addClass("button-disabled");
        this.menuElement
            .append(copyBtn, openLinkBtn, openLinkNewTabBtn, editBtn)
            .css({
            top: this.posY - 35,
            left: this.posX - 15
        })
            .appendTo($("body"));
        if (this.wrapElement.hasClass("sent")) {
            this.menuElement
                .addClass("right-side")
                .css("left", this.posX - 283);
        }
    }
    copyText() {
        let tempElement = $("<input>");
        $("body").append(tempElement);
        tempElement.val(this.contentElement.text()).trigger("select");
        document.execCommand("copy");
        tempElement.remove();
    }
    openLink(event) {
        location.assign(this.target.textContent);
    }
    openLinkNewTab(event) {
        window.open(this.target.textContent);
    }
    edit() {
        this.contentElement.attr("contenteditable", "true").trigger("focus");
        const endEdit = () => {
            if (this.contentElement.text().trim() != "") {
                socket.emit("message edit", this.wrapElement.attr("ms_id")?.toString(), this.contentElement.text().trim());
                this.contentElement.attr("contenteditable", "false");
                this.contentElement.off("focusout", endEdit);
            }
        };
        this.contentElement.focusout(endEdit);
    }
    disable() {
        elementsActive.userContextMenu = false;
        this.menuElement.remove();
    }
}
