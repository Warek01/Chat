import { elements, elementsActive, socket } from "./declarations.js";
export class ContextMenu {
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
        let x = elements.chat_area[0].scrollLeft, y = elements.chat_area[0].scrollTop;
        elements.chat_area[0].onscroll = function () {
            elements.chat_area[0].scrollTo(x, y);
        };
    }
    enableScrolling() {
        elements.chat_area[0].onscroll = function () { };
    }
}
export class Stack {
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
// ---------- Queue ----------
export class Queue {
    constructor() {
    }
    get length() {
        return this.data.length;
    }
}
