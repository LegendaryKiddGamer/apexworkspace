// ============================================================================
// 1. FIREBASE INITIALIZATION & CORE SETUP
// ============================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get, update, set, onChildAdded, onChildChanged, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB1VkaMjDBMueZPNA1PlhBXePOj64a26J0",
  authDomain: "apex-chat-538c2.firebaseapp.com",
  projectId: "apex-chat-538c2",
  storageBucket: "apex-chat-538c2.firebasestorage.app",
  messagingSenderId: "1044491020319",
  appId: "1:1044491020319:web:f09a841a5c1d4c7b63cd2a",
  measurementId: "G-P5TXGYPHEG"
};

// Initialize Firebase Realtime Database
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Unique local machine ID for tracking sync codes and network packages
const MY_UNIQUE_ID = "myUniqueMachineGUID"; 

// ============================================================================
// 2. APPLICATION CORE STATE MATRIX
// ============================================================================
let myUserHandle = "Ahan_Developer"; // Default starting handle
let currentChatId = null;

// Track message unique IDs to prevent duplicate rendering from Firebase child listeners
const seenMessageIds = new Set();

// Initial Active Conversations/Servers Data mapping
const chats = {
    "GBL-MAIN": {
        id: "GBL-MAIN",
        originalHandle: "Global Mainframe Node",
        customName: null,
        messages: []
    },
    "PRJ-SYNC": {
        id: "PRJ-SYNC",
        originalHandle: "Project Sync Engine",
        customName: null,
        messages: []
    }
};

// Mock Reference for active network sockets
let networkSocket = {
    send: (payloadString) => {
        console.log("Transmitting network data array:", JSON.parse(payloadString));
    }
};

// ============================================================================
// 3. INITIALIZATION & LIFECYCLE
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
    // Generate 6-digit sync code
    const generatedCode = generateSyncCode();
    
    // Auto-register code to Firebase so other users can add you
    registerMySyncCodeInFirebase(generatedCode, MY_UNIQUE_ID, myUserHandle);

    // Initial render and default UI setups
    renderSidebarChannels();
    setupActiveSyncListeners();
    
    // Bind change handler to the editable user handle
    const editableInput = document.getElementById("editableUserHandle");
    if (editableInput) {
        editableInput.value = myUserHandle;
        editableInput.addEventListener("input", (e) => updateUserHandle(e.target.value));
    }

    // Connect form actions to create server or add person
    const actionBtn = document.getElementById("serverActionButton");
    if (actionBtn) {
        actionBtn.addEventListener("click", handleServerAction);
    }
});

// ============================================================================
// 4. SYNC CODE GENERATION & FIREBASE HOOKS (6-Digit Logic)
// ============================================================================

// Generates the random 6-digit number and writes it to your UI
function generateSyncCode() {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeDisplay = document.getElementById("mySyncCode");
    if (codeDisplay) {
        codeDisplay.innerText = code;
    }
    return code;
}

// Writes your temporary 6-digit code to Firebase database mapping
async function registerMySyncCodeInFirebase(mySixDigitCode, myUid, myHandle) {
    try {
        await set(ref(db, `syncCodes/${mySixDigitCode}`), {
            uid: myUid,
            handle: myHandle,
            createdAt: Date.now()
        });
        console.log(`Successfully registered temporary 6-digit sync code: ${mySixDigitCode}`);
    } catch (error) {
        console.error("Failed to register sync code in Firebase:", error);
    }
}

