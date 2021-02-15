export const elements = {
    login_form: $("#login-wrapper"),
    login_input: $("#username"),
    chat_form: $("#chat-wrapper"),
    chat_input: $("#chat-input"),
    chat_area: $("#chat-area"),
    dropdown: $("#dropdown"),
    user_field: $("#user"),
    settings_window: $("#settings-window"),
    photo_input: $("#photoInput"),
    buttons: {
        edit_user: $("#edit-user"),
        send_photo: $("#photoBtn"),
        send_text: $("#sendBtn"),
        clear_history: $("#clear-history"),
        change_username: $("#change-username"),
        clear_logs: $("#clear-connection-logs"),
        logout: $("#change-username"),
        settings_window: $("#toggle-settings-window"),
        connection_logs_switch: $("#switch-connection-logs"),
        close_settings_menu: $("#close-settings-window")
    }
};
export let variables = {
    currentUser: null,
    previousUser: null,
    contextMenu: null,
    CONFIG: {
        noConnectionLogs: false,
        noNotifications: false
    }
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
    settingsWindow: false,
    userContextMenu: false
};
export const socket = io();
