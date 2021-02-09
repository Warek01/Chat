"use strict";
const socket = io();
const login_form = $("#login-wrapper"), login_input = $("#username"), chat_form = $("#chat-wrapper"), chat_input = $("#chat-input"), chat_area = $("#chat-area"), dropdown = $("#dropdown"), user_field = $("#user"), edit_user_btn = $("#edit-user"), send_photo_btn = $("#photoBtn"), logout_btn = $("#change-username"), advanced_tab_btn = $("#toggle-advanced-tab"), advanced_tab = $("#advanced-tab");
let currentUser, previousUser, contextMenu, imageSettings = {
    transition: false,
    parts: [],
    currentName: null
}, elementsActive = {
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
    if (message?.find("edited-mark")?.length === 0) {
        message
            .find(".content")
            .html(replaceWithAnchor(content))
            .end()
            .css("margin-bottom", 20)
            .prepend($("<span>", {
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
    .on("image", (image) => {
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
    .on("image_data", (data) => {
    if (!imageSettings.transition) {
        imageSettings.currentName = data.imageName;
        imageSettings.transition = true;
    }
})
    .on("image_part", async (imageName, part) => {
    if (imageName === imageSettings.currentName)
        imageSettings.parts.push(part);
    else
        throw Error("Image name error");
})
    .on("image_send_end", (data, id) => {
    if (imageSettings.transition) {
        createImg(data, id);
        imageSettings.transition = false;
    }
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
// --------------------------------------------------------------
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
    const stack = new Stack();
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
                stack.push(em);
                break;
        }
    }
    requestImages(stack);
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
function splitToLength(str, len) {
    if (len === undefined || len > str.length) {
        len = str.length;
    }
    var yardstick = new RegExp(`.{${len}}`, "g");
    var pieces = str.match(yardstick);
    var accumulated = pieces.length * len;
    var modulo = str.length % accumulated;
    if (modulo)
        pieces.push(str.slice(accumulated));
    return pieces;
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
        container.css("margin-bottom", 20).append(editContainer);
    }
    if (message.sender === currentUser)
        container.addClass("sent");
    container.attr("ms_id", message._id);
    container.append(_message);
    chat_area.append(container);
}
function createImg(image, base64) {
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
    }
    else {
    }
    $("body").append(container);
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
function removeEditMarks() {
    socket.emit("remove_edit_marks");
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
async function sendPhoto() {
    const element = $("#photoInput");
    if (imageSettings.transition)
        return;
    if (element[0].files.length > 0) {
        imageSettings.transition = true;
        const file = element[0].files[0];
        const reader = new FileReader();
        const fileName = file.name;
        const fileSender = currentUser;
        const fileTimestamp = Date.now();
        reader.onloadstart = function () {
            console.log("Image processing started");
        };
        reader.onloadend = function () {
            console.log("Image processing done");
        };
        reader.onload = function () {
            let base64 = this.result?.toString();
            let separatedElement = splitToLength(base64, 1000);
            let total = 0;
            for (let i of separatedElement)
                total += i.length;
            if (total !== base64?.length)
                throw Error("Error in image separation");
            base64 = null;
            total = null;
            socket.emit("image_data", {
                imageName: fileName,
                sender: fileSender,
                timestamp: fileTimestamp
            });
            for (let part of separatedElement) {
                socket.emit("image_part", fileName, part);
            }
            socket.emit("image_send_end", {
                imageName: fileName,
                timestamp: fileTimestamp,
                sender: fileSender
            });
        };
        reader.readAsDataURL(file);
    }
}
async function requestImages(stack) {
    while (stack.length) {
        const current = stack.get();
        let index = 0;
        let parts = [];
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
        let raw = parts.join("");
        createImg(current, raw);
    }
}
// --------------------------------------------------------------
// Classes
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
class Stack {
    constructor() {
        this.stack = [];
        this.firstElement = null;
        this.lastElement = null;
    }
    /** Add an element to the stack */
    push(obj) {
        if (this.stack.length === 0 && !this.firstElement && !this.lastElement) {
            this.firstElement = obj;
            this.lastElement = obj;
        }
        else {
            this.lastElement = obj;
        }
        this.stack.push(obj);
        return this;
    }
    /** Remove first element */
    pop() {
        if (this.lastElement === this.firstElement && this.stack.length === 1) {
            this.firstElement = null;
            this.lastElement = null;
        }
        else if (this.stack.length > 2) {
            this.firstElement = this.stack[1];
        }
        else if (this.stack.length === 2) {
            this.firstElement = this.lastElement;
        }
        this.stack.shift();
        return this;
    }
    /** Get first element of the stack then delete it */
    get() {
        let firstElement;
        if (this.stack.length > 0 && this.firstElement && this.lastElement) {
            firstElement = this.firstElement;
            this.pop();
        }
        return firstElement;
    }
    /** Empty stack */
    empty() {
        this.stack = [];
        this.firstElement = null;
        this.lastElement = null;
        return this;
    }
    /** Stack length */
    get length() {
        return this.stack.length;
    }
}