// Setup real-time listeners on Firebase database to keep messages and chats automatically synced
function setupActiveSyncListeners() {
    // Listen for new servers created or updated in Firebase
    onChildAdded(ref(db, 'servers'), (snapshot) => {
        const serverData = snapshot.val();
        const serverId = snapshot.key;
        if (serverData && !chats[serverId]) {
            chats[serverId] = {
                id: serverId,
                originalHandle: serverData.name || "Remote Server Node",
                customName: null,
                messages: []
            };
            renderSidebarChannels();
        }
    });

    // Listen for incoming message feeds linked in real-time
    onChildAdded(ref(db, 'messages'), async (snapshot) => {
        const msg = snapshot.val();
        const msgId = snapshot.key;

        // Dedup Check: If we have already parsed/pushed this message node, skip it
        if (seenMessageIds.has(msgId)) return;
        seenMessageIds.add(msgId);

        if (msg && msg.serverId) {
            // Ensure the channel exists dynamically in local state if not already loaded
            if (!chats[msg.serverId]) {
                let channelName = "Remote Server Node";
                
                try {
                    const serverSnapshot = await get(ref(db, `servers/${msg.serverId}`));
                    if (serverSnapshot.exists() && serverSnapshot.val().name) {
                        channelName = serverSnapshot.val().name;
                    }
                } catch (err) {
                    console.error("Failed to fetch server details for message feed:", err);
                }

                chats[msg.serverId] = {
                    id: msg.serverId,
                    originalHandle: channelName,
                    customName: null,
                    messages: []
                };
                renderSidebarChannels();
            }

            const isMe = msg.senderId === MY_UNIQUE_ID;
            chats[msg.serverId].messages.push({ text: msg.text, isMe });
            
            // Only paint directly to DOM if the message belongs to the current active chat thread
            if (currentChatId === msg.serverId) {
                appendBubbleToDOM(msg.text, isMe);
            }
        }
    });
}

// Looks up a remote 6-digit code in Firebase and links that user to the current channel
window.addPersonToConv = async function() {
    const targetCodeInput = document.getElementById("remoteCodeInput");
    const targetCode = targetCodeInput ? targetCodeInput.value.trim() : "";

    if (targetCode.length !== 6 || isNaN(targetCode)) {
        alert("Please input a valid 6-digit sync code!");
        return;
    }

    if (!currentChatId) {
        alert("Please select a matrix conversation thread first!");
        return;
    }

    try {
        const codeRef = ref(db, `syncCodes/${targetCode}`);
        const snapshot = await get(codeRef);

        if (snapshot.exists()) {
            const remoteUserData = snapshot.val();
            const remoteUid = remoteUserData.uid;
            const remoteHandle = remoteUserData.handle;

            // Update database linking remote user to server
            await update(ref(db, `servers/${currentChatId}/members/${remoteUid}`), {
                handle: remoteHandle,
                joinedAt: Date.now()
            });

            alert(`Successfully added ${remoteHandle} to the conversation!`);
            
            // Add user dynamically to local session if not already existing
            if (!chats[remoteUid]) {
                chats[remoteUid] = {
                    id: remoteUid,
                    originalHandle: remoteHandle,
                    customName: null,
                    messages: []
                };
                renderSidebarChannels();
            }

            if (targetCodeInput) targetCodeInput.value = "";
        } else {
            alert("No user found with that active 6-digit sync key.");
        }
    } catch (error) {
        console.error("Firebase Sync Error:", error);
        alert("Failed to add person via sync code. Check your developer console logs.");
    }
};

window.connectDevice = function() {
    const codeInput = document.getElementById("remoteCodeInput");
    const code = codeInput ? codeInput.value.trim() : "";
    if (!code) return alert("Please enter a remote connection code!");
    alert(`Attempting connection verification using access descriptor: ${code}`);
};

// ============================================================================
// 5. PROFILE & WORKSPACE ENGINE FUNCTIONS
// ============================================================================

// Updates local profile value and matches UI centers dynamically
function updateUserHandle(newHandle) {
    const sanitized = newHandle.trim() || "ApexUser";
    myUserHandle = sanitized;
    
    // Update the middle status card handle layout
    const middleHandleDisplay = document.getElementById("middleDisplayHandle");
    if (middleHandleDisplay) {
        middleHandleDisplay.innerText = `Logged in as ${sanitized}. Select a matrix conversation to start swapping live data...`;
    }

    // Broadcast change package across socket networks
    broadcastNetworkPacket({
        type: "handle_change",
        senderId: MY_UNIQUE_ID,
        newHandle: myUserHandle
    });
}

// Copy Server ID Key Engine
window.copyServerID = function() {
    if (!currentChatId) return alert("Select a conversation first!");
    
    navigator.clipboard.writeText(currentChatId).then(() => {
        const btnText = document.getElementById("copyBtnText");
        if (btnText) {
            btnText.innerText = `Copied! (${currentChatId})`;
            setTimeout(() => {
                btnText.innerText = "Copy Server ID Key";
            }, 2000);
        }
    }).catch(err => {
         console.error("Failed to copy server key: ", err);
    });
};

