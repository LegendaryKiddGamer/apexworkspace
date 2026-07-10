import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Paste YOUR Firebase Configuration here from the Firebase console
const firebaseConfig = {
  apiKey: "AIzaSyB1VkaMjDBMueZPNA1PlhBXePOj64a26J0",
  authDomain: "apex-chat-538c2.firebaseapp.com",
  projectId: "apex-chat-538c2",
  storageBucket: "apex-chat-538c2.firebasestorage.app",
  messagingSenderId: "1044491020319",
  appId: "1:1044491020319:web:f09a841a5c1d4c7b63cd2a",
  measurementId: "G-P5TXGYPHEG"
};

// Initialize Firebase & Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Dom Elements
const myCodeEl = document.getElementById('my-code');
const targetCodeInput = document.getElementById('target-code');
const connectBtn = document.getElementById('connect-btn');
const chatBox = document.getElementById('chat-box');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');

// Generate or fetch a unique 6-digit code for this device session
let myCode = localStorage.getItem('chat_code') || Math.floor(100000 + Math.random() * 900000).toString();
localStorage.setItem('chat_code', myCode);
myCodeEl.textContent = myCode;

let activeChatId = null;
let unsubscribe = null;

// Initialize our own code space in Firestore so others can message us
setDoc(doc(db, "chats", myCode), { messages: [] }, { merge: true });

// Listen for incoming messages targeted specifically to MY code
onSnapshot(doc(db, "chats", myCode), (docSnap) => {
  if (!activeChatId && docSnap.exists() && docSnap.data().messages.length > 0) {
    // If someone messaged us first, auto-connect to their data room
    const lastMsg = docSnap.data().messages[docSnap.data().messages.length - 1];
    if (lastMsg.sender !== myCode) {
      startChatRoom(lastMsg.sender);
    }
  }
});

// Click Connect to link to another device's code
connectBtn.addEventListener('click', () => {
  const targetCode = targetCodeInput.value.trim();
  if (targetCode && targetCode !== myCode) {
    startChatRoom(targetCode);
  }
});

// Open real-time sync channel with a specific user
function startChatRoom(targetCode) {
  if (unsubscribe) unsubscribe(); // clear old listeners
  
  // To keep it simple, the lower code number name acts as the shared collection room ID
  activeChatId = myCode < targetCode ? `${myCode}_${targetCode}` : `${targetCode}_${myCode}`;
  
  // Create or assert the shared room document exists
  setDoc(doc(db, "rooms", activeChatId), { messages: [] }, { merge: true });

  // Listen to messages inside the shared room natively in real-time
  unsubscribe = onSnapshot(doc(db, "rooms", activeChatId), (docSnap) => {
    chatBox.innerHTML = ''; // clear box
    if (docSnap.exists()) {
      const messages = docSnap.data().messages || [];
      messages.forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', msg.sender === myCode ? 'me' : 'them');
        msgDiv.textContent = msg.text;
        chatBox.appendChild(msgDiv);
      });
      chatBox.scrollTop = chatBox.scrollHeight; // Auto scroll down
    }
  });

  // Enable the input fields
  msgInput.disabled = false;
  sendBtn.disabled = false;
  targetCodeInput.disabled = true;
  connectBtn.disabled = true;
  connectBtn.textContent = "Connected";
}

// Send Message Handler
async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text || !activeChatId) return;

  const msgPayload = {
    sender: myCode,
    text: text,
    timestamp: Date.now()
  };

  msgInput.value = '';

  // 1. Push message into the shared live chat room
  await updateDoc(doc(db, "rooms", activeChatId), {
    messages: arrayUnion(msgPayload)
  });

  // 2. Ping the receiver's entry point doc so their app knows to open the connection room
  const targetCode = targetCodeInput.value.trim() || activeChatId.replace(myCode, '').replace('_', '');
  await updateDoc(doc(db, "chats", targetCode), {
    messages: arrayUnion(msgPayload)
  });
}

sendBtn.addEventListener('click', sendMessage);
msgInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
