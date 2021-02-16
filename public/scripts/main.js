import { ContextMenu, Queue, Stack } from "./structures.js";
import { global, APP_TITLE, elements as elem, elementsActive, variables, imageSettings, socket } from "./declarations.js";
$(document).ready(function (event) {
    if (document.cookie.match(/username/)) {
        variables.currentUser = decodeURIComponent((document.cookie.match(/(?<=username=)\w+/) || [""])[0]);
        elem.user_field.text(variables.currentUser);
        init();
        elem.buttons.edit_user.css("pointer-events", "all");
        socket.emit("connect_log", {
            type: "connect",
            author: variables.currentUser,
            timestamp: Date.now()
        });
    }
    else {
        $("#login").click(login);
        elem.login_form.css("display", "flex");
        elem.chat_form.hide();
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
    variables.CONFIG = res;
    window.CONFIG = res;
    for (const [key, value] of Object.entries(variables.CONFIG))
        if (value)
            $(`[data-config="${key}"]`).addClass("off");
})
    .catch((err) => {
    console.warn("Config error", err);
});
elem.photo_input.change(sendPhoto);
elem.buttons.send_text.click(sendMessage);
elem.buttons.change_username.click(logout);
elem.buttons.clear_history.click(e => {
    clearMsgHistory(true);
});
elem.buttons.clear_logs.click(e => {
    clearAllLogs(true);
});
elem.buttons.edit_user.click(function (event) {
    if (!elementsActive.changeUserDropdown) {
        elem.dropdown.show();
        $("body").children().not("header").css({
            "pointer-events": "none",
            filter: "blur(2px)"
        });
    }
    else {
        elem.dropdown.hide();
        $("body").children().not("header").css({
            "pointer-events": "all",
            filter: "blur(0)"
        });
    }
    elementsActive.changeUserDropdown = !elementsActive.changeUserDropdown;
});
elem.buttons.settings_window.click(function (event) {
    if (elementsActive.settingsWindow === false) {
        elem.dropdown.hide();
        elem.settings_window.show().trigger("click");
        elem.buttons.edit_user.css("pointer-events", "none");
        elementsActive.settingsWindow = true;
    }
});
elem.buttons.close_settings_menu.click(function (event) {
    elem.settings_window.hide();
    elementsActive.settingsWindow = false;
    elem.buttons.edit_user.css("pointer-events", "all");
});
elem.buttons.clear_history.click(function (event) {
    socket.emit("clear_history");
});
elem.buttons.clear_logs.click(function (event) {
    socket.emit("clear_logs");
});
elem.login_input.keypress(function (event) {
    switch (event.key) {
        case "Enter":
            if ($(this).val().toString().trim() !== "")
                login();
            break;
    }
});
elem.chat_input.keypress(function (event) {
    if (event.key === "Enter")
        if (event.shiftKey)
            elem.chat_input.val(elem.chat_input.val() + "\n");
        // Nu lucreaza \n la input
        else
            $("#sendBtn").trigger("click");
});
// Global listeners
socket
    .on("text_message", (message) => {
    createTextMsg(message);
    if (variables.lostFocus && !variables.CONFIG.noNotifications) {
        variables.nrOfNotifications++;
        notification(variables.nrOfNotifications === 1
            ? `New message (${message.author})`
            : `${variables.nrOfNotifications} new messages`);
    }
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
    .on("remove_edit_marks", () => {
    $(".edited-mark")
        .parent(".message-wrap")
        .css("margin-bottom", 0)
        .end()
        .remove();
})
    .on("config_update", (config) => {
    variables.CONFIG = config;
    window.CONFIG = config;
    for (const [key, value] of Object.entries(variables.CONFIG))
        if (value)
            $(`[data-config="${key}"]`).addClass("off");
})
    // Image implementation
    .on("image_data", (image) => {
    if (!imageSettings.transition) {
        imageSettings.title = image.title;
        imageSettings.transition = true;
        createImgMsg(image);
    }
})
    .on("image_part", async (image, part) => {
    if (image.title === imageSettings.title)
        imageSettings.parts.push(part);
    else
        throw Error(`Image name error
    current title: ${imageSettings.title}; remote title: ${image.title}`);
})
    .on("image_send_end", (data) => {
    if (imageSettings.transition) {
        fillImg(data);
        imageSettings.transition = false;
    }
});
$(window).on({
    click: function (event) {
        if (elementsActive.userContextMenu &&
            !$(event.target).hasClass("context-menu")) {
            variables.contextMenu?.disable();
            return;
        }
        if (elementsActive.settingsWindow &&
            !elementsActive.userContextMenu &&
            $(event.target).attr("id") !== elem.settings_window.attr("id") &&
            $(event.target).attr("id") !== elem.buttons.settings_window.attr("id"))
            elem.buttons.settings_window.trigger("click");
        if (elementsActive.changeUserDropdown &&
            !elementsActive.userContextMenu &&
            $(event.target).attr("id") !== "dropdown" &&
            $(event.target).parents().attr("id") !== "dropdown" &&
            $(event.target).attr("id") !== "edit-user" &&
            $(event.target).parent().attr("id") !== "edit-user")
            elem.buttons.edit_user.trigger("click");
    },
    contextmenu: function (event) {
        variables.contextMenu?.disable();
        if (($(event.target).hasClass("message-wrap") ||
            $(event.target).parents().hasClass("message-wrap")) &&
            !event.shiftKey) {
            event.preventDefault();
            variables.contextMenu = new ContextMenu(event);
        }
    },
    unload: function (event) {
        socket.emit("connect_log", {
            type: "disconnect",
            author: variables.currentUser,
            timestamp: Date.now()
        });
    },
    // Blur & focus doesn't shoot when devtools are active
    blur: function (event) {
        variables.lostFocus = true;
    },
    focus: function (event) {
        variables.lostFocus = false;
        if (global.NT_TMOUT) {
            clearTimeout(global.NT_TMOUT);
            global.NT_TMOUT = null;
            document.title = APP_TITLE;
        }
    }
});
elem.buttons.send_photo.click(function (event) {
    $("#photoInput").trigger("click");
});
$("button.switch").click(function (event) {
    updateConfig($(this).data("config"));
});
// --------------------------------------------------------------
// Functions
function notification(message) {
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
    function revertTitle(f) {
        document.title = APP_TITLE;
        setTimeout(() => {
            f();
        }, 500);
    }
}
function updateConfig(data) {
    if (data in variables.CONFIG)
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
            .catch((err) => {
            console.warn("Config update error", err);
        });
}
function removeCookie(cookie) {
    document.cookie = `${encodeURIComponent(cookie)}=0; max-age=0`;
    return cookie;
}
function setCookie(key, value) {
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; max-age=999999999`;
    return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}
function login() {
    if (elem.login_input.val().trim() !== "") {
        variables.currentUser = elem.login_input.val();
        elem.user_field.text(variables.currentUser);
        setCookie("username", variables.currentUser);
        init();
        elem.login_input.val("");
        elem.login_form.hide();
        elem.chat_form.show();
        elem.buttons.edit_user.css("pointer-events", "all");
        $("#login").off("click", login);
    }
    for (let message of $(".message"))
        if ($(message).find(".sender").text() === variables.currentUser)
            $(message).addClass("sent").find(".sender").prependTo(message);
    socket.emit("connect_log", {
        type: "connect",
        author: variables.currentUser
    });
}
function logout() {
    console.assert(variables.currentUser !== null, "User in null");
    socket.emit("connect_log", {
        type: "disconnect",
        author: variables.currentUser,
        timestamp: Date.now()
    });
    variables.previousUser = variables.currentUser;
    variables.currentUser = null;
    setCookie("previousUser", variables.previousUser);
    removeCookie("username");
    validatePreviousUserBtn();
    elem.chat_form.hide();
    elem.login_form.css("display", "flex");
    $("#login").click(login);
    elem.buttons.edit_user.css("pointer-events", "none");
    elem.dropdown.hide();
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
    if (elem.chat_input.val().toString().trim() !== "") {
        const body = {
            content: elem.chat_input.val(),
            author: variables.currentUser,
            timestamp: Date.now()
        };
        elem.chat_input.val("");
        socket.emit("text_message", body);
    }
}
async function init() {
    clearMsgHistory(false);
    const queue = new Queue();
    let req = await fetch("/init"), res = await req.json();
    for (let em of res) {
        switch (em.object_type) {
            case "text_message":
                createTextMsg(em);
                break;
            case "connection_log":
                createConnectionLog(em);
                break;
            case "image":
                createImgMsg(em);
                queue.push(em);
                break;
        }
    }
    initImages(queue);
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
        variables.previousUser = decodeURIComponent((document.cookie.match(/(?<=previousUser=)\w+/) || [""])[0]);
        $(".last-user").show();
        $("#last-user-name")
            .css("display", "block")
            .text(variables.previousUser)
            .click(function (event) {
            elem.login_input.val(variables.previousUser);
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
// --------------------------------------------------
// Messages area
function createConnectionLog(obj) {
    let container = $("<div>", { class: "connection" }), content = $("<p>", {
        html: `${obj.author} ${obj.type === "disconnect" ? "left" : "joined"} chat`,
        class: "username"
    });
    // if (currentUser !== obj.username)
    container
        .append(content)
        .attr("object_type", obj.object_type)
        .appendTo(elem.chat_area);
}
function createTextMsg(message) {
    let container = $("<div>", { class: "message-wrap" }), _message = $("<div>", { class: "message" });
    let content = $("<span>", {
        html: replaceWithAnchor(message.content.trim()),
        class: "content"
    }), sender = $("<span>", {
        html: message.author,
        class: "sender"
    }), date = $("<span>", {
        html: getHour(message.timestamp),
        class: "date"
    });
    if (message.author === variables.currentUser) {
        _message.append(sender, date, content);
    }
    else {
        _message.append(content, sender, date);
    }
    if (message.is_edited) {
        let editContainer = $("<span>", {
            html: "Edited",
            class: "edited-mark"
        });
        container.css("margin-bottom", 20).append(editContainer);
    }
    if (message.author === variables.currentUser)
        container.addClass("sent");
    container
        .attr("ms_id", message._id)
        .attr("object_type", message.object_type)
        .append(_message)
        .appendTo(elem.chat_area);
}
function createImgMsg(image) {
    let container = $("<div>", { class: "message-wrap" }), img = $("<img>", { class: "img-message" });
    if (image.author === variables.currentUser)
        container.addClass("sent");
    container
        .attr("ms_id", image._id)
        .attr("object_type", "image")
        .append(img)
        .appendTo(elem.chat_area);
}
async function initImages(queue) {
    queue.getEach((img) => {
        imageSettings.transition = true;
        imageSettings.title = img.title;
        socket.emit("image_request", img);
    });
}
function fillImg(img) {
    let base64 = imageSettings.parts.join("");
    const container = findMessage(img._id);
    if (!base64.startsWith("data:image"))
        base64 = "data:image/jpeg;base64," + base64;
    container.find(".img-message")[0].src = base64;
    imageSettings.reset();
}
function clearMsgHistory(clearFromDb = true) {
    if (clearFromDb) {
        fetch("/clear")
            .then(res => res.text())
            .then(res => console.log("Cleared from db:", res === "OK" ? "yes" : "no"));
        socket.emit("clear_history");
    }
    elem.chat_area.children().remove();
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
        setTimeout(() => {
            sendPhoto();
        }, 1000);
    if (element[0].files.length > 0) {
        imageSettings.transition = true;
        const file = element[0].files[0];
        const reader = new FileReader();
        const currentImg = {
            author: variables.currentUser,
            timestamp: Date.now(),
            title: file.name
        };
        reader.onloadstart = function () {
            console.group("Image processing");
            console.log("Image processing started");
        };
        reader.onloadend = function () {
            console.log("Image processing done");
            console.groupEnd();
        };
        reader.onerror = function () {
            console.log("Image processing error");
            console.log(this.error);
            console.groupEnd();
        };
        reader.onload = function () {
            let base64 = this.result?.toString();
            let separatedElement = splitToLength(base64, 20 * 2 ** 10);
            console.log("Total parts:", separatedElement.length);
            let total = 0;
            for (let i of separatedElement)
                total += i.length;
            if (total !== base64?.length)
                throw Error("Error in image separation");
            base64 = null;
            total = null;
            socket.emit("image_data", currentImg);
            for (let part of separatedElement) {
                socket.emit("image_part", currentImg, part);
            }
            socket.emit("image_send_end", currentImg);
            elem.photo_input.val("");
            imageSettings.transition = false;
        };
        reader.readAsDataURL(file);
    }
}
// temp
global.splitToLength = global.split = splitToLength;
global.setCookie = setCookie;
global.removeCookie = removeCookie;
global.clearMsgHistory = clearMsgHistory;
global.clearAllLogs = clearAllLogs;
global.SOCKET = socket;
global.ELEMENTS = elem;
global.CONFIG = variables.CONFIG;
global.Queue = Queue;
global.Stack = Stack;
global.nt = global.notification = notification;