// ============================================================================
// 6. DYNAMIC UI SIDEBAR & RENDERING
// ============================================================================

function renderSidebarChannels() {
    const listContainer = document.getElementById("serverListContainer");
    if (!listContainer) return;
    
    listContainer.innerHTML = "";

    Object.values(chats).forEach(chat => {
        const item = document.createElement("div");
        const isActive = chat.id === currentChatId;
        
        item.className = "server-item";
        item.style.cssText = `
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 12px; 
            border-radius: 8px; 
            cursor: pointer; 
            transition: 0.2s;
            background: ${isActive ? 'rgba(37, 99, 235, 0.15)' : 'rgba(0, 0, 0, 0.2)'};
            border: 1px solid ${isActive ? 'rgba(37, 99, 235, 0.3)' : 'rgba(255, 255, 255, 0.05)'};
        `;
        
        item.onclick = () => selectChatThread(chat.id);

        const titleSpan = document.createElement("span");
        titleSpan.style.cssText = `
            font-size: 12px;
            font-weight: 500;
            color: ${isActive ? '#60a5fa' : '#a1a1aa'};
        `;
        titleSpan.innerText = `🚀 ${chat.customName ? chat.customName : chat.originalHandle}`;

        const closeBtn = document.createElement("button");
        closeBtn.className = "close-btn";
        closeBtn.innerHTML = "&times;";
        closeBtn.style.cssText = "color: #71717a; font-size: 16px; cursor: pointer; background: transparent; border: none; padding: 0 4px;";
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            delete chats[chat.id];
            if (currentChatId === chat.id) {
                currentChatId = null;
                resetChatPane();
            }
            renderSidebarChannels();
        };

        item.appendChild(titleSpan);
        item.appendChild(closeBtn);
        listContainer.appendChild(item);
    });
}

function resetChatPane() {
    const inputRow = document.getElementById("chat-input-row");
    if (inputRow) inputRow.style.display = "none";

    const headerTitle = document.getElementById("currentServerTitle");
    if (headerTitle) headerTitle.innerText = "Select a matrix conversation";

    const visibleServerId = document.getElementById("currentServerIDDisplay");
    if (visibleServerId) visibleServerId.innerText = "------";

    const actionBtn = document.getElementById("serverActionButton");
    if (actionBtn) actionBtn.innerText = "Create New Server";

    const messageWindow = document.getElementById("chatLogsText");
    if (messageWindow) {
        messageWindow.innerHTML = `
            <div class="no-active-chat text-center my-auto flex flex-col items-center justify-center space-y-2 text-zinc-500 text-xs">
                <span>💬</span>
                <span id="middleDisplayHandle">Select a matrix conversation to start swapping live data...</span>
            </div>
        `;
    }
}

function selectChatThread(chatId) {
    currentChatId = chatId;
    const targetChat = chats[chatId];

    if (!targetChat) return;

    // Show input mechanics row
    const inputRow = document.getElementById("chat-input-row");
    if (inputRow) inputRow.style.display = "block";

    // Update Headings and visible Server ID key displays
    const headerTitle = document.getElementById("currentServerTitle");
    if (headerTitle) {
        headerTitle.innerText = targetChat.customName ? targetChat.customName : targetChat.originalHandle;
    }

    const visibleServerId = document.getElementById("currentServerIDDisplay");
    if (visibleServerId) {
        visibleServerId.innerText = targetChat.id;
    }

    // Toggle Action Button text context
    const actionBtn = document.getElementById("serverActionButton");
    if (actionBtn) {
        actionBtn.innerText = "New Conversation";
    }

    // Draw message logs
    const messageWindow = document.getElementById("chatLogsText");
    if (messageWindow) {
        messageWindow.innerHTML = "";
        messageWindow.style.textAlign = "left";

        if (targetChat.messages.length === 0) {
            messageWindow.innerHTML = `
                <div class="no-active-chat text-center my-auto flex flex-col items-center justify-center space-y-2 text-zinc-500 text-xs">
                    <span>💬</span>
                    <span>No message history context selected. Start typing below to send a message...</span>
                </div>`;
        } else {
            targetChat.messages.forEach(msg => {
                appendBubbleToDOM(msg.text, msg.isMe);
            });
        }
    }

    renderSidebarChannels();
    scrollToLatestMessage();
}

