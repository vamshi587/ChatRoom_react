import React, { useEffect, useState } from 'react';
import { over } from 'stompjs';
import SockJS from 'sockjs-client';

var stompClient = null;

const ChatRoom = () => {
    const [privateChats, setPrivateChats] = useState(new Map());
    const [publicChats, setPublicChats] = useState([]);
    const [onlineUsers, setOnlineUsers] = useState(new Map()); // Track online users with Map
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
    }, [userData.connected]);

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
        stompClient.subscribe('/chatroom/users', onUsersListUpdate); // Subscribe to the users list updates
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
                setOnlineUsers(prevState => new Map(prevState).set(payloadData.senderName, true));
                break;
            case "LEAVE":
                setOnlineUsers(prevState => {
                    const newMap = new Map(prevState);
                    newMap.delete(payloadData.senderName);
                    return newMap;
                });
                break;
            case "MESSAGE":
                setPublicChats(prevChats => [...prevChats, payloadData]);
                break;
            default:
                console.error("Unknown status:", payloadData.status);
        }
    };

    const onPrivateMessage = (payload) => {
        var payloadData = JSON.parse(payload.body);
        setPrivateChats(prevChats => {
            const updatedChats = new Map(prevChats);
            if (updatedChats.get(payloadData.senderName)) {
                updatedChats.get(payloadData.senderName).push(payloadData);
            } else {
                updatedChats.set(payloadData.senderName, [payloadData]);
            }
            return updatedChats;
        });
    };

    const onUsersListUpdate = (payload) => {
        const users = JSON.parse(payload.body);
        setOnlineUsers(new Map(users.map(user => [user, true])));
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

            setPrivateChats(prevChats => {
                const updatedChats = new Map(prevChats);
                if (userData.username !== tab) {
                    if (updatedChats.get(tab)) {
                        updatedChats.get(tab).push(chatMessage);
                    } else {
                        updatedChats.set(tab, [chatMessage]);
                    }
                }
                return updatedChats;
            });
            stompClient.send("/app/private-message", {}, JSON.stringify(chatMessage));
            setUserData({ ...userData, "message": "" });
        }
    };

    const handleUsername = (event) => {
        const { value } = event.target;
        setUserData({ ...userData, "username": value });
    };

    const registerUser = () => {
        if (userData.username.trim()) { // Ensure the username is not empty
            connect();
        } else {
            alert("Please enter a username.");
        }
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
                            {[...onlineUsers.keys()].map((name, index) => (
                                <li onClick={() => { setTab(name) }} className={`member ${tab === name && "active"}`} key={index}>
                                    {name} {onlineUsers.has(name) ? <span className="online-indicator">🟢</span> : <span className="offline-indicator">🔴</span>}
                                </li>
                            ))}
                        </ul>
                    </div>
                    {tab === "CHATROOM" && <div className="chat-content">
                        <ul className="chat-messages">
                            {publicChats.map((chat, index) => (
                                <li className={`message ${chat.senderName === userData.username && "self"}`} key={index}>
                                    {chat.senderName !== userData.username && <div className="avatar">{chat.senderName}</div>}
                                    <div className="message-data">{chat.message}</div>
                                    {chat.senderName === userData.username && <div className="avatar self">{chat.senderName}</div>}
                                </li>
                            ))}
                        </ul>

                        <div className="send-message">
                            <input type="text" className="input-message" placeholder="Enter the message" value={userData.message} onChange={handleMessage} />
                            <button type="button" className="send-button" onClick={sendValue}>Send</button>
                        </div>
                    </div>}
                    {tab !== "CHATROOM" && <div className="chat-content">
                        <ul className="chat-messages">
                            {[...privateChats.get(tab) || []].map((chat, index) => (
                                <li className={`message ${chat.senderName === userData.username && "self"}`} key={index}>
                                    {chat.senderName !== userData.username && <div className="avatar">{chat.senderName}</div>}
                                    <div className="message-data">{chat.message}</div>
                                    {chat.senderName === userData.username && <div className="avatar self">{chat.senderName}</div>}
                                </li>
                            ))}
                        </ul>

                        <div className="send-message">
                            <input type="text" className="input-message" placeholder="Enter the message" value={userData.message} onChange={handleMessage} />
                            <button type="button" className="send-button" onClick={sendPrivateValue}>Send</button>
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
                        Connect
                    </button>
                </div>}
        </div>
    );
};

export default ChatRoom;
