let currentUser = null;
let chatHistory = {};

function selectUser(user) {
  currentUser = user;
  document.getElementById('chatWith').textContent = `Chateando con ${user}`;
  document.getElementById('messageInput').disabled = false;
  document.getElementById('sendBtn').disabled = false;
  document.getElementById('fileBtn').disabled = false;
  
  const chatBox = document.getElementById('chatBox');
  chatBox.innerHTML = '';

  if (chatHistory[user]) {
    chatHistory[user].forEach(msg => {
      const div = document.createElement('div');
      div.classList.add('message', msg.sent ? 'sent' : 'received');
      div.innerHTML = msg.content;
      chatBox.appendChild(div);
    });
  } else {
    chatBox.innerHTML = '<p class="info">No hay mensajes aún</p>';
  }
}

function sendMessage() {
  const input = document.getElementById('messageInput');
  const message = input.value.trim();
  if (!message || !currentUser) return;

  const msgObj = { content: message, sent: true };
  if (!chatHistory[currentUser]) chatHistory[currentUser] = [];
  chatHistory[currentUser].push(msgObj);

  displayMessage(message, true);
  input.value = '';
}

function displayMessage(content, sent = true) {
  const chatBox = document.getElementById('chatBox');
  if (chatBox.querySelector('.info')) chatBox.innerHTML = '';

  const div = document.createElement('div');
  div.classList.add('message', sent ? 'sent' : 'received');
  div.innerHTML = content;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function sendFile() {
  const fileInput = document.getElementById('fileInput');
  fileInput.click();
  fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (file && currentUser) {
      const link = `<a href="#" class="file-link">${file.name}</a>`;
      const msgObj = { content: link, sent: true };
      if (!chatHistory[currentUser]) chatHistory[currentUser] = [];
      chatHistory[currentUser].push(msgObj);
      displayMessage(link, true);
    }
  };
}