// Handle actions for creating a new server or switching to a matched short-key
async function handleServerAction() {
    const serverInput = document.getElementById("newServerInput");
    const inputVal = serverInput ? serverInput.value.trim() : "";
    
    if (!inputVal) return alert("Please enter a Name or short Server ID!");

    // Search existing keys
    let foundChatKey = null;
    for (const [key, details] of Object.entries(chats)) {
        if (details.id.toLowerCase() === inputVal.toLowerCase() || details.originalHandle.toLowerCase() === inputVal.toLowerCase()) {
            foundChatKey = key;
            break;
        }
    }

    if (foundChatKey) {
        alert(`Connecting to existing server: ${chats[foundChatKey].originalHandle}`);
        selectChatThread(foundChatKey);
    } else {
        // Create new server node layout in remote Firebase instance
        const generatedKey = "SRV-" + Math.floor(100 + Math.random() * 900);
        
        try {
            await set(ref(db, `servers/${generatedKey}`), {
                name: inputVal,
                ownerId: MY_UNIQUE_ID,
                createdAt: Date.now()
            });

            chats[generatedKey] = {
                id: generatedKey,
                originalHandle: inputVal,
                customName: null,
                messages: []
            };
            
            selectChatThread(generatedKey);
            alert(`Created server profile: ${inputVal}\nServer ID generated: ${generatedKey}`);
        } catch (error) {
            console.error("Firebase Database Creation Error:", error);
        }
    }
    
    if (serverInput) serverInput.value = "";
}

// ============================================================================
// 7. MESSAGE SENSING & RENDER LAYOUTS
// ============================================================================

window.executeMessageSend = async function() {
    const input = document.getElementById("chatMessageField");
    const payloadText = input ? input.value.trim() : "";

    if (!payloadText || !currentChatId) return;

    // Build unique ID for individual message packet inside DB paths
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
        await set(ref(db, `messages/${messageId}`), {
            serverId: currentChatId,
            senderId: MY_UNIQUE_ID,
            senderHandle: myUserHandle,
            text: payloadText,
            timestamp: Date.now()
        });

        if (input) input.value = "";
        scrollToLatestMessage();
    } catch (error) {
        console.error("Failed to transmit live messaging transaction packet:", error);
    }
};

function appendBubbleToDOM(text, isMe) {
    const targetBox = document.getElementById("chatLogsText");
    if (!targetBox) return;

    // Clear placeholder texts
    const helperLandingText = targetBox.querySelector(".no-active-chat");
    if (helperLandingText) helperLandingText.remove();

    const row = document.createElement("div");
    row.style.cssText = `
        display: flex;
        justify-content: ${isMe ? 'flex-end' : 'flex-start'};
        margin-bottom: 10px;
        width: 100%;
    `;

    const bubble = document.createElement("div");
    bubble.innerText = text;
    bubble.style.cssText = `
        max-width: 60%;
        padding: 10px 14px;
        border-radius: 12px;
        font-size: 13px;
        background: ${isMe ? '#2563eb' : '#27272a'};
        color: white;
        border: 1px solid ${isMe ? '#3b82f6' : '#3f3f46'};
    `;

    row.appendChild(bubble);
    targetBox.appendChild(row);
    scrollToLatestMessage();
}

function scrollToLatestMessage() {
    const container = document.getElementById("chatLogsText");
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

// ============================================================================
// 8. CENTRAL INCOMING NETWORK STREAM PROCESSOR
// ============================================================================
function processIncomingNetworkStreamData(rawPacket) {
    let packet;
    try {
        packet = typeof rawPacket === "string" ? JSON.parse(rawPacket) : rawPacket;
    } catch(e) { return; }

    const senderId = packet.senderId;

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
                if (currentChatId === senderId) {
                    selectChatThread(senderId);
                } else {
                    renderSidebarChannels();
                }
            }
            break;

        case "rename_chat":
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
    dataObj.senderId = MY_UNIQUE_ID; 
    dataObj.senderHandle = myUserHandle;
    
    if (networkSocket && typeof networkSocket.send === "function") {
        networkSocket.send(JSON.stringify(dataObj));
    }
}
