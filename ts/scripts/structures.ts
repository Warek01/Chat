import { MessageTypes as t, int } from "../db_types";
import { elements, elementsActive, socket } from "./declarations.js";

export class ContextMenu {
  private id: string;
  private menuElement: JQuery;
  private selectedElement: JQuery;
  private wrapElement: JQuery;
  private contentElement: JQuery;
  private target: HTMLElement;

  constructor(event: JQuery.ContextMenuEvent | JQuery.ClickEvent) {
    this.disableScrolling();

    this.target = event.target;

    if ($(event.target).hasClass("message"))
      this.selectedElement = $(event.target);
    else this.selectedElement = $(event.target).parents(".message");
    this.contentElement = this.selectedElement.find(".content");

    elementsActive.userContextMenu = true;

    this.menuElement = $("<div>", { class: "context-menu" });
    this.wrapElement = this.selectedElement.parent(".message-wrap");
    this.id = this.wrapElement.attr("ms_id") || "";

    let copyBtn = $("<span>", { html: "Copy" }),
      openLinkBtn = $("<span>", {
        html: "Open link here",
        class: "button-disabled"
      }),
      openLinkNewTabBtn = $("<span>", {
        html: "Open link in new tab",
        class: "button-disabled"
      }),
      editBtn = $("<span>", {
        html: "Edit",
        class: "button-disabled"
      }),
      deleteBtn = $("<span>", {
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
        top: (this.wrapElement.offset()?.top as number) - 35,
        left: this.contentElement.offset()?.left as number
      })
      .appendTo($("body"));

    if (this.menuElement.width()! + 90 >= this.selectedElement.width()!)
      this.menuElement.css({
        left:
          (this.contentElement.offset()?.left as number) -
          (this.menuElement.width()! + 40)
      });

    if (this.wrapElement.hasClass("sent"))
      this.menuElement.addClass("right-side");
  }

  copyText(): void {
    let tempElement = $("<input>");
    $("body").append(tempElement);
    tempElement.val(this.contentElement.text()).trigger("select");
    document.execCommand("copy");
    tempElement.remove();
  }

  delete(): void {
    socket.emit("delete_text_message", this.id);
  }

  openLink(): void {
    location.assign(this.target.textContent as string);
  }

  openLinkNewTab(): void {
    window.open(this.target.textContent as string);
  }

  edit(): void {
    let initilaText: string = this.contentElement.text(),
      initialHtml: string = this.contentElement.html();
    this.contentElement.attr("contenteditable", "true").trigger("focus");

    const endEdit = () => {
      if (
        this.contentElement.text().trim() != "" &&
        initilaText !== this.contentElement.text()
      )
        socket.emit("message_edit", this.id, this.contentElement.text());
      else this.contentElement.html(initialHtml);

      this.contentElement.attr("contenteditable", "false");
      this.contentElement.off("focusout", endEdit);
    };

    this.contentElement.focusout(endEdit);
  }

  disable(): void {
    elementsActive.userContextMenu = false;
    this.menuElement.remove();
    this.enableScrolling();
  }

  private disableScrolling(): void {
    let x = elements.chat_area[0].scrollLeft,
      y = elements.chat_area[0].scrollTop;

    elements.chat_area[0].onscroll = function () {
      elements.chat_area[0].scrollTo(x, y);
    };
  }

  private enableScrolling(): void {
    elements.chat_area[0].onscroll = function () {};
  }
}

// ---------- Stack ----------
export class Stack<Type> {
  private data: Type[] = [];
  private firstElement: Type = null;
  private lastElement: Type = null;

  constructor() {}

  /** Add an element to the stack */
  push(obj: Type): Stack<Type> {
    if (this.data.length === 0 && !this.firstElement && !this.lastElement) {
      this.firstElement = obj;
      this.lastElement = obj;
    } else {
      this.lastElement = obj;
    }
    this.data.push(obj);
    return this;
  }

  /** Remove first element */
  pop(): Stack<Type> {
    if (this.lastElement === this.firstElement && this.data.length === 1) {
      this.firstElement = null;
      this.lastElement = null;
    } else if (this.data.length > 2) {
      this.firstElement = this.data[1];
    } else if (this.data.length === 2) {
      this.firstElement = this.lastElement;
    }

    this.data.pop();
    return this;
  }

  /** Get first element of the stack then delete it */
  get(): Type {
    if (this.data.length > 0) {
      if (this.data.length === 1) {
        this.lastElement = null;
        this.firstElement = null;
      } else if (this.data.length === 2) this.firstElement = this.lastElement;
      else this.firstElement = this.data[1];

      return this.data.shift();
    }
  }

  /** Empty stack */
  empty(): Stack<Type> {
    this.data = [];
    this.firstElement = null;
    this.lastElement = null;
    return this;
  }

  /** Stack length */
  get length(): int {
    return this.data.length;
  }
}

// ---------- Queue ----------
export class Queue<Type> {
  private data: Type[] = [];

  constructor() {}

  /** Push an element to the queue */
  push(element: Type | Type[]): Queue<Type> {
    if (Array.isArray(element) && element.length > 0)
      for (let em of element) this.data.push(em);
    else this.data.push(element as Type);

    return this;
  }

  /** Get the first element of the queue and remove it */
  get(): Type | null {
    if (this.data.length > 0) return this.data.shift();
    else return null;
  }

  isEmpty(): boolean {
    return this.data.length === 0;
  }

  /** Empty queue */
  empty(): Queue<Type> {
    if (this.data.length > 0) this.data = [];

    return this;
  }

  /** Queue length */
  get length(): int {
    return this.data.length;
  }
}
