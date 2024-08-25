import React, { useEffect, useState } from 'react';
import { over } from 'stompjs';
import SockJS from 'sockjs-client';

var stompClient = null;

const ChatRoom = () => {
    const [privateChats, setPrivateChats] = useState(new Map());
    const [publicChats, setPublicChats] = useState([]);
    const [onlineUsers, setOnlineUsers] = useState(new Set()); // Track online users
    const [tab, setTab] = useState("CHATROOM");
    const [userData, setUserData] = useState({
        username: '',
        connected: false,
        message: ''
    });

    useEffect(() => {
        if (userData.connected) {
            window.addEventListener("beforeunload", handleBeforeUnload);
        }
        return () => {
            if (userData.connected) {
                window.removeEventListener("beforeunload", handleBeforeUnload);
            }
        };
    }, [userData]);

    const handleBeforeUnload = () => {
        leaveChat();
    };

    const connect = () => {
        let Sock = new SockJS('https://chatroom-java.onrender.com/ws');
        stompClient = over(Sock);
        stompClient.connect({}, onConnected, onError);
    };

    const onConnected = () => {
        setUserData({ ...userData, "connected": true });
        stompClient.subscribe('/chatroom/public', onMessageReceived);
        stompClient.subscribe('/user/' + userData.username + '/private', onPrivateMessage);
        userJoin();
    };

    const userJoin = () => {
        var chatMessage = {
            senderName: userData.username,
            status: "JOIN"
        };
        stompClient.send("/app/message", {}, JSON.stringify(chatMessage));
    };

    const leaveChat = () => {
        var chatMessage = {
            senderName: userData.username,
            status: "LEAVE"
        };
        stompClient.send("/app/message", {}, JSON.stringify(chatMessage));
    };

    const onMessageReceived = (payload) => {
        var payloadData = JSON.parse(payload.body);
        switch (payloadData.status) {
            case "JOIN":
                if (!privateChats.get(payloadData.senderName)) {
                    privateChats.set(payloadData.senderName, []);
                    setPrivateChats(new Map(privateChats));
                }
                setOnlineUsers(prevState => new Set([...prevState, payloadData.senderName]));
                break;
            case "LEAVE":
                setOnlineUsers(prevState => {
                    const newSet = new Set(prevState);
                    newSet.delete(payloadData.senderName);
                    return newSet;
                });
                break;
            case "MESSAGE":
                publicChats.push(payloadData);
                setPublicChats([...publicChats]);
                break;
        }
    };

    const onPrivateMessage = (payload) => {
        var payloadData = JSON.parse(payload.body);
        if (privateChats.get(payloadData.senderName)) {
            privateChats.get(payloadData.senderName).push(payloadData);
            setPrivateChats(new Map(privateChats));
        } else {
            let list = [];
            list.push(payloadData);
            privateChats.set(payloadData.senderName, list);
            setPrivateChats(new Map(privateChats));
        }
    };

    const onError = (err) => {
        console.log(err);
    };

    const handleMessage = (event) => {
        const { value } = event.target;
        setUserData({ ...userData, "message": value });
    };

    const sendValue = () => {
        if (stompClient) {
            var chatMessage = {
                senderName: userData.username,
                message: userData.message,
                status: "MESSAGE"
            };
            stompClient.send("/app/message", {}, JSON.stringify(chatMessage));
            setUserData({ ...userData, "message": "" });
        }
    };

    const sendPrivateValue = () => {
        if (stompClient) {
            var chatMessage = {
                senderName: userData.username,
                receiverName: tab,
                message: userData.message,
                status: "MESSAGE"
            };

            if (userData.username !== tab) {
                privateChats.get(tab).push(chatMessage);
                setPrivateChats(new Map(privateChats));
            }
            stompClient.send("/app/private-message", {}, JSON.stringify(chatMessage));
            setUserData({ ...userData, "message": "" });
        }
    };

    const handleUsername = (event) => {
        const { value } = event.target;
        setUserData({ ...userData, "username": value });
    };

    const registerUser = () => {
        connect();
    };

    const getInitials = (name) => {
        if (!name) return '';
        const parts = name.split(' ');
        if (parts.length === 1) {
            return parts[0].charAt(0).toUpperCase();
        }
        return parts[0].charAt(0).toUpperCase() + (parts[1] ? parts[1].charAt(0).toUpperCase() : '');
    };

    const getColor = (name) => {
        const colors = ["#FF5733", "#33FF57", "#5733FF", "#FFC300", "#FF33A6", "#A6FF33"];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const colorIndex = Math.abs(hash % colors.length);
        return colors[colorIndex];
    };

    return (
        <div className="container">
            <header className="chat-header">
                <h1>Welcome to Vamshi's Chat Room App</h1>
                <p>Here you can send messages to anyone. No data will be stored. Privacy matters.</p>
                <p>You can send private messages or public messages in the chatroom.</p>
            </header>
            {userData.connected ?
                <div className="chat-box">
                    <div className="member-list">
                        <ul>
                            <li onClick={() => { setTab("CHATROOM") }} className={`member ${tab === "CHATROOM" && "active"}`}>
                                Chatroom
                            </li>
                            {[...privateChats.keys()].map((name, index) => (
                                <li onClick={() => { setTab(name) }} className={`member ${tab === name && "active"}`} key={index}>
                                    <div className="member-info" style={{ backgroundColor: getColor(name) }}>
                                        <span className="member-initials">{getInitials(name)}</span>
                                        <span className="member-name">{name}</span>
                                    </div>
                                    {onlineUsers.has(name) ? <span className="online-indicator">🟢</span> : <span className="offline-indicator">🔴</span>}
                                </li>
                            ))}
                        </ul>
                    </div>
                    {tab === "CHATROOM" && <div className="chat-content">
                        <ul className="chat-messages">
                            {publicChats.map((chat, index) => (
                                <li className={`message ${chat.senderName === userData.username && "self"}`} key={index}>
                                    {chat.senderName !== userData.username && <div className="avatar" style={{ backgroundColor: getColor(chat.senderName) }}>{getInitials(chat.senderName)}</div>}
                                    <div className="message-data">
                                        <span className="message-text">{chat.message}</span>
                                        {chat.date && <span className="message-date">{new Date(chat.date).toLocaleTimeString()}</span>}
                                    </div>
                                    {chat.senderName === userData.username && <div className="avatar self" style={{ backgroundColor: getColor(chat.senderName) }}>{getInitials(chat.senderName)}</div>}
                                </li>
                            ))}
                        </ul>

                        <div className="send-message">
                            <input type="text" className="input-message" placeholder="enter the message" value={userData.message} onChange={handleMessage} />
                            <button type="button" className="send-button" onClick={sendValue}>send</button>
                        </div>
                    </div>}
                    {tab !== "CHATROOM" && <div className="chat-content">
                        <ul className="chat-messages">
                            {[...privateChats.get(tab)].map((chat, index) => (
                                <li className={`message ${chat.senderName === userData.username && "self"}`} key={index}>
                                    {chat.senderName !== userData.username && <div className="avatar" style={{ backgroundColor: getColor(chat.senderName) }}>{getInitials(chat.senderName)}</div>}
                                    <div className="message-data">
                                        <span className="message-text">{chat.message}</span>
                                        {chat.date && <span className="message-date">{new Date(chat.date).toLocaleTimeString()}</span>}
                                    </div>
                                    {chat.senderName === userData.username && <div className="avatar self" style={{ backgroundColor: getColor(chat.senderName) }}>{getInitials(chat.senderName)}</div>}
                                </li>
                            ))}
                        </ul>

                        <div className="send-message">
                            <input type="text" className="input-message" placeholder="enter the message" value={userData.message} onChange={handleMessage} />
                            <button type="button" className="send-button" onClick={sendPrivateValue}>send</button>
                        </div>
                    </div>}
                </div>
                :
                <div className="register">
                    <input
                        id="user-name"
                        placeholder="Enter your name"
                        name="userName"
                        value={userData.username}
                        onChange={handleUsername}
                        margin="normal"
                    />
                    <button type="button" onClick={registerUser}>
                        connect
                    </button>
                </div>}
        </div>
    );
};

export default ChatRoom;
