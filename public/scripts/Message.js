"use strict";
function createConnectionMessage(name, dissconected = false) {
    let container = $("<div>", { class: "connection" }), content = $("<p>", {
        html: `${name} ${dissconected ? "left" : "joined"} chat`,
        class: "username"
    });
    container.append(content).appendTo(chat_area);
}
function createMessage(message) {
    let container = $("<div>", { class: "message-wrap" }), _message = $("<div>", { class: "message" }), content = $("<span>", {
        html: message.content,
        class: "content"
    }), sender = $("<span>", {
        html: message.sender,
        class: "sender"
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
}
function clearMessagehistory() {
    fetch("/clear")
        .then((res) => res.text)
        .then((res) => console.log(res));
    chat_area.children().remove();
}
