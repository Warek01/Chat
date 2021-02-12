export const elements = {
    login_form: $("#login-wrapper"),
    login_input: $("#username"),
    chat_form: $("#chat-wrapper"),
    chat_input: $("#chat-input"),
    chat_area: $("#chat-area"),
    dropdown: $("#dropdown"),
    user_field: $("#user"),
    edit_user_btn: $("#edit-user"),
    send_photo_btn: $("#photoBtn"),
    send_text_btn: $("#sendBtn"),
    clear_history_btn: $(".clear-history-button"),
    change_username_btn: $("#change-username"),
    clear_logs_btn: $(".clear-all-logs-button"),
    logout_btn: $("#change-username"),
    advanced_tab_btn: $("#toggle-advanced-tab"),
    advanced_tab: $("#advanced-tab"),
    photo_input: $("#photoInput")
};
export let variables = {
    currentUser: null,
    previousUser: null,
    contextMenu: null
};
export let imageSettings = {
    transition: false,
    parts: [],
    title: null,
    reset() {
        this.parts = [];
        this.title = null;
        this.transition = false;
    }
}, elementsActive = {
    changeUserDropdown: false,
    advancedTab: false,
    userContextMenu: false
};
export const socket = io();
