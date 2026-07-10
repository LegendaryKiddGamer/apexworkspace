// --- Application Core State Matrix ---
let myUserHandle = "ApexUser";
let currentChatId = null;

const chats = {
    /* Struct Schema:
    'target_user_id_or_socket_id': {
        id: 'target_user_id_or_socket_id',
        originalHandle: 'UserHandle',
        customName: null, // Overrides originalHandle if renamed
        messages: [] // Array of elements: { text: "", isMe: true/false }
    }
    */
};

// Mock Reference for your active network sockets
// Replace this with your standard system WebSocket instance or WebRTC Peer mesh reference
let networkSocket = {
    send: (payloadString) => {
        console.log("Transmitting network data array:", JSON.parse(payloadString));
    }
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
    renderSidebarChannels();
});

// --- Dynamic Profile Upgrades ---
function updateUserHandle(newHandle) {
    if (!newHandle.trim()) return;
    myUserHandle = newHandle.trim();
    
    // Broadcast change package to everyone connected
    broadcastNetworkPacket({
        type: "handle_change",
        senderId: "myUniqueMachineGUID", // Replace with your static system ID tracking
        newHandle: myUserHandle
    });
}

// --- Dynamic Sidebar Sync Layout ---
function renderSidebarChannels() {
    const listContainer = document.getElementById("chat-list-target");
    listContainer.innerHTML = "";

    Object.values(chats).forEach(chat => {
        const item = document.createElement("li");
        item.className = `chat-item ${chat.id === currentChatId ? 'active' : ''}`;
        item.onclick = () => selectChatThread(chat.id);

        const titleSpan = document.createElement("span");
        titleSpan.className = "chat-item-name";
        // Show custom alias if renamed, otherwise show their direct user handle
        titleSpan.innerText = chat.customName ? chat.customName : chat.originalHandle;

        item.appendChild(titleSpan);
        listContainer.appendChild(item);
    });
}

// --- Thread Routing Changes ---
function selectChatThread(chatId) {
    currentChatId = chatId;
    const targetChat = chats[chatId];

    if (!targetChat) return;

    // Show interface fields
    document.getElementById("rename-action-btn").style.display = "block";
    document.getElementById("chat-input-row").style.display = "flex";

    // Update Header Text Strings
    document.getElementById("chat-title-display").innerText = targetChat.customName ? targetChat.customName : targetChat.originalHandle;

    // Draw historical message bubbles
    const messageWindow = document.getElementById("chat-messages-target");
    messageWindow.innerHTML = "";

    targetChat.messages.forEach(msg => {
        appendBubbleToDOM(msg.text, msg.isMe);
    });

    renderSidebarChannels();
    scrollToLatestMessage();
}

// --- Structural Renaming Controller ---
function triggerChatRename() {
    if (!currentChatId || !chats[currentChatId]) return;

    const currentName = chats[currentChatId].customName || chats[currentChatId].originalHandle;
    const newName = prompt("Enter a new alias name for this conversation thread:", currentName);

    if (newName === null || !newName.trim()) return;

    chats[currentChatId].customName = newName.trim();

    // Sync title header locally
    document.getElementById("chat-title-display").innerText = newName.trim();
    renderSidebarChannels();

    // Signal out across transmission paths so the recipient sees the updated title string instantly
    broadcastNetworkPacket({
        type: "rename_chat",
        chatId: currentChatId,
        newName: newName.trim()
    });
}

// --- Message Rendering Engine ---
function executeMessageSend() {
    const input = document.getElementById("message-text-field");
    const payloadText = input.value.trim();

    if (!payloadText || !currentChatId) return;

    // Save message array memory slice locally
    chats[currentChatId].messages.push({ text: payloadText, isMe: true });
    appendBubbleToDOM(payloadText, true);

    // Send packet
    broadcastNetworkPacket({
        type: "chat_message",
        targetChatId: currentChatId,
        text: payloadText
    });

    input.value = "";
    scrollToLatestMessage();
}

function appendBubbleToDOM(text, isMe) {
    const targetBox = document.getElementById("chat-messages-target");
    
    // Remote clear default landing helper lines if pulling active channel focus
    const helperLandingText = targetBox.querySelector(".no-active-chat");
    if (helperLandingText) helperLandingText.remove();

    const row = document.createElement("div");
    row.className = `message-row ${isMe ? 'me' : 'them'}`;

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.innerText = text;

    row.appendChild(bubble);
    targetBox.appendChild(row);
    scrollToLatestMessage();
}

function scrollToLatestMessage() {
    const container = document.getElementById("chat-messages-target");
    container.scrollTop = container.scrollHeight;
}

// --- Central Incoming Network Processor ---
// Wire this entry node directly to your primary incoming data message handler
function processIncomingNetworkStreamData(rawPacket) {
    let packet;
    try {
        packet = typeof rawPacket === "string" ? JSON.parse(rawPacket) : rawPacket;
    } catch(e) { return; }

    const senderId = packet.senderId;

    // Automate thread creation keyed by sender's identity handle if thread doesn't exist
    if (senderId && !chats[senderId]) {
        chats[senderId] = {
            id: senderId,
            originalHandle: packet.senderHandle || senderId,
            customName: null,
            messages: []
        };
        renderSidebarChannels();
    }

    switch (packet.type) {
        case "chat_message":
            chats[senderId].messages.push({ text: packet.text, isMe: false });
            if (currentChatId === senderId) {
                appendBubbleToDOM(packet.text, false);
            }
            break;

        case "handle_change":
            if (chats[senderId]) {
                chats[senderId].originalHandle = packet.newHandle;
                // If thread active, immediately updates display layer
                if (currentChatId === senderId) {
                    selectChatThread(senderId);
                } else {
                    renderSidebarChannels();
                }
            }
            break;

        case "rename_chat":
            // Incoming custom name update matching channel parameters
            if (chats[packet.chatId]) {
                chats[packet.chatId].customName = packet.newName;
                if (currentChatId === packet.chatId) {
                    selectChatThread(packet.chatId);
                } else {
                    renderSidebarChannels();
                }
            }
            break;
    }
}

// Outbound Data Helper
function broadcastNetworkPacket(dataObj) {
    // Append standard tracking handle traits to every outbound packet
    dataObj.senderId = "myUniqueMachineGUID"; 
    dataObj.senderHandle = myUserHandle;
    
    if (networkSocket && typeof networkSocket.send === "function") {
        networkSocket.send(JSON.stringify(dataObj));
    }
}
