"use strict";
const socket = io();
const login_form = $("#login-wrapper"), login_input = $("#username"), chat_form = $("#chat-wrapper"), chat_input = $("#chat-input"), chat_area = $("#chat-area"), dropdown = $("#dropdown"), user_field = $("#user"), edit_user_btn = $("#edit-user"), send_photo_btn = $("#photoBtn"), logout_btn = $("#change-username"), advanced_tab_btn = $("#toggle-advanced-tab"), advanced_tab = $("#advanced-tab");
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
        socket.emit("connect_log", {
            type: "connect",
            username: currentUser,
            timestamp: Date.now()
        });
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
    .on("text_message", (message) => {
    createTextMsg(message);
})
    .on("connect_log", (obj) => {
    createConnectionLog(obj);
})
    .on("error", (err) => {
    console.warn("Socket Error: ", err);
})
    .on("clear_history", () => {
    clearMsgHistory(false);
})
    .on("reload", () => {
    location.reload();
})
    .on("message_edit", (id, content) => {
    let message = findMessage(id);
    if (message) {
        message
            .find(".content")
            .html(replaceWithAnchor(content))
            .css("margin-bottom", 10);
        if (message.find("edited-mark").length === 0)
            message.append($("<span>", {
                html: "Edited",
                class: "edited-mark"
            }));
    }
    else
        throw new Error(`Message with id "${id}" not found`);
})
    .on("clear_logs", () => {
    $(".connection").remove();
})
    .on("delete_text_message", (id) => {
    let message = findMessage(id);
    if (message)
        message.remove();
    else
        throw new Error(`Message with id "${id}" not found`);
})
    .on("image", (image) => { });
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
        socket.emit("connect_log", {
            type: "disconnect",
            username: currentUser,
            timestamp: Date.now()
        });
    }
});
send_photo_btn.click(function (event) {
    const imgInput = $("#photoInput");
    imgInput.trigger("click");
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
    socket.emit("connect_log", {
        type: "connect",
        username: currentUser
    });
}
function logout() {
    console.assert(currentUser !== null, "User in null");
    socket.emit("connect_log", {
        type: "disconnect",
        username: currentUser,
        timestamp: Date.now()
    });
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
        socket.emit("text_message", body);
    }
}
async function init() {
    clearMsgHistory(false);
    let req = await fetch("/init"), res = await req.json();
    for (let em of res) {
        switch (em.name) {
            case "text_message":
                createTextMsg(em);
                break;
            case "connection_log":
                createConnectionLog(em);
                break;
            case "image":
                // ---
                break;
        }
    }
}
// https://stackoverflow.com/questions/8667070/javascript-regular-expression-to-validate-url
function validateUrl(value) {
    return /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:[/?#]\S*)?$/i.test(value);
}
function replaceWithAnchor(content) {
    let exp_match = /(\b(https?|):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|\\])/gi, element_content = content.replace(exp_match, "<a href='$1'>$1</a>"), new_exp_match = /(^|[^\/])(www\.[\S]+(\b|$))/gim, new_content = element_content.replace(new_exp_match, '$1<a target="_blank" href="http://$2">$2</a>');
    return new_content;
}
function findMessage(id) {
    for (let message of $(".message-wrap"))
        if ($(message).attr("ms_id") === id)
            return $(message);
    return null;
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
function createConnectionLog(obj) {
    let container = $("<div>", { class: "connection" }), content = $("<p>", {
        html: `${obj.username} ${obj.type === "disconnect" ? "left" : "joined"} chat`,
        class: "username"
    });
    // if (currentUser !== obj.username)
    container.append(content).appendTo(chat_area);
}
function createTextMsg(message) {
    let container = $("<div>", { class: "message-wrap" }), _message = $("<div>", { class: "message" });
    let content = $("<span>", {
        html: replaceWithAnchor(message.content.trim()),
        class: "content"
    }), sender = $("<span>", {
        html: message.sender,
        class: "sender"
    }), date = $("<span>", {
        html: getHour(message.timestamp),
        class: "date"
    });
    if (message.sender === currentUser) {
        _message.append(sender, date, content);
    }
    else {
        _message.append(content, sender, date);
    }
    if (message.edited) {
        let editContainer = $("<span>", {
            html: "Edited",
            class: "edited-mark"
        });
        container.css("margin-bottom", 10).append(editContainer);
    }
    if (message.sender === currentUser)
        container.addClass("sent");
    container.attr("ms_id", message._id);
    container.append(_message);
    chat_area.append(container);
}
function clearMsgHistory(clearFromDb = true) {
    if (clearFromDb) {
        fetch("/clear")
            .then(res => res.text)
            .then(res => console.log(res));
        socket.emit("clear_history");
    }
    chat_area.children().remove();
}
function clearAllLogs(clearFromDb = true) {
    if (clearFromDb)
        socket.emit("clear_logs");
    else
        $(".connection").remove();
}
function getHour(timestamp) {
    return `${new Date(timestamp).getHours()}:${new Date(timestamp).getMinutes().toString().length === 1
        ? new Date(timestamp).getMinutes() + "0"
        : new Date(timestamp).getMinutes()}`;
}
// Custom context menu
class ContextMenu {
    constructor(event) {
        this.disableScrolling();
        this.target = event.target;
        if ($(event.target).hasClass("message"))
            this.selectedElement = $(event.target);
        else
            this.selectedElement = $(event.target).parents(".message");
        this.contentElement = this.selectedElement.find(".content");
        elementsActive.userContextMenu = true;
        this.menuElement = $("<div>", { class: "context-menu" });
        this.wrapElement = this.selectedElement.parent(".message-wrap");
        this.id = this.wrapElement.attr("ms_id") || "";
        let copyBtn = $("<span>", { html: "Copy" }), openLinkBtn = $("<span>", {
            html: "Open link here",
            class: "button-disabled"
        }), openLinkNewTabBtn = $("<span>", {
            html: "Open link in new tab",
            class: "button-disabled"
        }), editBtn = $("<span>", {
            html: "Edit",
            class: "button-disabled"
        }), deleteBtn = $("<span>", {
            html: "Delete",
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
        if (event.target.tagName === "A") {
            openLinkBtn.removeClass("button-disabled");
            openLinkNewTabBtn.removeClass("button-disabled");
        }
        if (this.wrapElement.hasClass("sent")) {
            editBtn.removeClass("button-disabled");
            deleteBtn.removeClass("button-disabled");
        }
        this.menuElement
            .append(copyBtn, openLinkBtn, openLinkNewTabBtn, editBtn, deleteBtn)
            .css({
            top: this.wrapElement.offset()?.top - 35,
            left: this.contentElement.offset()?.left
        })
            .appendTo($("body"));
        if (this.menuElement.width() + 90 >= this.selectedElement.width())
            this.menuElement.css({
                left: this.contentElement.offset()?.left -
                    (this.menuElement.width() + 40)
            });
        if (this.wrapElement.hasClass("sent"))
            this.menuElement.addClass("right-side");
    }
    copyText() {
        let tempElement = $("<input>");
        $("body").append(tempElement);
        tempElement.val(this.contentElement.text()).trigger("select");
        document.execCommand("copy");
        tempElement.remove();
    }
    delete() {
        socket.emit("delete_text_message", this.id);
    }
    openLink() {
        location.assign(this.target.textContent);
    }
    openLinkNewTab() {
        window.open(this.target.textContent);
    }
    edit() {
        let initilaText = this.contentElement.text(), initialHtml = this.contentElement.html();
        this.contentElement.attr("contenteditable", "true").trigger("focus");
        const endEdit = () => {
            if (this.contentElement.text().trim() != "" &&
                initilaText !== this.contentElement.text())
                socket.emit("message_edit", this.id, this.contentElement.text());
            else
                this.contentElement.html(initialHtml);
            this.contentElement.attr("contenteditable", "false");
            this.contentElement.off("focusout", endEdit);
        };
        this.contentElement.focusout(endEdit);
    }
    disable() {
        elementsActive.userContextMenu = false;
        this.menuElement.remove();
        this.enableScrolling();
    }
    disableScrolling() {
        let x = chat_area[0].scrollLeft, y = chat_area[0].scrollTop;
        chat_area[0].onscroll = function () {
            chat_area[0].scrollTo(x, y);
        };
    }
    enableScrolling() {
        chat_area[0].onscroll = function () { };
    }
}
